import { test } from "node:test"
import assert from "node:assert/strict"
import { checkAssignment, charactersWithIssues } from "./assignment-checks.ts"
import { indexRules } from "./assignment-rules.ts"

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

test("porušení pravidel je chyba u postavy i u týmu", () => {
  const options = {
    specialization: [{ value: "combat", label: "Boj" }, { value: "tactical", label: "Taktika" }, { value: "support", label: "Podpora" }],
    origin: [{ value: "mistni", label: "Místní" }, { value: "pribuzni", label: "Příbuzní" }, { value: "cizi", label: "Cizí" }],
    circle: [{ value: "C1", label: "Kuchi" }, { value: "C2", label: "Kaligrafie" }],
    unit: [{ value: "U1", label: "Murakami" }, { value: "U2", label: "Hagakure" }],
  }
  const rules = indexRules([
    { subjectType: "character", subjectId: "S1", property: "specialization", allowed: ["combat"] },
    { subjectType: "character", subjectId: "S1", property: "origin", allowed: ["mistni", "pribuzni"] },
    { subjectType: "character", subjectId: "S1", property: "circle", allowed: ["C1"] },
    { subjectType: "team", subjectId: "T1", property: "unit", allowed: ["U2"] },
  ])
  const issues = checkAssignment({
    ...base, slots: [full], rules, optionsFor: p => options[p],
    players: [{ ...ok, origin: "cizi" }],
  })
  assert.deepEqual(issues.map(i => i.message), [
    "Tým 1: jednotka Murakami porušuje pravidlo (napevno: Hagakure)",
    "Mimi: Podpora porušuje pravidlo (napevno: Boj)",
    "Mimi: Cizí porušuje pravidlo (kromě: Cizí)",
  ])
})

test("hodnota v souladu s pravidlem nic nehlásí, prázdná hodnota hlásí jen chybění", () => {
  const rules = indexRules([{ subjectType: "character", subjectId: "S1", property: "specialization", allowed: ["support"] }])
  const opts = () => [{ value: "support", label: "Podpora" }, { value: "combat", label: "Boj" }]
  assert.deepEqual(checkAssignment({ ...base, slots: [full], rules, optionsFor: opts, players: [ok] }), [])
  const empty = checkAssignment({ ...base, slots: [full], rules, optionsFor: opts, players: [{ ...ok, specialization: undefined }] })
  assert.deepEqual(empty.map(i => i.message), ["Mimi: chybí specializace"])
})

test("nerozdělené role trojice jsou varování u týmu", () => {
  const roles = [
    { id: 7, unitId: "U2", triplet: "A", nameM: "Kapitán", nameF: "Kapitánka" },
    { id: 8, unitId: "U2", triplet: "A", nameM: "Ctitel", nameF: "Ctitelka" },
  ]
  const slot = { unitId: "U2", A: "T3", B: "T4", overflow: [] }
  const players = [{ ...ok, teamId: "T3" }, { ...ok, id: "S2", name: "Bea", teamId: "T3" }]
  const rules = new Map()
  const none = checkAssignment({ ...base, slots: [slot], players, rules, roles, held: new Map([["S1", "7"]]) })
  assert.deepEqual(none.map(i => [i.level, i.target.id, i.message]), [["warning", "T3", "Tým 3 (Hagakure · A): nerozdělené role Ctitel / Ctitelka"]])
  const all = checkAssignment({ ...base, slots: [slot], players, rules, roles, held: new Map([["S1", "7"], ["S2", "8"]]) })
  assert.deepEqual(all, [])
})
