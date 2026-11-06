import { test } from "node:test"
import assert from "node:assert/strict"
import { configActionNeedsAdmin } from "./config-auth.ts"

test("obsazení běhu patří Přípravě", () => {
  assert.equal(configActionNeedsAdmin("setSpecialization"), true)
  assert.equal(configActionNeedsAdmin("placeTeam"), true)
  assert.equal(configActionNeedsAdmin("setOrigin"), true)
  assert.equal(configActionNeedsAdmin("setCharacterCircle"), true)
})

test("doplnění poolu darů zůstává Velínu", () => {
  assert.equal(configActionNeedsAdmin("refillPeerPool"), false)
})

test("neznámá nebo chybějící akce heslo nevyžaduje (odmítne ji validace)", () => {
  assert.equal(configActionNeedsAdmin("dropTables"), false)
  assert.equal(configActionNeedsAdmin(undefined), false)
  assert.equal(configActionNeedsAdmin(42), false)
})
