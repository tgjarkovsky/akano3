import { test } from "node:test"
import assert from "node:assert/strict"
import { parsePrihlaska, characterLimits, findConflicts, openCount, emptyPrefs, buildPrihlaskyCsv, splitMedallion, fitsGender } from "./prihlaska.ts"

const ids = {
  adultIds: ["TCH1", "TCH2"],
  teamMembers: { T01: ["S001", "S002", "S003"], T02: ["S004", "S005", "S006"] },
  unitIds: ["U1", "U2"],
  circleIds: ["C1", "C2", "C4"],
  specializationIds: ["combat", "support"],
  originIds: ["mistni", "cizi"],
}

const valid = () => ({
  firstName: " Jana ", lastName: "Nováková", nickname: "", email: "jana@example.cz", phone: "+420 777 000 000",
  adult: true, consent: true, sensitiveOk: true, run: "any", substitute: "until-june", newsletter: "no",
  paths: { adult: false, team: true, student: true }, genderPref: "any",
  team: { mates: "Petr Svoboda, Eva Malá", solo: true, picks: { T01: "S003" } },
  prefs: { character: { S003: "yes", S004: "no", S005: "ok" }, unit: { U2: "no" } },
  noteCasting: "", noteOrg: "",
})

test("platná přihláška: ořízne texty, zahodí „klidně“ a doplní prázdné druhy", () => {
  const r = parsePrihlaska(valid(), ids)
  assert.equal(r.ok, true)
  assert.equal(r.value.firstName, "Jana")
  assert.deepEqual(r.value.prefs.character, { S003: "yes", S004: "no" })
  assert.deepEqual(r.value.prefs.adult, {})
  assert.deepEqual(r.value.team.picks, { T01: "S003" })
})

test("povinné údaje a plnoletost", () => {
  for (const [patch, msg] of [
    [{ firstName: "  " }, /jméno/i],
    [{ email: "jana@" }, /e-mail/i],
    [{ phone: "abc" }, /telefon/i],
    [{ adult: false }, /plnolet/],
    [{ consent: false }, /souhlas/],
    [{ sensitiveOk: false }, /citlivá témata/],
    [{ run: "third" }, /běh/],
    [{ paths: { adult: false, team: false, student: false } }, /za co se hlásíš/],
    [{ noteOrg: "x".repeat(4001) }, /dlouhý/],
    [{ genderPref: "x" }, /jaké postavy/],
    [{ team: { ...valid().team, solo: undefined } }, /jen tebe/],
  ]) {
    const r = parsePrihlaska({ ...valid(), ...patch }, ids)
    assert.equal(r.ok, false, JSON.stringify(patch))
    assert.match(r.error, msg)
  }
})

test("tým: postava musí patřit do týmu a aspoň jeden tým je vybraný", () => {
  assert.equal(parsePrihlaska({ ...valid(), team: { ...valid().team, picks: { T01: "S004" } } }, ids).ok, false)
  assert.equal(parsePrihlaska({ ...valid(), team: { ...valid().team, picks: { T99: "S001" } } }, ids).ok, false)
  assert.equal(parsePrihlaska({ ...valid(), team: { ...valid().team, picks: {} } }, ids).ok, false)
  assert.equal(parsePrihlaska({ ...valid(), team: { ...valid().team, mates: "" } }, ids).ok, false)
  // bez týmové cesty se tým nekontroluje a neuloží
  const r = parsePrihlaska({ ...valid(), paths: { adult: false, team: false, student: true }, team: null }, ids)
  assert.equal(r.ok, true)
  assert.deepEqual(r.value.team.picks, {})
})

test("volby: neznámé id nebo hodnota neprojde, nevybraná cesta se vymaže", () => {
  assert.equal(parsePrihlaska({ ...valid(), prefs: { character: { S999: "yes" } } }, ids).ok, false)
  assert.equal(parsePrihlaska({ ...valid(), prefs: { unit: { U1: "maybe" } } }, ids).ok, false)
  const withOrigin = parsePrihlaska({ ...valid(), prefs: { origin: { [ids.originIds[0]]: "no" } } }, ids)
  assert.deepEqual(withOrigin.value.prefs.origin, {}, "původ se v přihlášce nevybírá")
  const onlyAdult = parsePrihlaska({ ...valid(), paths: { adult: true, team: false, student: false }, prefs: { adult: { TCH1: "yes" }, character: { S001: "yes" }, unit: { U1: "no" } }, visionImpaired: true }, ids)
  assert.equal(onlyAdult.ok, true)
  assert.deepEqual(onlyAdult.value.prefs.adult, { TCH1: "yes" })
  assert.deepEqual(onlyAdult.value.prefs.character, {})
  assert.deepEqual(onlyAdult.value.prefs.unit, {})
  assert.equal(onlyAdult.value.visionImpaired, true)
  // jen tým a „bez trojice nejedu“: ostatní postavy se neukládají
  const teamOnly = parsePrihlaska({ ...valid(), paths: { adult: false, team: true, student: false }, team: { ...valid().team, solo: false } }, ids)
  assert.deepEqual(teamOnly.value.prefs.character, {})
  assert.deepEqual(teamOnly.value.prefs.unit, { U2: "no" })
})

