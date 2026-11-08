import { test } from "node:test"
import assert from "node:assert/strict"
import { resolveGender, resolveRoleNames, unknownGenderNames, unknownRoleKeys } from "./gender-markup.ts"

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

test("rod držitele role", () => {
  const role = key => ({ ctitel: "f", kapitan: "m" })[key]
  const body = "Ve{@ctitel: zranil|zranila} se a {@kapitan: byl|byla} pryč, {@nikdo: on|ona} ne."
  assert.equal(resolveGender(body, { role }), "Vezranila se a byl pryč, on/ona ne.")
  assert.equal(resolveGender("{@ctitel: byl|byla}", {}), "byl/byla")
})

test("šablony rolí: jméno, neznámý klíč zůstane", () => {
  const names = { ctitel: "Kei", kapitan: "Kapitán/Kapitánka" }
  const body = "Řekl to {@kapitan} a {@ctitel}, ne {@zadna}. {Skála: a|b}"
  assert.equal(resolveRoleNames(body, k => names[k]), "Řekl to Kapitán/Kapitánka a Kei, ne {@zadna}. {Skála: a|b}")
})

test("role ve značkách nejsou neznámá jména postav", () => {
  assert.deepEqual(unknownGenderNames("{@ctitel: a|b} {Nikdo: a|b}", w => w in genders), ["Nikdo"])
  assert.deepEqual(unknownRoleKeys("{@ctitel} {@x: a|b} {@kapitan}", k => k !== "x" && k !== "kapitan"), ["kapitan", "x"])
})
