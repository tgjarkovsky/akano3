import { test } from "node:test"
import assert from "node:assert/strict"
import { summarizeLessonClaims } from "./lesson-summary.ts"

const ch = (id, name, role, teamId, claimed = false) =>
  ({ id, code: id, name, role, teamId, circleIds: [], kaichiLevel: 0, points: 0, peerPointPool: 0, lessonClaimedThisWindow: claimed })

test("nezapočítá učitele ani GM, započítá Růži", () => {
  const r = summarizeLessonClaims([
    ch("1", "Anna", "student", "a"),
    ch("2", "Růže", "ruze", "a"),
    ch("3", "Učitel", "teacher"),
    ch("4", "GM", "gm"),
  ])
  assert.equal(r.total, 2)
  assert.deepEqual(r.pending.map(c => c.id).sort(), ["1", "2"])
})

test("rozdělí podle lessonClaimedThisWindow", () => {
  const r = summarizeLessonClaims([ch("1", "A", "student", "a", true), ch("2", "B", "student", "a", false)])
  assert.deepEqual(r.claimed.map(c => c.id), ["1"])
  assert.deepEqual(r.pending.map(c => c.id), ["2"])
})

test("řadí podle týmu a jména", () => {
  const r = summarizeLessonClaims([
    ch("1", "Žofie", "student", "b", true),
    ch("2", "Čeněk", "student", "a", true),
    ch("3", "Adam", "student", "b", true),
    ch("4", "Božena", "student", "a", true),
  ])
  assert.deepEqual(r.claimed.map(c => c.id), ["4", "2", "3", "1"])
})
