import { test } from "node:test"
import assert from "node:assert/strict"
import { runLottery, rng, shuffle } from "./lottery.ts"
import { emptyPrefs } from "./prihlaska.ts"

const nameOf = (_k, id) => id
const TEAMS = [
  { id: "T1", name: "Tým 1", memberIds: ["S1", "S2", "S3"] },
  { id: "T2", name: "Tým 2", memberIds: ["S4", "S5", "S6"] },
  { id: "T3", name: "Tým 3", memberIds: ["S7", "S8", "S9"] },
]
const STUDENTS = TEAMS.flatMap(t => t.memberIds.map(id => ({ id, name: id, kind: "player", teamId: t.id, gender: null })))
const ADULTS = ["NAK", "A2", "A3"].map(id => ({ id, name: id, kind: "adult", gender: null }))

let nextId = 1
const entry = (edit = () => {}, teamGroup = null) => {
  const d = {
    firstName: `P${nextId}`, lastName: "X", nickname: "", email: "", phone: "",
    run: "any", substitute: "until-event", newsletter: "no",
    paths: { adult: false, team: false, student: true }, genderPref: "any",
    team: { mates: "", solo: false, picks: {} },
    prefs: emptyPrefs(), visionImpaired: false, noteCasting: "", noteOrg: "", consent: true, sensitiveOk: true,
  }
  edit(d)
  return { id: nextId++, data: d, teamGroup }
}
const lottery = (entries, seed = 1, extra = {}) => runLottery({
  entries, adults: ADULTS, students: STUDENTS, teams: TEAMS, nakamuraId: "NAK", seed, nameOf, maxTeams: 2, ...extra,
})
const who = (r, id) => r.cast.find(c => c.characterId === id)?.prihlaskaId
const adult = (edit = () => {}) => entry(d => { d.paths = { adult: true, team: false, student: false }; edit(d) })
const trio = (group, teamId, chars, solo = false) => chars.map(c => entry(d => {
  d.paths = { adult: false, team: true, student: false }
  d.team = { mates: "spolu", solo, picks: { [teamId]: c } }
}, group))

test("generátor a míchání jsou deterministické", () => {
  assert.deepEqual(shuffle([1, 2, 3, 4, 5], rng(7)), shuffle([1, 2, 3, 4, 5], rng(7)))
  assert.notDeepEqual(shuffle([...Array(20).keys()], rng(1)), shuffle([...Array(20).keys()], rng(2)))
})

test("Nakamura: zrakově postižený má přednost, bez něj se obsadí běžně", () => {
  const v = adult(d => { d.visionImpaired = true })
  const others = [adult(), adult(), adult()]
  const r = lottery([...others, v])
  assert.equal(who(r, "NAK"), v.id)
  assert.equal(r.cast.filter(c => c.via === "adult").length, 2)
  // Bez zrakově postiženého jdou na dospělé role tři lidé.
  const r2 = lottery(others)
  assert.equal(r2.cast.filter(c => c.via === "adult").length, 3)
  assert.ok(r2.log.some(l => l.text.includes("obsadí se jako ostatní")))
  // Kdo Nakamuru odmítl, na něj nejde ani se zrakovým postižením.
  const refuser = adult(d => { d.visionImpaired = true; d.prefs.adult = { NAK: "no" } })
  assert.notEqual(who(lottery([refuser]), "NAK"), refuser.id)
})

test("trojice: celá vylosovaná dostane tým podle výběru, dvojice se doplní", () => {
  const t = trio(100, "T2", ["S4", "S5", "S6"])
  const r = lottery([...t])
  assert.deepEqual(["S4", "S5", "S6"].map(c => who(r, c)), t.map(e => e.id))
  assert.ok(r.cast.filter(c => c.via === "team").length === 3)
  // Studentských postav je 9: z 12 lidí se vylosuje 9; dvojice se doplní o třetího i mimo los.
  for (let seed = 1; seed <= 30; seed++) {
    const g = trio(200, "T1", ["S1", "S2", "S3"])
    const filler = Array.from({ length: 9 }, () => entry())
    const res = lottery([...g, ...filler], seed)
    const drawnOfTrio = res.studentOrder.slice(0, 9).filter(id => g.some(m => m.id === id)).length
    const teamed = g.every(m => res.cast.some(c => c.prihlaskaId === m.id && c.via === "team"))
    assert.equal(teamed, drawnOfTrio >= 2, `seed ${seed}`)
  }
})

test("limit týmů a hráč, který jede jen s trojicí", () => {
  const a = trio(1, "T1", ["S1", "S2", "S3"]), b = trio(2, "T2", ["S4", "S5", "S6"]), c = trio(3, "T3", ["S7", "S8", "S9"], true)
  const r = lottery([...a, ...b, ...c])
  assert.equal(r.cast.filter(x => x.via === "team").length, 6) // maxTeams 2
  // Kdo nad limit zbyl: trojice „jedu i bez týmu“ dostane zbylé postavy jednotlivě, ostatní ne.
  const cTeamed = c.every(m => r.cast.some(x => x.prihlaskaId === m.id && x.via === "team"))
  assert.equal(r.cast.filter(x => x.via === "student").length, cTeamed ? 0 : 3)
  // Kdo jede jen s trojicí a ta nevyšla, nedostane nic a je náhradník.
  const lone = entry(d => { d.paths = { adult: false, team: true, student: false }; d.team = { mates: "x", solo: false, picks: { T1: "S1" } } })
  const r2 = lottery([lone, entry()])
  assert.ok(!r2.cast.some(x => x.prihlaskaId === lone.id))
  assert.deepEqual(r2.substitutes, [lone.id])
})

test("nikdy odmítnutá postava ani jiný rod; zbytek náhradníci v pořadí, bez zájmu nejede", () => {
  const STU = STUDENTS.map(s => ({ ...s, gender: "m" }))
  const women = Array.from({ length: 4 }, () => entry(d => { d.genderPref = "f" }))
  const men = Array.from({ length: 12 }, (_, i) => entry(d => { d.genderPref = "m"; if (i === 0) d.prefs.character = Object.fromEntries(STUDENTS.map(s => [s.id, "no"])); if (i === 11) d.substitute = "no" }))
  const r = runLottery({ entries: [...women, ...men], adults: [], students: STU, teams: TEAMS, nakamuraId: "NAK", seed: 3, nameOf })
  assert.equal(r.cast.length, 9)
  assert.ok(r.cast.every(c => !women.some(w => w.id === c.prihlaskaId)))
  assert.ok(!r.cast.some(c => c.prihlaskaId === men[0].id))
  const left = r.studentOrder.filter(id => !r.cast.some(c => c.prihlaskaId === id))
  assert.deepEqual([...r.substitutes, ...r.declined].sort(), [...left].sort())
  assert.deepEqual(r.substitutes, left.filter(id => id !== men[11].id))
  // Stejný seed, stejný výsledek.
  assert.deepEqual(runLottery({ entries: [...women, ...men], adults: [], students: STU, teams: TEAMS, nakamuraId: "NAK", seed: 3, nameOf }), r)
})
