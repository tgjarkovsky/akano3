import { test } from "node:test"
import assert from "node:assert/strict"
import { indexRules, validateRuleInput } from "./assignment-rules.ts"
import { fixedRole, requiredSlot, slotBlockedByRoles, fixedRoleConflict, roleRuleOptions } from "./role-rules.ts"
import { checkAssignment } from "./assignment-checks.ts"

const ROLES = [
  { id: 1, unitId: "U3", triplet: "A", nameM: "Orion", nameF: "Orion" },
  { id: 2, unitId: "U3", triplet: "A", nameM: "Aquila", nameF: "Aquila" },
  { id: 3, unitId: "U3", triplet: "B", nameM: "Draco", nameF: "Draco" },
  { id: 4, unitId: "U1", triplet: "A", nameM: "Velitel", nameF: "Velitelka" },
]
const r = (subjectId, property, allowed, subjectType = "character") => ({ subjectType, subjectId, property, allowed })
const names = { S1: "Šiho", S2: "Jusuke", S3: "Anna", S4: "Kei" }

test("pevná role a slot týmu", () => {
  const idx = indexRules([r("S1", "role", ["1"])])
  assert.equal(fixedRole(idx, ROLES, "S1").nameM, "Orion")
  assert.equal(fixedRole(idx, ROLES, "S2"), null)
  assert.deepEqual(requiredSlot(idx, ROLES, ["S1", "S2"]), { slot: { unitId: "U3", triplet: "A" }, conflict: false })
  assert.equal(requiredSlot(idx, ROLES, ["S2"]).slot, null)
  assert.equal(slotBlockedByRoles(idx, ROLES, ["S1", "S2"], { unitId: "U3", triplet: "A" }), false)
  assert.equal(slotBlockedByRoles(idx, ROLES, ["S1", "S2"], { unitId: "U3", triplet: "B" }), true)
  assert.equal(slotBlockedByRoles(idx, ROLES, ["S2"], { unitId: "U1", triplet: "B" }), false)
  // pravidlo na smazanou roli se nepočítá
  assert.equal(fixedRole(indexRules([r("S1", "role", ["99"])]), ROLES, "S1"), null)
})

test("konflikt pevných rolí v týmu", () => {
  const idx = indexRules([r("S1", "role", ["1"]), r("S2", "role", ["3"])])
  assert.equal(requiredSlot(idx, ROLES, ["S1", "S2"]).conflict, true)
})

test("kdy pevnou roli nejde nastavit", () => {
  const base = { roles: ROLES, teamId: "T07", teammateIds: ["S1", "S2", "S3"], allCharacterIds: ["S1", "S2", "S3", "S4"],
    name: id => names[id], unitName: id => id }
  const unit = [r("T07", "unit", ["U3"], "team"), r("T08", "unit", ["U3"], "team")]
  const idx = indexRules([...unit, r("S1", "role", ["1"])])
  assert.equal(fixedRoleConflict({ ...base, index: idx, characterId: "S3", roleId: "2" }), null)
  assert.match(fixedRoleConflict({ ...base, index: idx, characterId: "S4", roleId: "1", teamId: "T08", teammateIds: ["S4"] }), /už má napevno Šiho/)
  assert.match(fixedRoleConflict({ ...base, index: idx, characterId: "S3", roleId: "3" }), /dvou trojicích/)
  assert.equal(fixedRoleConflict({ ...base, index: idx, characterId: "S1", roleId: "2" }), null) // změna vlastní role
  assert.match(fixedRoleConflict({ ...base, index: idx, characterId: "S3", roleId: "77" }), /neexistuje/)
  // tým musí mít jednotku napevno a role musí být z ní
  assert.match(fixedRoleConflict({ ...base, index: indexRules([]), characterId: "S1", roleId: "1" }), /jednotkou napevno/)
  assert.match(fixedRoleConflict({ ...base, index: indexRules([r("T07", "unit", ["U1", "U3"], "team")]), characterId: "S1", roleId: "1" }), /jednotkou napevno/)
  assert.match(fixedRoleConflict({ ...base, index: indexRules([r("T07", "unit", ["U1"], "team")]), characterId: "S1", roleId: "1" }), /role je z U3/)
})

test("validace: role jen napevno", () => {
  const ids = { characterIds: ["S1"], teamIds: ["T07"] }
  const opts = () => roleRuleOptions(ROLES, id => id)
  assert.equal(validateRuleInput({ subjectType: "character", subjectId: "S1", property: "role", allowed: ["1"] }, ids, opts), null)
  assert.equal(validateRuleInput({ subjectType: "character", subjectId: "S1", property: "role", allowed: null }, ids, opts), null)
  assert.match(validateRuleInput({ subjectType: "character", subjectId: "S1", property: "role", allowed: ["1", "2"] }, ids, opts), /napevno/)
  assert.match(validateRuleInput({ subjectType: "character", subjectId: "S1", property: "role", allowed: ["9"] }, ids, opts), /Neznámá hodnota/)
  assert.match(validateRuleInput({ subjectType: "team", subjectId: "T07", property: "role", allowed: ["1"] }, ids, opts), /nepatří/)
})

test("kontroly obsazení hlídají trojici týmu podle pevné role", () => {
  const players = [
    { id: "S1", name: "Šiho", teamId: "T07", specialization: "combat", origin: "cizi", circleIds: ["C1"] },
    { id: "S4", name: "Kei", teamId: "T08", specialization: "combat", origin: "cizi", circleIds: ["C1"] },
  ]
  const run = (A, B, rules) => checkAssignment({
    slots: [{ unitId: "U3", A, B, overflow: [] }], unitName: id => id, teamName: id => id,
    unplacedTeamIds: [], players, rules: indexRules(rules), optionsFor: () => [], roles: ROLES,
  }).filter(i => i.target.type === "team")
  const rules = [r("S1", "role", ["1"])]
  assert.equal(run("T07", "T08", rules).length, 0)
  const wrong = run("T08", "T07", rules)
  assert.equal(wrong.length, 1)
  assert.match(wrong[0].message, /T07 patří do U3 · trojice A \(pevná role Šiho \(Orion\)\)/)
  assert.equal(run("T08", "T07", []).length, 0)
})
