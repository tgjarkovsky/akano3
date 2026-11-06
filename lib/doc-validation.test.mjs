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
