import test from "node:test"
import assert from "node:assert/strict"
import { teamTimeline, formatTimeOnly } from "./team-timeline.ts"
import { teamMemberIds } from "./point-resolution.ts"

const [C1, C2] = teamMemberIds("T01")
const at = (min, sec = 0) => new Date(2026, 0, 1, 10, min, sec)
const entry = (timestamp, amount, extra) => ({ timestamp, amount, resolvedTeamIds: [], ...extra })
const key = d => d.toLocaleString("cs-CZ", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })

test("zkrácený log: počáteční součet se ukotví na aktuální body", () => {
  const teams = [{ id: "T01", points: 100 }, { id: "T02", points: 50 }]
  const log = [
    entry(at(10), 5, { resolvedCharacterIds: [C1] }),
    entry(at(20), 7, { resolvedCharacterIds: [C2] }),
  ]
  const rows = teamTimeline(teams, log)
  assert.deepEqual(rows, [
    { time: key(at(10)), T01: 93, T02: 50 },
    { time: key(at(20)), T01: 100, T02: 50 },
  ])
})

test("legacy záznam bez resolvedCharacterIds používá resolvedTeamIds", () => {
  const teams = [{ id: "T01", points: 20 }, { id: "T02", points: 5 }]
  const log = [entry(at(10), 4, { resolvedTeamIds: ["T02"] })]
  assert.deepEqual(teamTimeline(teams, log), [{ time: key(at(10)), T01: 20, T02: 5 }])
})

test("dva záznamy ve stejné minutě jsou v jednom bucketu", () => {
  const teams = [{ id: "T01", points: 10 }]
  const log = [
    entry(at(10, 5), 3, { resolvedCharacterIds: [C1] }),
    entry(at(10, 40), 2, { resolvedCharacterIds: [C1] }),
  ]
  assert.deepEqual(teamTimeline(teams, log), [{ time: key(at(10)), T01: 10 }])
})

test("formatTimeOnly", () => {
  assert.equal(formatTimeOnly("29.10. 14:35"), "14:35")
})
