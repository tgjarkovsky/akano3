import { test } from "node:test"
import assert from "node:assert/strict"
import { splitNames } from "./dogtag.ts"

const P = ["Mušaši", "Šigen", "Mimi", "Kaja", "Hiko", "Ren", "Kei", "Eri", "Anna", "Kenzo", "Šiho"].map((name, i) => ({ id: `S${i}`, name }))
const found = t => splitNames(t, P).filter(s => s.id).map(s => s.text)

test("dogtag: jména i ve skloňovaných tvarech", () => {
  assert.deepEqual(found("Mušaši vidí Šigena, Mušašiho bratra a Šigenův meč."), ["Mušaši", "Šigena", "Mušašiho", "Šigenův"])
  assert.deepEqual(found("Kaje, Kaji, Kajou, Annou, Mimina, Hika, Hikem, Kenzovi, Šiho"), ["Kaje", "Kaji", "Kajou", "Annou", "Mimina", "Hika", "Hikem", "Kenzovi", "Šiho"])
})

test("dogtag: podobná slova nechytá", () => {
  assert.deepEqual(found("Renka, Keiko, Erik, Mimika, ren, šigen"), [])
})

test("dogtag: úseky skládají původní text", () => {
  const t = "Ren a Kei šli za Annou."
  const segs = splitNames(t, P)
  assert.equal(segs.map(s => s.text).join(""), t)
  assert.deepEqual(segs.filter(s => s.id).map(s => s.id), ["S5", "S6", "S8"])
  assert.deepEqual(splitNames("bez jmen", []), [{ text: "bez jmen" }])
})