test("limity z pravidel a rodu u kruhů", () => {
  const rules = { "team:T01:unit": ["U1"], "character:S001:origin": ["mistni"], "character:S004:circle": ["C1", "C2"] }
  const limits = characterLimits({
    characters: [
      { id: "S001", teamId: "T01", gender: "m" },
      { id: "S004", teamId: "T02", gender: "f" },
      { id: "S005", teamId: "T02", gender: null },
    ],
    allowed: (s, id, p) => rules[`${s}:${id}:${p}`] ?? null,
    circleIds: ids.circleIds,
  })
  assert.deepEqual(limits.S001, { unit: ["U1"], origin: ["mistni"], circle: ["C2", "C4"] })
  assert.deepEqual(limits.S004, { circle: ["C1", "C2"] })
  assert.equal(limits.S005, undefined)
})

test("střety: jen nevyřazené postavy, jejichž povolené hodnoty hráč všechny vyřadil", () => {
  const limits = { S001: { unit: ["U1"] }, S002: { unit: ["U1"] }, S003: { circle: ["C1", "C2"] } }
  const prefs = { ...emptyPrefs(), character: { S001: "yes", S002: "no" }, unit: { U1: "no" }, circle: { C1: "no" } }
  assert.deepEqual(findConflicts(prefs, limits), [{ characterId: "S001", kind: "unit", allowed: ["U1"], wanted: true }])
  prefs.circle.C2 = "no"
  assert.deepEqual(findConflicts(prefs, limits).map(c => [c.characterId, c.wanted]), [["S001", true], ["S003", false]])
})

test("počet otevřených možností", () => {
  const prefs = { ...emptyPrefs(), unit: { U1: "no", U2: "yes" } }
  assert.deepEqual(openCount(prefs, "unit", ["U1", "U2", "U3"]), { open: 2, yes: 1, total: 3 })
})

test("CSV: jména voleb a uvozovky", () => {
  const d = parsePrihlaska({ ...valid(), noteOrg: 'Řekla "ahoj", jo' }, ids).value
  const csv = buildPrihlaskyCsv([{ createdAt: "2026-11-10", updatedAt: "2026-11-10", data: d }], (k, id) => `${k}-${id}`)
  const [head, row] = csv.split("\n")
  assert.match(head, /^Odesláno,Upraveno,Jméno/)
  assert.match(row, /team-T01: character-S003/)
  assert.match(row, /character-S003/)
  assert.match(row, /"Řekla ""ahoj"", jo"$/)
})

test("medailonek: úsloví, údaje, témata a zbytek textu", () => {
  const m = splitMedallion("> 迷い子 – Dítě, které se ztratilo\n\n**Role:** ředitel\n\nTým 1 vždy držel.\n\nTémata\n\n- rodina\n- pospolitost")
  assert.deepEqual(m.motto, { jp: "迷い子", text: "Dítě, které se ztratilo" })
  assert.deepEqual(m.facts, [["Role", "ředitel"]])
  assert.deepEqual(m.bullets, ["rodina", "pospolitost"])
  assert.equal(m.body, "Tým 1 vždy držel.")
  // úsloví bez japonštiny a citát uprostřed textu zůstane v textu
  assert.deepEqual(splitMedallion("> Jen motto\n\nText\n\n> citát").motto, { text: "Jen motto" })
  assert.match(splitMedallion("Text\n\n> citát").body, /> citát/)
})

test("rod postav: neurčený projde vždy, jinak podle volby", () => {
  assert.equal(fitsGender("any", "m"), true)
  assert.equal(fitsGender("f", "m"), false)
  assert.equal(fitsGender("f", "f"), true)
  assert.equal(fitsGender("m", null), true)
  assert.equal(fitsGender("", "f"), true)
})
