import test from "node:test"
import assert from "node:assert/strict"
import { reversalCredits, buildReversal, resolveTargetCharacters } from "./point-resolution.ts"

test("reversalCredits vrací původní postavy i při změněném mapování kruhu", () => {
  const original = { resolvedCharacterIds: ["S001", "S004"], resolvedTeamIds: ["T01", "T02"] }
  const changed = resolveTargetCharacters("circle", "C1", { circleMembers: { C1: ["S002"] } })
  assert.deepEqual(changed, ["S002"])
  const r = reversalCredits(original)
  assert.deepEqual(r.resolvedCharacterIds, ["S001", "S004"])
  assert.deepEqual(r.resolvedTeamIds, ["T01", "T02"])
})

test("reversalCredits: legacy záznam bez resolvedCharacterIds se rozbalí přes týmy", () => {
  const r = reversalCredits({ resolvedTeamIds: ["T01"] })
  assert.deepEqual(r.resolvedCharacterIds, ["S001", "S002", "S003"])
  assert.deepEqual(r.resolvedTeamIds, ["T01"])
})

test("buildReversal obsahuje reversesId", () => {
  const r = buildReversal({ id: "PE1", targetType: "team", targetId: "T01", amount: 10 })
  assert.equal(r.reversesId, "PE1")
})
