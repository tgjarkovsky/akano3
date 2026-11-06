import { test } from "node:test"
import assert from "node:assert/strict"
import {
  statusOf, worstStatus, statusAfterEdit, checkTransition, statusAfterAction, countStatuses,
} from "./doc-status.ts"
import { DOC_FIELDS, isDocField, docKey, countSections, appendSection } from "./doc-fields.ts"

test("statusOf odvodí prázdné a rozepsané z délky textu", () => {
  assert.equal(statusOf(undefined), "empty")
  assert.equal(statusOf({ length: 0, status: "done" }), "empty")
  assert.equal(statusOf({ length: 10, status: null }), "draft")
  assert.equal(statusOf({ length: 10, status: "done" }), "done")
  assert.equal(statusOf({ length: 10, status: "approved" }), "approved")
})

test("worstStatus vybere nejméně hotový stav", () => {
  assert.equal(worstStatus(["approved", "done", "approved"]), "done")
  assert.equal(worstStatus(["approved", "empty"]), "empty")
  assert.equal(worstStatus([]), "empty")
})

test("úprava hotového textu ho vrátí do rozepsaného", () => {
  assert.deepEqual(statusAfterEdit({ status: "done", changedAfterApproval: false }, true, false),
    { status: null, changedAfterApproval: false })
})

test("úprava schváleného textu nastaví příznak změněno po schválení", () => {
  assert.deepEqual(statusAfterEdit({ status: "approved", changedAfterApproval: false }, true, false),
    { status: null, changedAfterApproval: true })
})

test("drobná oprava a beze změny textu stav nechají", () => {
  const prev = { status: "approved", changedAfterApproval: false }
  assert.deepEqual(statusAfterEdit(prev, true, true), prev)
  assert.deepEqual(statusAfterEdit(prev, false, false), prev)
})

test("příznak změněno po schválení přežije další úpravy rozepsaného textu", () => {
  assert.deepEqual(statusAfterEdit({ status: null, changedAfterApproval: true }, true, false),
    { status: null, changedAfterApproval: true })
})

test("přechody stavů", () => {
  assert.equal(checkTransition("draft", "done"), null)
  assert.ok(checkTransition("empty", "done"))
  assert.ok(checkTransition("done", "done"))
  assert.equal(checkTransition("done", "approve"), null)
  assert.ok(checkTransition("draft", "approve"))
  assert.ok(checkTransition("approved", "approve"))
  assert.equal(checkTransition("done", "reopen"), null)
  assert.equal(checkTransition("approved", "reopen"), null)
  assert.ok(checkTransition("draft", "reopen"))
})

test("schválení smaže příznak změněno po schválení", () => {
  assert.deepEqual(statusAfterAction("approve"), { status: "approved", clearsChangedFlag: true })
  assert.deepEqual(statusAfterAction("done"), { status: "done", clearsChangedFlag: false })
  assert.deepEqual(statusAfterAction("reopen"), { status: null, clearsChangedFlag: false })
})

test("countStatuses", () => {
  assert.deepEqual(countStatuses(["empty", "draft", "approved", "approved"]),
    { empty: 1, draft: 1, done: 0, approved: 2, total: 4 })
})

test("registr polí", () => {
  assert.equal(DOC_FIELDS.character.length, 8)
  assert.equal(isDocField("character", "legends"), true)
  assert.equal(isDocField("character", "public"), false)
  assert.equal(isDocField("team", "internal"), true)
  assert.equal(isDocField("nope", "public"), false)
  assert.equal(isDocField("__proto__", "public"), false)
  assert.equal(docKey("unit", "U1", "public"), "unit:U1:public")
})

test("legendy: počítání a přidání oddílu", () => {
  assert.equal(countSections(""), 0)
  assert.equal(countSections("## Přístav\n\ntext\n\n## Akademie\n\n### pod"), 2)
  assert.deepEqual(appendSection("", "legenda"), { body: "## Legenda 1\n\n", cursor: 14 })
  const r = appendSection("## Přístav\n\ntext  \n\n", "legenda")
  assert.equal(r.body, "## Přístav\n\ntext\n\n## Legenda 2\n\n")
  assert.equal(r.cursor, r.body.length)
})
