import test from "node:test"
import assert from "node:assert/strict"
import { standingOf } from "./standing.ts"

const rows = [
  { id: "a", points: 10 },
  { id: "b", points: 30 },
  { id: "c", points: 20 },
  { id: "d", points: 20 },
  { id: "e", points: 5 },
]

test("pořadí podle bodů", () => {
  assert.deepEqual(standingOf("b", rows), { rank: 1, total: 5 })
  assert.deepEqual(standingOf("a", rows), { rank: 4, total: 5 })
})

test("stejné body sdílí pořadí (1, 2, 2, 4)", () => {
  assert.equal(standingOf("c", rows).rank, 2)
  assert.equal(standingOf("d", rows).rank, 2)
  assert.equal(standingOf("e", rows).rank, 5)
})

test("neznámé id vrátí null", () => {
  assert.equal(standingOf("x", rows), null)
  assert.equal(standingOf("a", []), null)
})
