import { test } from "node:test"
import assert from "node:assert/strict"
import { checkAssignment, charactersWithIssues } from "./assignment-checks.ts"

const base = {
  unitName: id => ({ U1: "Murakami", U2: "Hagakure" })[id] ?? id,
  teamName: id => id.replace("T", "Tým "),
  unplacedTeamIds: [],
  players: [],
}
const full = { unitId: "U1", A: "T1", B: "T2", overflow: [] }
const ok = { id: "S1", name: "Mimi", specialization: "support", origin: "mistni", circleIds: ["C1"] }

test("úplné obsazení nemá žádný problém", () => {
  assert.deepEqual(checkAssignment({ ...base, slots: [full], players: [ok] }), [])
})

test("prázdná trojice a tým navíc jsou chyby u jednotky", () => {
  const issues = checkAssignment({ ...base, slots: [{ unitId: "U2", A: "T3", B: null, overflow: ["T4"] }] })
  assert.deepEqual(issues.map(i => [i.level, i.message]), [
    ["error", "Hagakure: trojice B nemá tým"],
    ["error", "Hagakure: navíc Tým 4"],
  ])
  assert.ok(issues.every(i => i.target.type === "unit" && i.target.id === "U2"))
})

test("tým bez jednotky je chyba", () => {
  const issues = checkAssignment({ ...base, slots: [full], unplacedTeamIds: ["T9"] })
  assert.equal(issues[0].message, "Tým 9 není v žádné jednotce")
})

test("chybějící specializace a původ jsou jedna chyba postavy", () => {
  const issues = checkAssignment({ ...base, slots: [full], players: [{ ...ok, specialization: undefined, origin: undefined }] })
  assert.deepEqual(issues.map(i => [i.level, i.message]), [["error", "Mimi: chybí specializace a původ"]])
})

test("postava musí být právě v jednom kruhu", () => {
  const none = checkAssignment({ ...base, slots: [full], players: [{ ...ok, circleIds: [] }] })
  const two = checkAssignment({ ...base, slots: [full], players: [{ ...ok, circleIds: ["C1", "C2"] }] })
  assert.deepEqual(none.map(i => [i.level, i.message]), [["error", "Mimi: není v žádném kruhu"]])
  assert.deepEqual(two.map(i => [i.level, i.message]), [["error", "Mimi: je ve 2 kruzích, smí být jen v jednom"]])
})

test("charactersWithIssues vrací jen postavy", () => {
  const issues = checkAssignment({
    ...base,
    slots: [{ unitId: "U1", A: null, B: "T2", overflow: [] }],
    players: [ok, { ...ok, id: "S2", origin: undefined }],
  })
  assert.deepEqual([...charactersWithIssues(issues)], ["S2"])
})
