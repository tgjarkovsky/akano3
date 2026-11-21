import { test } from "node:test"
import assert from "node:assert/strict"
import { runLottery, castFromLottery, rng, shuffle } from "./lottery.ts"
import { emptyPrefs } from "./prihlaska.ts"

const nameOf = (_k, id) => id
const TEAMS = [
  { id: "T1", name: "Tým 1", memberIds: ["S1", "S2", "S3"] },
  { id: "T2", name: "Tým 2", memberIds: ["S4", "S5", "S6"] },
  { id: "T3", name: "Tým 3", memberIds: ["S7", "S8", "S9"] },
]
const STUDENTS = TEAMS.flatMap(t => t.memberIds.map(id => ({ id, kind: "player", teamId: t.id, gender: null })))
const ADULTS = ["NAK", "A2", "A3"].map(id => ({ id, kind: "adult", gender: null }))
const NAK = ADULTS[0]

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
const BOTH = ["first", "second"]
const lottery = (entries, seed = 1, extra = {}) => runLottery({
  entries, terms: BOTH, adultSlots: 3, studentSlots: 9, nakamura: NAK, seed, maxTeams: 2, ...extra,
})
const sel = (r, id) => r.selected.find(s => s.id === id)
const count = (r, group, term) => r.selected.filter(s => (!group || s.group === group) && (!term || s.term === term)).length
const adult = (edit = () => {}) => entry(d => { d.paths = { adult: true, team: false, student: false }; edit(d) })
const trio = (group, teamId, chars, edit = () => {}) => chars.map(c => entry(d => {
  d.paths = { adult: false, team: true, student: false }
  d.team = { mates: "spolu", solo: false, picks: { [teamId]: c } }
  edit(d)
}, group))

test("generátor a míchání jsou deterministické", () => {
  assert.deepEqual(shuffle([1, 2, 3, 4, 5], rng(7)), shuffle([1, 2, 3, 4, 5], rng(7)))
  assert.notDeepEqual(shuffle([...Array(20).keys()], rng(1)), shuffle([...Array(20).keys()], rng(2)))
})

test("Nakamura: jeden zrakově postižený na každý běh, bez nich jde do dospělých", () => {
  const v1 = adult(d => { d.visionImpaired = true; d.run = "first" })
  const v2 = adult(d => { d.visionImpaired = true; d.run = "first" })
  const v3 = adult(d => { d.visionImpaired = true; d.run = "second" })
  const r = lottery([v1, v2, v3])
  assert.equal(r.nakamura.picked.length, 2)
  assert.deepEqual(r.nakamura.picked.map(p => p.term).sort(), ["first", "second"])
  assert.equal(sel(r, v3.id).group, "nakamura")
  // Kdo Nakamuru nedostal, jde do losu dospělých; dospělých míst je 3 − 1 v každém běhu.
  const loser = [v1, v2].find(v => sel(r, v.id)?.group !== "nakamura")
  assert.ok(r.adults.order.includes(loser.id))
  assert.equal(sel(r, loser.id)?.group, "adult")
  // Kdo Nakamuru odmítl, do losu o něj nejde.
  const refuser = adult(d => { d.visionImpaired = true; d.prefs.adult = { NAK: "no" } })
  assert.deepEqual(lottery([refuser]).nakamura.candidates, [])
})

test("„je mi to jedno“ nevyjí ani jeden běh: konkrétní běh má místo, zbytek se rozdělí", () => {
  for (let seed = 1; seed <= 20; seed++) {
    const second = Array.from({ length: 9 }, () => entry(d => { d.run = "second" }))
    const any = Array.from({ length: 9 }, () => entry())
    const r = lottery([...second, ...any], seed)
    // 18 míst, 18 lidí: všichni jedou, druhý běh drží svých 9.
    assert.equal(count(r, "student", "first"), 9, `seed ${seed}`)
    assert.equal(count(r, "student", "second"), 9, `seed ${seed}`)
    assert.ok(second.every(e => sel(r, e.id)?.term === "second"), `seed ${seed}`)
  }
  // Moc lidí na první běh: nad kapacitu se přeskočí („běh je plný“) a zůstanou náhradníci.
  const first = Array.from({ length: 12 }, () => entry(d => { d.run = "first" }))
  const r = lottery(first)
  assert.equal(count(r, "student", "first"), 9)
  assert.equal(count(r, null, "second"), 0)
  assert.equal(r.substitutes.length, 3)
})

test("los jen na jeden termín: kdo chce druhý, v osudí není", () => {
  const a = entry(d => { d.run = "first" }), b = entry(d => { d.run = "second" }), c = entry()
  const r = lottery([a, b, c], 1, { terms: ["first"] })
  assert.ok(!r.students.order.includes(b.id))
  assert.ok(r.selected.every(s => s.term === "first"))
})

test("los nehledí na rod ani odmítnutí", () => {
  const men = Array.from({ length: 20 }, () => entry(d => { d.genderPref = "m"; d.prefs.character = Object.fromEntries(STUDENTS.map(s => [s.id, "no"])) }))
  const r = lottery(men)
  assert.equal(count(r, "student"), 18)
})

