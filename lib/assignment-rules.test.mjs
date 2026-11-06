import { test } from "node:test"
import assert from "node:assert/strict"
import {
  indexRules, isAllowed, allowedValues, normalizeAllowed, describeRule,
  validateRuleInput, pendingFixedValues,
} from "./assignment-rules.ts"

const SPEC = [{ value: "combat", label: "Boj" }, { value: "tactical", label: "Taktika" }, { value: "support", label: "Podpora" }]
const CIRCLES = ["C1", "C2", "C3", "C4"].map(v => ({ value: v, label: v }))
const rule = (subjectId, property, allowed, subjectType = "character") => ({ subjectType, subjectId, property, allowed })

test("bez pravidla je povoleno všechno", () => {
  const idx = indexRules([])
  assert.equal(isAllowed(idx, "character", "S1", "specialization", "combat"), true)
  assert.equal(allowedValues(idx, "character", "S1", "specialization"), null)
})

test("pravidlo omezí jen svou postavu a vlastnost", () => {
  const idx = indexRules([rule("S1", "specialization", ["support"])])
  assert.equal(isAllowed(idx, "character", "S1", "specialization", "combat"), false)
  assert.equal(isAllowed(idx, "character", "S1", "specialization", "support"), true)
  assert.equal(isAllowed(idx, "character", "S1", "origin", "cizi"), true)
  assert.equal(isAllowed(idx, "character", "S2", "specialization", "combat"), true)
})

test("týmová pravidla jsou oddělená od postav", () => {
  const idx = indexRules([rule("T01", "unit", ["U1"], "team")])
  assert.equal(isAllowed(idx, "team", "T01", "unit", "U2"), false)
  assert.equal(isAllowed(idx, "character", "T01", "unit", "U2"), true)
})

test("normalizeAllowed: všechny povolené = žádné pravidlo, pořadí podle možností", () => {
  assert.equal(normalizeAllowed(["support", "combat", "tactical"], SPEC), null)
  assert.deepEqual(normalizeAllowed(["support", "combat"], SPEC), ["combat", "support"])
  assert.deepEqual(normalizeAllowed(["support", "zzz"], SPEC), ["support"])
})

test("describeRule pojmenuje libovolnou, napevno, kromě a výčet", () => {
  assert.deepEqual(describeRule(null, SPEC), { kind: "any", text: "Libovolná" })
  assert.deepEqual(describeRule(["support"], SPEC), { kind: "fixed", text: "Napevno: Podpora" })
  assert.deepEqual(describeRule(["combat", "tactical"], SPEC), { kind: "except", text: "Kromě: Podpora" })
  assert.deepEqual(describeRule(["C1", "C2"], CIRCLES), { kind: "some", text: "Jen: C1, C2" })
})

test("validateRuleInput", () => {
  const ids = { characterIds: ["S1"], teamIds: ["T01"] }
  const opts = p => p === "unit" ? [{ value: "U1", label: "U1" }] : SPEC
  const ok = { subjectType: "character", subjectId: "S1", property: "specialization", allowed: ["combat"] }
  assert.equal(validateRuleInput(ok, ids, opts), null)
  assert.equal(validateRuleInput({ ...ok, allowed: null }, ids, opts), null)
  assert.equal(validateRuleInput({ subjectType: "team", subjectId: "T01", property: "unit", allowed: ["U1"] }, ids, opts), null)
  assert.match(validateRuleInput({ ...ok, allowed: [] }, ids, opts), /Aspoň jedna/)
  assert.match(validateRuleInput({ ...ok, allowed: ["x"] }, ids, opts), /Neznámá hodnota/)
  assert.match(validateRuleInput({ ...ok, allowed: ["combat", "combat"] }, ids, opts), /dvakrát/)
  assert.match(validateRuleInput({ ...ok, subjectType: "team" }, ids, opts), /nepatří/)
  assert.match(validateRuleInput({ ...ok, subjectId: "S9" }, ids, opts), /Neznámá postava/)
  assert.match(validateRuleInput({ ...ok, property: "kaichi" }, ids, opts), /Neznámá vlastnost/)
  assert.ok(validateRuleInput(null, ids, opts))
})

test("pendingFixedValues najde jen pevné hodnoty, které postava ještě nemá", () => {
  const idx = indexRules([
    rule("S1", "specialization", ["support"]),
    rule("S1", "origin", ["mistni", "cizi"]),
    rule("S2", "circle", ["C2"]),
    rule("S3", "origin", ["cizi"]),
  ])
  const chars = [
    { id: "S1", specialization: "combat", origin: undefined, circleIds: ["C1"] },
    { id: "S2", specialization: "combat", origin: "cizi", circleIds: ["C1", "C2"] },
    { id: "S3", specialization: "combat", origin: "cizi", circleIds: ["C1"] },
  ]
  assert.deepEqual(pendingFixedValues(idx, chars), [
    { characterId: "S1", property: "specialization", value: "support" },
    { characterId: "S2", property: "circle", value: "C2" },
  ])
})
