import { test } from "node:test"
import assert from "node:assert/strict"
import { parseStatusChange, canBeCast, castFit, fitMark, checkCast, missingText, sniffImage, checkPhoto, playerName, PHOTO_MAX_BYTES, substituteText, getsRejection } from "./cast.ts"
import { emptyPrefs } from "./prihlaska.ts"

const base = () => ({
  firstName: "Jana", lastName: "Nováková", nickname: "", email: "jana@example.cz", phone: "",
  run: "any", substitute: "no", newsletter: "no",
  paths: { adult: false, team: false, student: true }, genderPref: "any",
  team: { mates: "", solo: false, picks: {} },
  prefs: emptyPrefs(), visionImpaired: false, noteCasting: "", noteOrg: "", consent: true, sensitiveOk: true,
})
const nameOf = (_k, id) => `«${id}»`

test("stav přihlášky: přijatý a náhradník potřebují běh, ostatní ho ztratí", () => {
  assert.deepEqual(parseStatusChange("accepted", 3), { status: "accepted", runId: 3 })
  assert.deepEqual(parseStatusChange("substitute", null), { error: "Vyber běh" })
  assert.deepEqual(parseStatusChange("declined", 3), { status: "declined", runId: null })
  assert.deepEqual(parseStatusChange("new", undefined), { status: "new", runId: null })
  assert.ok("error" in parseStatusChange("vip", 1))
})

test("obsadit jde jen přijatého na stejný běh", () => {
  assert.equal(canBeCast({ status: "accepted", runId: 2 }, 2), true)
  assert.equal(canBeCast({ status: "accepted", runId: 1 }, 2), false)
  assert.equal(canBeCast({ status: "substitute", runId: 2 }, 2), false)
})

test("shoda: ★ z voleb i z výběru v trojici, ✗ z voleb", () => {
  const p = base()
  p.prefs.character = { S001: "yes", S002: "no" }
  const c = id => ({ id, kind: "player", teamId: "T01", gender: null })
  assert.deepEqual(castFit(p, c("S001"), nameOf), { wanted: true, refused: false, warnings: [] })
  assert.equal(castFit(p, c("S002"), nameOf).refused, true)
  const t = { ...base(), paths: { adult: false, team: true, student: false }, team: { mates: "x", solo: true, picks: { T01: "S003" } } }
  assert.equal(castFit(t, c("S003"), nameOf).wanted, true)
  assert.deepEqual(castFit(t, c("S001"), nameOf).warnings, ["hlásí se jen s trojicí do jiných postav"])
})

test("shoda: odmítnuté prvky postavy, rod a cesta dospělého", () => {
  const p = base()
  p.genderPref = "f"
  p.prefs.circle = { C2: "no" }
  p.prefs.origin = { cizi: "no" }
  const f = castFit(p, { id: "S001", kind: "player", teamId: "T01", gender: "m", circleId: "C2", origin: "cizi", unitId: "U1" }, nameOf)
  assert.deepEqual(f.warnings, ["nechce kruh «C2»", "nechce původ «cizi»", "chce hrát jen ženské postavy"])
  assert.equal(fitMark(f), "⚠")
  const a = castFit(base(), { id: "TCH1", kind: "adult", gender: null }, nameOf)
  assert.deepEqual(a.warnings, ["nehlásí se za dospělého"])
  const pa = { ...base(), paths: { adult: true, team: false, student: false } }
  pa.prefs.adult = { TCH1: "yes" }
  assert.equal(fitMark(castFit(pa, { id: "TCH1", kind: "adult", gender: null }, nameOf)), "★")
})

test("kontroly obsazení", () => {
  const { issues, uncastMessage } = checkCast({
    characters: [{ id: "S001", name: "Aiko" }, { id: "S002", name: "Ren" }],
    cast: new Map([["S002", { name: "Jana", fit: { wanted: false, refused: true, warnings: ["nechce kruh X"] } }]]),
    uncast: ["Petr", "Eva"],
  })
  assert.deepEqual(issues.map(i => [i.level, i.message]), [
    ["error", "Ren: Jana tuhle postavu odmítl(a)"],
    ["warning", "Ren: Jana nechce kruh X"],
    ["warning", "Bez hráče: Aiko"],
  ])
  const many = checkCast({ characters: Array.from({ length: 8 }, (_, i) => ({ id: `S${i}`, name: `P${i}` })), cast: new Map(), uncast: [] })
  assert.deepEqual(many.issues.map(i => i.message), ["Bez hráče: 8 postav"])
  assert.equal(many.uncastMessage, null)
  assert.equal(uncastMessage, "Bez postavy zůstávají: Petr, Eva")
})

test("co chybí do upomínky", () => {
  assert.equal(missingText({ paid: false, photo: false }), "zaplatit hru a nahrát fotku")
  assert.equal(missingText({ paid: true, photo: false }), "nahrát fotku")
  assert.equal(missingText({ paid: true, photo: true }), "")
})

test("fotka: typ podle bajtů a limit velikosti", () => {
  assert.equal(sniffImage(new Uint8Array([0xff, 0xd8, 0xff, 0xe0])), "image/jpeg")
  assert.equal(sniffImage(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])), "image/png")
  assert.equal(sniffImage(new TextEncoder().encode("RIFF\0\0\0\0WEBPVP8 ")), "image/webp")
  assert.equal(sniffImage(new TextEncoder().encode("<svg>")), null)
  assert.deepEqual(checkPhoto(new Uint8Array([0xff, 0xd8, 0xff])), { mime: "image/jpeg" })
  assert.equal(checkPhoto(new Uint8Array(PHOTO_MAX_BYTES + 1)).status, 413)
  assert.equal(checkPhoto(new TextEncoder().encode("<svg>")).status, 415)
})

test("jméno hráče", () => {
  assert.equal(playerName({ firstName: "Jana", lastName: "Nováková", nickname: "Janča" }), "Jana Nováková (Janča)")
})

test("nepřijetí: komu jde a věta o náhradnickém seznamu", () => {
  assert.deepEqual(["new", "accepted", "substitute", "declined"].filter(getsRejection), ["substitute", "declined"])
  assert.match(substituteText("until-june"), /na náhradnickém seznamu \*\*do konce června\*\*/)
  assert.match(substituteText("until-event"), /až do konání hry/)
  assert.match(substituteText("no"), /nezapisujeme/)
})
