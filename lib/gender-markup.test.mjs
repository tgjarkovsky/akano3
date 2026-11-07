import { test } from "node:test"
import assert from "node:assert/strict"
import { resolveGender, unknownGenderNames } from "./gender-markup.ts"

const genders = { Skála: "f", S014: "f", Jelen: "m" }
const of = who => genders[who]

test("rod čtenáře i jmenované postavy", () => {
  const body = "Přiš{el|la} jsi pozdě. {Skála: Vysmál|Vysmála} se ti a {Jelen: šel|šla} pryč."
  assert.equal(resolveGender(body, { self: "f", of }), "Přišla jsi pozdě. Vysmála se ti a šel pryč.")
  assert.equal(resolveGender(body, { self: "m", of }), "Přišel jsi pozdě. Vysmála se ti a šel pryč.")
})

test("bez známého rodu zůstanou oba tvary", () => {
  assert.equal(resolveGender("{byl|byla} {Kdo: on|ona} {|a}", {}), "byl/byla on/ona /a")
  assert.equal(resolveGender("{S014: člen|členka} týmu", { of }), "členka týmu")
})

test("ostatní složené závorky a wiki odkazy zůstanou", () => {
  const body = "{@kapitan} vede [[mise|misi]] a {nic}"
  assert.equal(resolveGender(body, { self: "f", of }), body)
})

test("neznámá jména ve značkách", () => {
  assert.deepEqual(unknownGenderNames("{Skála: a|b} {Nikdo: a|b} {a|b}", w => w in genders), ["Nikdo"])
})
