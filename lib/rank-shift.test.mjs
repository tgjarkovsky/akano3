import test from "node:test"
import assert from "node:assert/strict"
import { rankShifts, formatShift } from "./rank-shift.ts"

const since = new Date(2026, 0, 1, 10, 30)
const log = (min, amount, extra) => ({ timestamp: new Date(2026, 0, 1, 10, min), amount, resolvedTeamIds: [], ...extra })

test("B předběhl A díky nedávným bodům", () => {
  const current = [{ id: "A", points: 10 }, { id: "B", points: 12 }]
  const l = [log(40, 5, { resolvedCharacterIds: ["B"] })]
  assert.deepEqual(rankShifts(current, l, "students", since), { A: -1, B: 1 })
})

test("starší záznamy posun nemění", () => {
  const current = [{ id: "A", points: 10 }, { id: "B", points: 12 }]
  const l = [log(10, 5, { resolvedCharacterIds: ["B"] })]
  assert.deepEqual(rankShifts(current, l, "students", since), { A: 0, B: 0 })
})

test("týmy: součet bodů členů", () => {
  const teamOf = c => ({ S1: "T1", S2: "T1", S3: "T2" })[c]
  const current = [{ id: "T1", points: 11 }, { id: "T2", points: 10 }]
  const l = [log(40, 3, { resolvedCharacterIds: ["S1", "S2"] })]
  assert.deepEqual(rankShifts(current, l, "teams", since, teamOf), { T1: 1, T2: -1 })
})

test("formatShift", () => {
  assert.deepEqual([formatShift(2), formatShift(-1), formatShift(0)], ["▲2", "▼1", "–"])
})
