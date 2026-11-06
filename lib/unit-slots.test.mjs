import { test } from "node:test"
import assert from "node:assert/strict"
import { computeUnitSlots, slotOfTeam, planTeamMove } from "./unit-slots.ts"

const UNITS = ["U1", "U2"]
const p = (teamId, unitId, triplet = null) => ({ teamId, unitId, triplet })

test("bez trojic se týmy rozdělí do A a B v pořadí", () => {
  const s = computeUnitSlots(UNITS, [p("T1", "U1"), p("T2", "U1"), p("T3", "U2")])
  assert.deepEqual(s[0], { unitId: "U1", A: "T1", B: "T2", overflow: [] })
  assert.deepEqual(s[1], { unitId: "U2", A: "T3", B: null, overflow: [] })
})

test("výslovná trojice má přednost před odvozenou", () => {
  const s = computeUnitSlots(UNITS, [p("T1", "U1"), p("T2", "U1", "A")])
  assert.equal(s[0].A, "T2")
  assert.equal(s[0].B, "T1")
})

test("kolize trojic a třetí tým v jednotce skončí jako navíc", () => {
  const s = computeUnitSlots(UNITS, [p("T1", "U1", "A"), p("T2", "U1", "A"), p("T3", "U1")])
  assert.equal(s[0].A, "T1")
  assert.equal(s[0].B, "T2")
  assert.deepEqual(s[0].overflow, ["T3"])
})

test("neznámá jednotka nebo bez jednotky se ignoruje", () => {
  const s = computeUnitSlots(UNITS, [p("T1", "U9"), p("T2", null)])
  assert.deepEqual(s.map(x => [x.A, x.B]), [[null, null], [null, null]])
})

test("slotOfTeam najde tým, navíc vrací null", () => {
  const s = computeUnitSlots(UNITS, [p("T1", "U1"), p("T2", "U1"), p("T3", "U1")])
  assert.deepEqual(slotOfTeam(s, "T2"), { unitId: "U1", triplet: "B" })
  assert.equal(slotOfTeam(s, "T3"), null)
})

test("přesun do volného slotu je jeden zápis", () => {
  const s = computeUnitSlots(UNITS, [p("T1", "U1"), p("T2", "U1"), p("T3", "U2")])
  assert.deepEqual(planTeamMove(s, "T3", { unitId: "U2", triplet: "B" }), [p("T3", "U2", "B")])
})

test("přesun do obsazeného slotu vymění týmy", () => {
  const s = computeUnitSlots(UNITS, [p("T1", "U1"), p("T2", "U1"), p("T3", "U2")])
  assert.deepEqual(planTeamMove(s, "T3", { unitId: "U1", triplet: "A" }), [
    p("T3", "U1", "A"),
    p("T1", "U2", "A"),
  ])
})

test("přesun v rámci jednotky prohodí A a B", () => {
  const s = computeUnitSlots(UNITS, [p("T1", "U1"), p("T2", "U1")])
  assert.deepEqual(planTeamMove(s, "T1", { unitId: "U1", triplet: "B" }), [
    p("T1", "U1", "B"),
    p("T2", "U1", "A"),
  ])
})

test("přesun na vlastní místo nic nemění", () => {
  const s = computeUnitSlots(UNITS, [p("T1", "U1")])
  assert.deepEqual(planTeamMove(s, "T1", { unitId: "U1", triplet: "A" }), [])
})

test("tým navíc vytlačí obsazený slot do stavu bez trojice", () => {
  const s = computeUnitSlots(UNITS, [p("T1", "U1"), p("T2", "U1"), p("T3", "U1")])
  assert.deepEqual(planTeamMove(s, "T3", { unitId: "U1", triplet: "A" }), [
    p("T3", "U1", "A"),
    p("T1", "U1", null),
  ])
})
