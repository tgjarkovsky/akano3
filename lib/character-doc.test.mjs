import { test } from "node:test"
import assert from "node:assert/strict"
import { composeCharacterDoc, forPlayer, docStats, isSpisToken } from "./character-doc.ts"

const texts = {
  "character:S002:legends": { body: "## Mise\n\n*Text*", status: "approved" },
  "character:S002:inner_world": { body: "Já.", status: null },
  "character:S002:summary": { body: "   ", status: null },
  "character:S002:why_hunter": { body: "Protože.", status: "done" },
  "character:S002:medallion": { body: "Probudil se v nemocnici.", status: "approved" },
  "team:T01:medallion": { body: "Tým drží spolu.", status: "approved" },
  "team:T01:internal": { body: "Tajemství.", status: null },
  "circle:C3:internal": { body: "Společné.", status: null },
  "trait:origin:mistni:public": { body: "Místní jsou odsud.", status: "approved" },
}
const lookup = (type, id, field) => texts[`${type}:${id}:${field}`]

const input = {
  runName: "Běh 1",
  character: { id: "S002", name: "Šigen", nickname: "Zmatený" },
  team: { id: "T01", name: "Tým 1", teammates: ["Mušaši", "Mimi"] },
  unit: { id: "U1", name: "Murakami" },
  circle: { id: "C3", name: "Vědecký" },
  specialization: { id: "specialization:combat", label: "Boj" },
  origin: { id: "origin:mistni", label: "Místní" },
  text: lookup,
}

test("spis: kapitoly v pevném pořadí, prázdné vynechané", () => {
  const doc = composeCharacterDoc(input)
  // jednotka nemá žádný text, proto chybí
  assert.deepEqual(doc.chapters.map(c => c.key), ["core", "team", "circle", "traits"])
  const core = doc.chapters[0]
  // shrnutí jsou jen mezery → vynechané; tři otázky jdou za vnitřním světem
  assert.deepEqual(core.blocks.map(b => b.title), ["Medailonek", "Legendy", "Vnitřní svět", "Proč se potřebuji stát lovcem?"])
  assert.deepEqual(core.blocks.map(b => b.visibility), ["prelarp", "self", "self", "self"])
})

test("spis: viditelnost a hlavička", () => {
  const doc = composeCharacterDoc(input)
  const team = doc.chapters.find(c => c.key === "team")
  assert.deepEqual(team.blocks.map(b => [b.title, b.visibility]), [["Medailonek", "prelarp"], ["Jen mezi vámi", "team"]])
  assert.equal(doc.chapters.find(c => c.key === "circle").blocks[0].visibility, "circle")
  assert.deepEqual(doc.chapters.find(c => c.key === "traits").blocks.map(b => b.title), ["Původ: Místní"])
  assert.deepEqual(doc.header, {
    team: "Tým 1", teammates: ["Mušaši", "Mimi"], unit: "Murakami",
    specialization: "Boj", origin: "Místní", circle: "Vědecký",
  })
})

test("spis: bez obsazení má jen jádro", () => {
  const doc = composeCharacterDoc({ runName: "x", character: { id: "S002", name: "Šigen" }, text: lookup })
  assert.deepEqual(doc.chapters.map(c => c.key), ["core"])
  assert.equal(doc.character.nickname, undefined)
  assert.deepEqual(doc.header.teammates, [])
})

test("spis: hráč nevidí stavy, Příprava je počítá", () => {
  const doc = composeCharacterDoc(input)
  assert.deepEqual(docStats(doc), { blocks: 8, notApproved: 4 })
  const player = forPlayer(doc)
  assert.ok(player.chapters.flatMap(c => c.blocks).every(b => !("approved" in b)))
  assert.equal(JSON.stringify(player).includes("approved"), false)
})

test("tajný odkaz: 24 znaků base64url", () => {
  assert.equal(isSpisToken("abcdefghijklmnopqrstuv_-"), true)
  assert.equal(isSpisToken("abc"), false)
  assert.equal(isSpisToken("abcdefghijklmnopqrstuv/="), false)
  assert.equal(isSpisToken(null), false)
})
