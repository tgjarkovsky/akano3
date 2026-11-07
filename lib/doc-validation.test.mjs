import { test } from "node:test"
import assert from "node:assert/strict"
import { parseTextSave, parseStatusChange, parseRoleInput, roleKeyFrom, isKnownEntity, MAX_TEXT_LENGTH } from "./doc-validation.ts"

const ids = {
  characterIds: ["S001"], teamIds: ["T01"], unitIds: ["U1"], circleIds: ["C1"],
  traitIds: ["specialization:combat", "origin:mistni"],
}
const save = { entityType: "character", entityId: "S001", field: "legends", body: "Text", expectedVersion: null }

test("uložení textu: platné vstupy", () => {
  const r = parseTextSave({ ...save, keepStatus: true, by: "Tomáš" }, ids)
  assert.equal(r.ok, true)
  assert.deepEqual(r.value, { ...save, keepStatus: true, by: "Tomáš" })
  assert.equal(parseTextSave({ ...save, expectedVersion: 3 }, ids).ok, true)
  assert.equal(parseTextSave({ ...save, body: "" }, ids).ok, true)
  assert.equal(parseTextSave({ entityType: "trait", entityId: "origin:mistni", field: "public", body: "x", expectedVersion: null }, ids).ok, true)
  assert.equal(parseTextSave({ entityType: "role", entityId: "12", field: "personal", body: "x", expectedVersion: null }, ids).ok, true)
})

test("uložení textu: neplatné vstupy", () => {
  for (const bad of [
    { entityType: "nope" }, { entityId: "S999" }, { field: "public" }, { body: 5 },
    { body: "x".repeat(MAX_TEXT_LENGTH + 1) }, { expectedVersion: 0 }, { expectedVersion: "1" },
  ]) {
    assert.equal(parseTextSave({ ...save, ...bad }, ids).ok, false, JSON.stringify(bad).slice(0, 60))
  }
  assert.equal(parseTextSave(null, ids).ok, false)
})

test("role se ověřuje jen tvarem id", () => {
  assert.equal(isKnownEntity("role", "7", ids), true)
  assert.equal(isKnownEntity("role", "0", ids), false)
  assert.equal(isKnownEntity("role", "1; DROP", ids), false)
})

test("změna stavu potřebuje akci a verzi", () => {
  const ok = { entityType: "team", entityId: "T01", field: "public", action: "approve", expectedVersion: 2 }
  assert.equal(parseStatusChange(ok, ids).ok, true)
  assert.equal(parseStatusChange({ ...ok, action: "publish" }, ids).ok, false)
  assert.equal(parseStatusChange({ ...ok, expectedVersion: null }, ids).ok, false)
})

test("role: vstup a klíč", () => {
  const ok = { unitId: "U1", triplet: "A", key: "kapitan", nameM: "kapitán", nameF: "kapitánka" }
  assert.deepEqual(parseRoleInput(ok, ["U1"]), { ok: true, value: ok })
  assert.equal(parseRoleInput({ ...ok, triplet: "C" }, ["U1"]).ok, false)
  assert.equal(parseRoleInput({ ...ok, nameF: " " }, ["U1"]).ok, false)
  assert.equal(parseRoleInput({ ...ok, key: "Kapitán" }, ["U1"]).ok, false)
  assert.equal(parseRoleInput({ ...ok, key: "1x" }, ["U1"]).ok, false)
  assert.equal(parseRoleInput({ ...ok, unitId: "U9" }, ["U1"]).ok, false)
})

test("roleKeyFrom vyrobí platný klíč z názvu", () => {
  assert.equal(roleKeyFrom("ten tichej"), "ten_tichej")
  assert.equal(roleKeyFrom("Kapitán"), "kapitan")
  assert.equal(roleKeyFrom("  Žluťoučký kůň! "), "zlutoucky_kun")
  assert.equal(roleKeyFrom("123"), "role")
})

import { parseImport } from "./doc-validation.ts"

test("import: platný soubor", () => {
  const r = parseImport({
    source: "x",
    texts: [{ entityType: "character", entityId: "S001", field: "legends", body: "Text" },
            { entityType: "team", entityId: "T01", field: "public", body: "" }],
    genders: [{ characterId: "S001", gender: "m" }],
  }, ids)
  assert.equal(r.ok, true)
  assert.equal(r.value.texts.length, 2)
  assert.deepEqual(r.value.genders, [{ characterId: "S001", gender: "m" }])
  assert.equal(parseImport({ texts: [] }, ids).ok, true)
})

test("import: odmítne role, duplicity, neznámé entity a rody", () => {
  const t = { entityType: "character", entityId: "S001", field: "legends", body: "x" }
  assert.match(parseImport({ texts: [{ ...t, entityType: "role", entityId: "1", field: "personal" }] }, ids).error, /nepodporovaný/)
  assert.match(parseImport({ texts: [t, t] }, ids).error, /dvakrát/)
  assert.match(parseImport({ texts: [{ ...t, entityId: "S999" }] }, ids).error, /neznámá entita/)
  assert.match(parseImport({ texts: [{ ...t, field: "nope" }] }, ids).error, /neznámé pole/)
  assert.match(parseImport({ texts: [], genders: [{ characterId: "S001", gender: "x" }] }, ids).error, /rod/)
  assert.equal(parseImport(null, ids).ok, false)
  assert.equal(parseImport({}, ids).ok, false)
})

test("import: role s osobním textem", () => {
  const role = { unitId: "U1", triplet: "A", key: "orion", nameM: "Orion", nameF: "Orion", body: "Já jsem Orion." }
  const r = parseImport({ texts: [], roles: [role] }, ids)
  assert.equal(r.ok, true)
  assert.deepEqual(r.value.roles, [role])
  assert.equal(parseImport({ texts: [] }, ids).value.roles.length, 0)
  assert.match(parseImport({ texts: [], roles: [role, role] }, ids).error, /dvakrát/)
  assert.match(parseImport({ texts: [], roles: [{ ...role, unitId: "U9" }] }, ids).error, /jednotka/)
  assert.match(parseImport({ texts: [], roles: [{ ...role, triplet: "C" }] }, ids).error, /Trojice/)
  assert.match(parseImport({ texts: [], roles: [{ ...role, key: "Orion!" }] }, ids).error, /Klíč/)
  assert.match(parseImport({ texts: [], roles: [{ ...role, body: 1 }] }, ids).error, /neplatný text/)
  assert.match(parseImport({ texts: [], roles: {} }, ids).error, /roles/)
})
