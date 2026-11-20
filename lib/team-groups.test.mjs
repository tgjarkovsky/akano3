import { test } from "node:test"
import assert from "node:assert/strict"
import { mentions, suggestGroups, checkGroup, normalizeName } from "./team-groups.ts"

const p = (id, firstName, lastName, mates, team = true) => ({
  id, data: { firstName, lastName, nickname: "", paths: { adult: false, team, student: false }, team: { mates, solo: false, picks: {} } },
})

test("jména bez diakritiky a velikosti písmen", () => {
  assert.equal(normalizeName("  Kateřina  ŘÍHOVÁ-Nová "), "katerina rihova nova")
  assert.equal(mentions("Kateřina Říhová a Petr", p(1, "Katerina", "Rihova", "").data), true)
  assert.equal(mentions("Říhová, Kateřina", p(1, "Kateřina", "Říhová", "").data), true)
  // Novák není Nováková.
  assert.equal(mentions("Jana Nováková", p(1, "Jana", "Novák", "").data), false)
})

test("návrh trojic: stačí, když jeden zmíní druhého; víc než tři je nejednoznačné", () => {
  const list = [
    p(1, "Jana", "Nováková", "Petr Svoboda, Eva Černá"),
    p(2, "Petr", "Svoboda", "Jana"),
    p(3, "Eva", "Černá", ""),
    p(4, "Adam", "Král", "Tomáš Beneš"),
    p(5, "Tomáš", "Beneš", "Adam Král"),
    p(6, "Lenka", "Fialová", "nevím"),
    p(7, "Ota", "Marek", "Jana Nováková"), // čtvrtý ke skupině 1–3
    p(8, "Iva", "Horák", "Adam Král", false), // nehlásí se s týmem
  ]
  const { groups, ambiguous } = suggestGroups(list)
  assert.deepEqual(groups, [[4, 5]])
  assert.deepEqual(ambiguous, [[1, 2, 3, 7]])
})

test("kontrola skupiny", () => {
  const list = [p(1, "A", "A", ""), p(2, "B", "B", ""), p(3, "C", "C", "", false)]
  assert.equal(checkGroup([1, 2], list), null)
  assert.match(checkGroup([1], list), /2 až 3/)
  assert.match(checkGroup([1, 3], list), /se nehlásí s týmem/)
  assert.match(checkGroup([1, 1], list), /dvakrát/)
})
