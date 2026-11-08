import { test } from "node:test"
import assert from "node:assert/strict"
import { effectiveRoles, planRoleAssign, unheldRoles } from "./role-holders.ts"

const roles = [
  { id: "1", unitId: "U2", triplet: "A" }, { id: "2", unitId: "U2", triplet: "A" }, { id: "3", unitId: "U2", triplet: "A" },
  { id: "4", unitId: "U2", triplet: "B" },
]
const team = { a: "T1", b: "T1", c: "T1", x: "T2" }
const slots = { T1: { unitId: "U2", triplet: "A" }, T2: { unitId: "U2", triplet: "B" } }
const base = (over = {}) => ({
  roles, fixedRoleOf: new Map(), stored: [],
  teamOf: id => team[id], slotOf: t => slots[t], ...over,
})

test("pevná role má přednost, uložené platí jen ve slotu týmu", () => {
  const held = effectiveRoles(base({
    fixedRoleOf: new Map([["a", "1"]]),
    stored: [{ roleId: "1", characterId: "b" }, { roleId: "2", characterId: "a" }, { roleId: "3", characterId: "c" }, { roleId: "1", characterId: "x" }],
  }))
  assert.deepEqual([...held], [["a", "1"], ["c", "3"]])
})

test("tým mimo trojici role nemá", () => {
  const held = effectiveRoles(base({ stored: [{ roleId: "1", characterId: "a" }], slotOf: () => null }))
  assert.equal(held.size, 0)
})

test("přidělení role s výměnou mezi spoluhráči", () => {
  const plan = planRoleAssign(base({
    stored: [{ roleId: "1", characterId: "a" }, { roleId: "2", characterId: "b" }],
    members: ["a", "b", "c"], characterId: "a", roleId: "2",
  }))
  assert.deepEqual(plan, { holders: [{ characterId: "a", roleId: "2" }, { characterId: "b", roleId: "1" }, { characterId: "c", roleId: null }] })
})

test("zrušení role a chyby", () => {
  const input = base({ stored: [{ roleId: "1", characterId: "a" }], members: ["a", "b", "c"], characterId: "a", roleId: null })
  assert.deepEqual(planRoleAssign(input).holders[0], { characterId: "a", roleId: null })
  assert.match(planRoleAssign({ ...input, roleId: "4" }).error, /nepatří/)
  assert.match(planRoleAssign({ ...input, fixedRoleOf: new Map([["b", "2"]]), roleId: "2" }).error, /napevno/)
  assert.match(planRoleAssign({ ...input, fixedRoleOf: new Map([["a", "2"]]) }).error, /napevno/)
})

test("nedržené role trojice", () => {
  assert.deepEqual(unheldRoles(roles, new Map([["a", "1"]]), { unitId: "U2", triplet: "A" }).map(r => r.id), ["2", "3"])
})
