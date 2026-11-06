import { test } from "node:test"
import assert from "node:assert/strict"
import { parseDurationMin, validateLessonBody, validateConfigBody } from "./request-validation.ts"

const chars = ["a", "b"]
const ids = { teamIds: ["t1"], unitIds: ["u1"], circleIds: ["c1"], characterIds: chars }

test("parseDurationMin: neplatné hodnoty", () => {
  for (const v of [-5, 0, NaN, Infinity, "30", null]) assert.equal(parseDurationMin(v), null)
})

test("parseDurationMin: default a platná hodnota", () => {
  assert.equal(parseDurationMin(undefined), 30)
  assert.equal(parseDurationMin(45), 45)
})

test("lesson toggle: durationMin", () => {
  for (const d of [-1, 0, NaN, "x"]) {
    assert.ok(validateLessonBody({ action: "toggle", active: true, durationMin: d }, chars))
  }
  assert.equal(validateLessonBody({ action: "toggle", active: true }, chars), null)
  assert.equal(validateLessonBody({ action: "toggle", active: true, durationMin: 10 }, chars), null)
  assert.equal(validateLessonBody({ action: "toggle", active: false }, chars), null)
  assert.ok(validateLessonBody({ action: "toggle", active: "yes" }, chars))
})

test("lesson: neznámá akce a neplatné body", () => {
  assert.ok(validateLessonBody({ action: "nope" }, chars))
  assert.ok(validateLessonBody(null, chars))
  assert.ok(validateLessonBody("x", chars))
})

test("lesson claim: characterId", () => {
  assert.ok(validateLessonBody({ action: "claim", characterId: "zzz" }, chars))
  assert.ok(validateLessonBody({ action: "claim" }, chars))
  assert.equal(validateLessonBody({ action: "claim", characterId: "a" }, chars), null)
})

test("config: neznámá akce a neplatné body", () => {
  assert.ok(validateConfigBody({ action: "nope" }, ids))
  assert.ok(validateConfigBody(null, ids))
})

test("config: staré akce setTeamUnit a setCircleMembers už neexistují", () => {
  assert.ok(validateConfigBody({ action: "setTeamUnit", teamId: "t1", unitId: "u1" }, ids))
  assert.ok(validateConfigBody({ action: "setCircleMembers", circleId: "c1", memberIds: ["a"] }, ids))
})

test("config setSpecialization", () => {
  const ok = { action: "setSpecialization", characterId: "a", specialization: null }
  assert.equal(validateConfigBody(ok, ids), null)
  assert.equal(validateConfigBody({ ...ok, specialization: "combat" }, ids), null)
  assert.ok(validateConfigBody({ ...ok, specialization: "x" }, ids))
  assert.ok(validateConfigBody({ ...ok, characterId: "zzz" }, ids))
  assert.ok(validateConfigBody({ ...ok, specialization: 5 }, ids))
})

test("config placeTeam", () => {
  const ok = { action: "placeTeam", teamId: "t1", unitId: "u1", triplet: "A" }
  assert.equal(validateConfigBody(ok, ids), null)
  assert.equal(validateConfigBody({ ...ok, triplet: "B" }, ids), null)
  for (const bad of [{ triplet: "C" }, { triplet: null }, { teamId: "x" }, { unitId: "x" }]) {
    assert.ok(validateConfigBody({ ...ok, ...bad }, ids))
  }
})

test("config setOrigin", () => {
  const ok = { action: "setOrigin", characterId: "a", origin: "mistni" }
  assert.equal(validateConfigBody(ok, ids), null)
  assert.equal(validateConfigBody({ ...ok, origin: null }, ids), null)
  assert.ok(validateConfigBody({ ...ok, origin: "Místní" }, ids))
  assert.ok(validateConfigBody({ ...ok, characterId: "zzz" }, ids))
})

test("config setCharacterCircle: vždy právě jeden kruh", () => {
  const ok = { action: "setCharacterCircle", characterId: "a", circleId: "c1" }
  assert.equal(validateConfigBody(ok, ids), null)
  for (const bad of [null, "x", ["c1"], undefined]) {
    assert.ok(validateConfigBody({ ...ok, circleId: bad }, ids))
  }
  assert.ok(validateConfigBody({ ...ok, characterId: "zzz" }, ids))
})
