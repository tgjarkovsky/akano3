import { test } from "node:test"
import assert from "node:assert/strict"
import { NO_ACTIVE_RUN, noActiveRun, idleGameState, templateRunId } from "./run-status.ts"

test("noActiveRun vrací 409 se srozumitelnou hláškou", async () => {
  const res = noActiveRun()
  assert.equal(res.status, 409)
  assert.equal(await res.text(), NO_ACTIVE_RUN)
  assert.equal(NO_ACTIVE_RUN, "Teď se nehraje žádný běh")
})

test("idleGameState: žádný aktivní běh, výchozí alarm a prázdná data", () => {
  const runs = [{ id: 1 }, { id: 2 }]
  const s = idleGameState(runs)
  assert.equal(s.activeRunId, null)
  assert.equal(s.runs, runs)
  assert.equal(s.alarm.active, false)
  assert.equal(s.config.lesson_window_active, false)
  for (const k of ["characterPoints", "charState", "circleMembers", "teamUnits", "pointLog", "qrCodes"]) assert.deepEqual(s[k], [])
})

test("templateRunId: aktivní běh má přednost", () => {
  assert.equal(templateRunId([
    { id: 1, isActive: false, createdAt: "2026-01-01" },
    { id: 2, isActive: true, createdAt: "2025-01-01" },
    { id: 3, isActive: false, createdAt: "2026-06-01" },
  ]), 2)
})

test("templateRunId: bez aktivního poslední založený", () => {
  assert.equal(templateRunId([
    { id: 1, isActive: false, createdAt: "2026-01-01T10:00:00Z" },
    { id: 3, isActive: false, createdAt: "2026-06-01T10:00:00Z" },
    { id: 2, isActive: false, createdAt: "2026-03-01T10:00:00Z" },
  ]), 3)
  assert.equal(templateRunId([{ id: 4, isActive: false }, { id: 7, isActive: false }]), 7)
})

test("templateRunId: bez běhů null", () => {
  assert.equal(templateRunId([]), null)
})
