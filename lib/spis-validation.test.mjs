import { test } from "node:test"
import assert from "node:assert/strict"
import { parseRunId, parseSpisAction } from "./spis-validation.ts"

test("číslo běhu", () => {
  assert.equal(parseRunId("3"), 3)
  assert.equal(parseRunId(7), 7)
  for (const bad of ["0", "-1", "1.5", "abc", "", null, undefined, 0, 2.5, "01"]) assert.equal(parseRunId(bad), null, String(bad))
})

test("akce spisů", () => {
  const ids = ["S001"]
  assert.deepEqual(parseSpisAction({ action: "publish", runId: 2, by: "Tomáš" }, ids), { ok: true, value: { action: "publish", runId: 2, by: "Tomáš" } })
  assert.deepEqual(parseSpisAction({ action: "create-links", runId: "2" }, ids), { ok: true, value: { action: "create-links", runId: 2, by: null } })
  assert.equal(parseSpisAction({ action: "regenerate", runId: 2, characterId: "S001" }, ids).ok, true)
  assert.match(parseSpisAction({ action: "regenerate", runId: 2, characterId: "GM1" }, ids).error, /postava/)
  assert.match(parseSpisAction({ action: "delete", runId: 2 }, ids).error, /akce/)
  assert.match(parseSpisAction({ action: "publish" }, ids).error, /běh/)
  assert.equal(parseSpisAction(null, ids).ok, false)
})
