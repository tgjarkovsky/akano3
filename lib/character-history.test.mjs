import test from "node:test"
import assert from "node:assert/strict"
import { characterHistory } from "./character-history.ts"

const e = (id, min, amount, extra = {}) => ({
  id, timestamp: new Date(2026, 0, 1, 10, min), sourceRole: "gm", sourceCharacterId: "GM1",
  targetType: "student", targetId: "S001", resolvedTeamIds: [], amount, actionType: "bonus", ...extra,
})

test("zahrne tým přes resolvedCharacterIds i legacy resolvedTeamIds, jiného hráče ne", () => {
  const log = [
    e("A", 1, 5, { resolvedCharacterIds: ["S001", "S002"] }),
    e("B", 2, 3, { resolvedTeamIds: ["T01"] }),
    e("C", 3, 7, { resolvedCharacterIds: ["S004"] }),
  ]
  assert.deepEqual(characterHistory(log, "S002", 0).map(h => h.entry.id), ["B", "A"])
  assert.deepEqual(characterHistory(log, "S003", 0).map(h => h.entry.id), ["B"])
  assert.deepEqual(characterHistory(log, "S004", 0).map(h => h.entry.id), ["C"])
})

test("runningTotal, pořadí od nejnovějšího, storno", () => {
  const log = [
    e("A", 1, 5, { resolvedCharacterIds: ["S001"] }),
    e("B", 2, 3, { resolvedCharacterIds: ["S001"] }),
    e("R", 3, -3, { resolvedCharacterIds: ["S001"], actionType: "correction", note: "Storno: B" }),
  ]
  const h = characterHistory(log, "S001", 5)
  assert.deepEqual(h.map(x => x.entry.id), ["R", "B", "A"])
  assert.deepEqual(h.map(x => x.runningTotal), [5, 8, 5])
  assert.deepEqual(h.map(x => x.reversed), [false, true, false])
  assert.deepEqual(h.map(x => x.isReversal), [true, false, false])
})