test("trojice: celá vylosovaná jede jako tým, dvojice se doplní, různé běhy ne", () => {
  const t = trio(100, "T2", ["S4", "S5", "S6"], d => { d.run = "second" })
  const r = lottery(t)
  assert.equal(r.trios[0].outcome, "team")
  assert.equal(r.trios[0].term, "second")
  assert.ok(t.every(m => sel(r, m.id)?.group === "team" && sel(r, m.id)?.term === "second"))
  const split = trio(101, "T1", ["S1", "S2", "S3"], d => { d.run = d.firstName.endsWith("1") ? "first" : "any" })
  split[0].data.run = "first"; split[1].data.run = "second"
  assert.equal(lottery(split).trios[0].outcome, "split")
  for (let seed = 1; seed <= 30; seed++) {
    const g = trio(200, "T1", ["S1", "S2", "S3"], d => { d.run = "first" })
    const filler = Array.from({ length: 9 }, () => entry(d => { d.run = "first" }))
    const res = lottery([...g, ...filler], seed)
    const drawnOfTrio = res.students.drawn.filter(id => g.some(m => m.id === id)).length
    const teamed = g.every(m => sel(res, m.id)?.group === "team")
    assert.equal(teamed, drawnOfTrio >= 2, `seed ${seed}`)
    if (drawnOfTrio === 2) assert.ok(g.some(m => m.id === res.trios[0].added))
    assert.equal(count(res, "team") + count(res, "student"), 9, `seed ${seed}`)
  }
})

test("limit týmů platí na běh; kdo jede jen s trojicí, místo přenechá", () => {
  const a = trio(1, "T1", ["S1", "S2", "S3"]), b = trio(2, "T2", ["S4", "S5", "S6"]), c = trio(3, "T3", ["S7", "S8", "S9"])
  const r = lottery([...a, ...b, ...c], 1, { maxTeams: 1 })
  const teamed = r.trios.filter(t => t.outcome === "team")
  assert.equal(teamed.length, 2)
  assert.deepEqual(teamed.map(t => t.term).sort(), ["first", "second"])
  assert.ok(teamed.every(t => t.team === 1))
  const over = r.trios.find(t => t.outcome === "limit")
  assert.ok(over.members.every(id => r.singles.steps.some(s => s.id === id && s.why === "limit")))
  // Nespárovaný, který jede jen s trojicí, se přeskočí a je náhradník.
  const lone = entry(d => { d.paths = { adult: false, team: true, student: false }; d.team = { mates: "x", solo: false, picks: { T1: "S1" } } })
  const r2 = lottery([lone, entry()])
  assert.equal(sel(r2, lone.id), undefined)
  assert.equal(r2.unpaired, 1)
  assert.deepEqual(r2.substitutes, [lone.id])
})

test("zbytek jsou náhradníci ve společném pořadí, kdo nechce, nejede", () => {
  const people = Array.from({ length: 22 }, (_, i) => entry(d => { if (i === 21) d.substitute = "no" }))
  const r = lottery(people, 5)
  const left = r.students.order.filter(id => !sel(r, id))
  assert.equal(left.length, 4)
  assert.deepEqual(r.substitutes, left.filter(id => id !== people[21].id))
  assert.deepEqual(lottery(people, 5), r)
})

test("obsazení podle losu: Nakamura, trojice do týmu, zbytek podle preferencí", () => {
  const v = adult(d => { d.visionImpaired = true; d.run = "first" })
  const ad = [adult(d => { d.run = "first" }), adult(d => { d.run = "first" })]
  const t = trio(50, "T2", ["S6", "S4", "S5"], d => { d.run = "first" })
  const singles = Array.from({ length: 6 }, () => entry(d => { d.run = "first" }))
  const all = [v, ...ad, ...t, ...singles]
  const r = lottery(all, 3, { maxTeams: 1, terms: ["first"] })
  const players = r.selected.map(s => ({ id: s.id, data: all.find(e => e.id === s.id).data, characterId: null }))
  const { assign, notes } = castFromLottery({ selected: r.selected, players, adults: ADULTS, students: STUDENTS, teams: TEAMS, nakamuraId: "NAK", nameOf })
  assert.equal(assign.get("NAK"), v.id)
  if (t.every(m => sel(r, m.id)?.group === "team")) assert.deepEqual(["S6", "S4", "S5"].map(c => assign.get(c)), t.map(m => m.id))
  assert.equal(assign.size, players.length)
  assert.deepEqual(notes, [])
  // Obsazené postavy a hráče nemění.
  const pre = players.map(p => p.id === v.id ? { ...p, characterId: "A2" } : p)
  const again = castFromLottery({ selected: r.selected, players: pre, adults: ADULTS, students: STUDENTS, teams: TEAMS, nakamuraId: "NAK", nameOf })
  assert.ok(![...again.assign.values()].includes(v.id))
  assert.ok(!again.assign.has("A2"))
})
