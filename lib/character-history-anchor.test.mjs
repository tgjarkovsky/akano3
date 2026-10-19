import test from "node:test"
import assert from "node:assert/strict"
import { characterHistory } from "./character-history.ts"

const e = (id, min, amount) => ({
  id, timestamp: new Date(2026, 0, 1, 10, min), sourceRole: "gm", sourceCharacterId: "GM1",
  targetType: "student", targetId: "S001", resolvedTeamIds: [], resolvedCharacterIds: ["S001"], amount, actionType: "bonus",
})

test("runningTotal se kotví na aktuálních bodech i při oříznutém logu", () => {
  const h = characterHistory([e("A", 2, 5), e("B", 1, 3)], "S001", 50)
  assert.deepEqual(h.map(x => x.entry.id), ["A", "B"])
  assert.deepEqual(h.map(x => x.runningTotal), [50, 45])
})
