import { suggestCast, suggestScore, type CastCharacter, type SuggestPlayer } from "./cast.ts"
import type { Prihlaska } from "./prihlaska.ts"

// Společný los obou běhů z nových přihlášek. Los určí, KDO jede, na který běh
// a v jaké skupině (Nakamura, dospělý, trojice jako tým, jednotlivec), a jedno
// společné pořadí náhradníků. Postavy los nepřiděluje: to dělá obsazení
// (castFromLottery) podle preferencí. Na rod ani odmítnuté postavy nehledí,
// kromě Nakamury: kdo ho odmítl, do losu o něj nejde. Bez databáze, ať jde
// testovat; stejné osudí a seed dají vždy stejný výsledek, takže los jde doložit.
//
// Každá fáze obsazuje oba běhy najednou. Jde se shora v pořadí losu a člověk
// místo dostane, když se ještě vejde: kdo chce konkrétní běh, potřebuje místo
// v něm, kdo „je mi to jedno“, kdekoli. Lidé s „je mi to jedno“ se rozdělí
// až na konci fáze do běhu, kde zbývá víc místa, takže žádný běh nezbědne.
//
//  1 Nakamura    los mezi zrakově postiženými s cestou dospělého, jeden na běh;
//                bez nich se Nakamura obsadí jako ostatní dospělé role.
//  2 Dospělí     náhodné pořadí lidí s cestou dospělého, dokud jsou místa.
//  3 Studenti    náhodné pořadí všech zbylých se studentskou nebo týmovou cestou;
//                vylosovaných je tolik, kolik je studentských postav v obou bězích.
//  4 Trojice     shora celé vylosované trojice, pak vylosované dvojice doplněné
//                o třetího; nejvýš maxTeams týmů na běh.
//  5 Jednotlivci zbylá studentská místa shora v pořadí; kdo jede jen s trojicí
//                a ta nejede, se přeskočí a místo jde dál.
//  6 Náhradníci  zbytek pořadí; kdo náhradníkem být nechce, nejede.

/** Dospělá postava, o kterou se losuje mezi zrakově postiženými. */
export const NAKAMURA_ID = "TCH2"

/** Termín z přihlášky. */
export type Term = "first" | "second"
export const TERMS: readonly Term[] = ["first", "second"]
type PerTerm = Record<Term, number>

export type LotteryEntry = { id: number; data: Prihlaska; teamGroup: number | null }

export type LotteryInput = {
  entries: readonly LotteryEntry[]
  /** termíny, na které se losuje (oba, nebo jen jeden) */
  terms: readonly Term[]
  /** počet dospělých postav v běhu včetně Nakamury */
  adultSlots: number
  /** počet studentských postav v běhu */
  studentSlots: number
  /** Nakamura (null = běhy ho nemají) */
  nakamura: CastCharacter | null
  seed: number
  /** nejvýš týmů z trojic na běh */
  maxTeams?: number
}

export type LotteryGroup = "nakamura" | "adult" | "team" | "student"

export type TrioOutcome =
  /** jede jako tým */
  | "team"
  /** vylosovaná, ale nad limit týmů: členové jdou jako jednotlivci */
  | "limit"
  /** vylosovaný jen jeden: jde jako jednotlivec podle své volby */
  | "single"
  /** trojice není celá k dispozici (člen jede na dospělou roli, není v osudí, nebo jsou ve skupině jen dva) */
  | "incomplete"
  /** členové chtějí různé běhy */
  | "split"

export type LotteryTrio = {
  members: number[]
  /** kteří z nich jsou mezi vylosovanými studenty */
  drawn: number[]
  outcome: TrioOutcome
  /** doplněný třetí (dvojice) */
  added: number | null
  term: Term | null
  /** pořadí týmu v běhu (1…maxTeams) */
  team: number | null
}

/** Krok průchodu pořadím: bere místo, nebo se přeskočí. */
export type LotteryStep = {
  id: number
  outcome: "taken" | "skipped"
  term?: Term
  /** proč se přeskočil: běh, který chce, je plný; nebo jede jen s trojicí, která nejede */
  why?: "full" | "no-team" | "limit" | "unpaired" | "incomplete"
}

export type LotterySelected = { id: number; group: LotteryGroup; teamGroup: number | null; term: Term }

export type LotteryResult = {
  version: 3
  seed: number
  terms: Term[]
  slots: { adults: number; students: number; maxTeams: number; nakamura: boolean }
  /** null = běhy Nakamuru nemají */
  nakamura: { candidates: number[]; picked: { id: number; term: Term }[] } | null
  /** pořadí osudí dospělých (bez vylosovaných Nakamurů) a průchod jím */
  adults: { order: number[]; steps: LotteryStep[] }
  /** pořadí osudí studentů, vylosovaní a přeskočení, protože jejich běh už měl dost vylosovaných */
  students: { order: number[]; drawn: number[]; full: number[] }
  trios: LotteryTrio[]
  /** průchod pořadím pro zbylá studentská místa */
  singles: { free: PerTerm; steps: LotteryStep[] }
  /** kdo jede, na který běh a v jaké skupině */
  selected: LotterySelected[]
  /** náhradníci v pořadí (první = první na řadě), společně pro oba běhy */
  substitutes: number[]
  /** nevylosovaní, kteří náhradníky být nechtějí */
  declined: number[]
  /** týmové přihlášky bez spárované trojice */
  unpaired: number
}

/** Deterministický generátor (mulberry32). */
export function rng(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function shuffle<T>(list: readonly T[], rand: () => number): T[] {
  const out = [...list]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

/** Jede jen s trojicí (nemá studentskou cestu a bez týmu nechce). */
export const teamOnly = (d: Prihlaska) => d.paths.team && !d.paths.student && !d.team.solo

/** Na které z losovaných termínů člověk může jet. */
export const acceptsTerms = (d: Prihlaska, terms: readonly Term[]): Term[] =>
  d.run === "any" ? [...terms] : terms.filter(t => t === d.run)

/**
 * Místa v obou bězích. Kdo chce konkrétní běh, zabírá místo v něm; kdo může
 * na oba, jakékoli. Vejde se, dokud jde všechny rozdělit.
 */
class Places {
  private spec: PerTerm = { first: 0, second: 0 }
  private flex = 0
  readonly cap: PerTerm
  constructor(cap: PerTerm) { this.cap = cap }
  private total = () => this.spec.first + this.spec.second + this.flex
  fits(acc: readonly Term[]): boolean {
    if (acc.length === 0) return false
    const s = { ...this.spec }
    let f = this.flex
    if (acc.length === 1) s[acc[0]]++
    else f++
    return s.first <= this.cap.first && s.second <= this.cap.second && s.first + s.second + f <= this.cap.first + this.cap.second
  }
  add(acc: readonly Term[]) {
    if (acc.length === 1) this.spec[acc[0]]++
    else this.flex++
  }
  get full() { return this.total() >= this.cap.first + this.cap.second }
}

/** Rozdělí vybrané do běhů: konkrétní běh platí, „je mi to jedno“ jde tam, kde zbývá víc místa. */
function assignTerms(accs: readonly (readonly Term[])[], cap: PerTerm): Term[] {
  const used: PerTerm = { first: 0, second: 0 }
  for (const a of accs) if (a.length === 1) used[a[0]]++
  return accs.map(a => {
    if (a.length === 1) return a[0]
    const t: Term = cap.second - used.second > cap.first - used.first ? "second" : "first"
    used[t]++
    return t
  })
}

export function runLottery(input: LotteryInput): LotteryResult {
  const { entries, adultSlots, studentSlots, nakamura, seed } = input
  const terms = TERMS.filter(t => input.terms.includes(t))
  const maxTeams = input.maxTeams ?? 5
  const rand = rng(seed)
  const per = (n: number): PerTerm => ({ first: terms.includes("first") ? n : 0, second: terms.includes("second") ? n : 0 })
  const acc = new Map(entries.map(e => [e.id, acceptsTerms(e.data, terms)]))
  const pool = entries.filter(e => acc.get(e.id)!.length > 0)
  const byId = new Map(pool.map(e => [e.id, e]))
  const used = new Set<number>()
  const selected: LotterySelected[] = []
  const select = (e: LotteryEntry, group: LotteryGroup, term: Term) => {
    used.add(e.id)
    selected.push({ id: e.id, group, teamGroup: e.teamGroup, term })
  }
  const unpaired = pool.filter(e => e.data.paths.team && e.teamGroup === null).length

  /** Průchod pořadím: shora bere, kdo se vejde, dokud nejsou místa plná. */
  const walk = (order: readonly LotteryEntry[], cap: PerTerm, skip?: (e: LotteryEntry) => LotteryStep["why"] | null) => {
    const places = new Places(cap)
    const steps: LotteryStep[] = []
    const taken: LotteryEntry[] = []
    for (const e of order) {
      if (places.full) break
      if (used.has(e.id)) continue
      const why = skip?.(e)
      if (why) { steps.push({ id: e.id, outcome: "skipped", why }); continue }
      const a = acc.get(e.id)!
      if (!places.fits(a)) { steps.push({ id: e.id, outcome: "skipped", why: "full" }); continue }
      places.add(a)
      taken.push(e)
      steps.push({ id: e.id, outcome: "taken" })
    }
    const termList = assignTerms(taken.map(x => acc.get(x.id)!), cap)
    const termOf = new Map(taken.map((e, i) => [e.id, termList[i]]))
    for (const s of steps) if (s.outcome === "taken") s.term = termOf.get(s.id)
    return { steps, taken, termOf }
  }

  // ── 1 Nakamura ──
  let nakamuraPhase: LotteryResult["nakamura"] = null
  const nakIn: PerTerm = { first: 0, second: 0 }
  if (nakamura) {
    const candidates = shuffle(pool.filter(e => e.data.paths.adult && e.data.visionImpaired && e.data.prefs.adult?.[nakamura.id] !== "no"), rand)
    const { taken, termOf } = walk(candidates, per(1))
    for (const e of taken) { select(e, "nakamura", termOf.get(e.id)!); nakIn[termOf.get(e.id)!]++ }
    nakamuraPhase = { candidates: candidates.map(e => e.id), picked: taken.map(e => ({ id: e.id, term: termOf.get(e.id)! })) }
  }

  // ── 2 Dospělí ──
  const adultOrder = shuffle(pool.filter(e => e.data.paths.adult && !used.has(e.id)), rand)
  const adultCap = per(adultSlots)
  for (const t of terms) adultCap[t] = Math.max(0, adultSlots - nakIn[t])
  const adults = walk(adultOrder, adultCap)
  for (const e of adults.taken) select(e, "adult", adults.termOf.get(e.id)!)

  // ── 3 Pořadí studentů ──
  const studentOrder = shuffle(pool.filter(e => (e.data.paths.student || e.data.paths.team) && !used.has(e.id)), rand)
  const draw = walk(studentOrder, per(studentSlots))
  const drawn = new Set(draw.taken.map(e => e.id))

  // ── 4 Trojice ──
  const byGroup = new Map<number, LotteryEntry[]>()
  for (const e of pool) if (e.teamGroup !== null && e.data.paths.team) byGroup.set(e.teamGroup, [...(byGroup.get(e.teamGroup) ?? []), e])
  const trioOf = new Map<number, LotteryTrio>()
  const trios: LotteryTrio[] = []
  const trioAcc = new Map<LotteryTrio, Term[]>()
  // Trojice v pořadí podle prvního vylosovaného člena.
  for (const e of studentOrder) {
    if (e.teamGroup === null || !drawn.has(e.id) || trioOf.has(e.teamGroup)) continue
    const members = byGroup.get(e.teamGroup)
    if (!members) continue
    const complete = members.length === 3 && members.every(m => !used.has(m.id))
    const common = terms.filter(t => members.every(m => acc.get(m.id)!.includes(t)))
    const d = members.filter(m => drawn.has(m.id))
    const trio: LotteryTrio = {
      members: members.map(m => m.id), drawn: d.map(m => m.id),
      outcome: !complete ? "incomplete" : common.length === 0 ? "split" : d.length === 1 ? "single" : "limit",
      added: null, term: null, team: null,
    }
    trioOf.set(e.teamGroup, trio)
    trioAcc.set(trio, common)
    trios.push(trio)
  }
  // Nejdřív celé vylosované, pak dvojice; obojí v pořadí losu.
  const teamPlaces = new Places(per(maxTeams))
  const teamed: LotteryTrio[] = []
  for (const want of [3, 2]) {
    for (const t of trios) {
      if (t.outcome !== "limit" || t.drawn.length !== want || !teamPlaces.fits(trioAcc.get(t)!)) continue
      teamPlaces.add(trioAcc.get(t)!)
      t.outcome = "team"
      t.added = want === 2 ? t.members.find(id => !t.drawn.includes(id))! : null
      teamed.push(t)
    }
  }
  const teams: PerTerm = { first: 0, second: 0 }
  assignTerms(teamed.map(t => trioAcc.get(t)!), per(maxTeams)).forEach((term, i) => {
    const t = teamed[i]
    t.term = term
    t.team = ++teams[term]
    for (const id of t.members) select(byId.get(id)!, "team", term)
  })

  // ── 5 Jednotlivci ──
  const free = per(studentSlots)
  for (const t of terms) free[t] = Math.max(0, studentSlots - 3 * teams[t])
  const singles = walk(studentOrder, free, e => {
    if (!teamOnly(e.data)) return null
    const t = e.teamGroup !== null ? trioOf.get(e.teamGroup) : undefined
    return e.teamGroup === null ? "unpaired" : t?.outcome === "limit" ? "limit" : t?.outcome === "incomplete" || t?.outcome === "split" ? "incomplete" : "no-team"
  })
  for (const e of singles.taken) select(e, "student", singles.termOf.get(e.id)!)

  // ── 6 Náhradníci ──
  const rest = [
    ...studentOrder.filter(e => !used.has(e.id)),
    ...adultOrder.filter(e => !used.has(e.id) && !studentOrder.includes(e)),
  ]
  return {
    version: 3, seed, terms,
    slots: { adults: adultSlots, students: studentSlots, maxTeams, nakamura: !!nakamura },
    nakamura: nakamuraPhase,
    adults: { order: adultOrder.map(e => e.id), steps: adults.steps },
    students: { order: studentOrder.map(e => e.id), drawn: draw.taken.map(e => e.id), full: draw.steps.filter(s => s.outcome === "skipped").map(s => s.id) },
    trios,
    singles: { free, steps: singles.steps },
    selected,
    substitutes: rest.filter(e => e.data.substitute !== "no").map(e => e.id),
    declined: rest.filter(e => e.data.substitute === "no").map(e => e.id),
    unpaired,
  }
}

type NameOf = Parameters<typeof suggestScore>[2]

export type CastFromLotteryInput = {
  /** skupiny z použitého losu */
  selected: readonly LotterySelected[]
  /** přijatí hráči běhu (s postavou i bez) */
  players: readonly SuggestPlayer[]
  adults: readonly CastCharacter[]
  students: readonly CastCharacter[]
  teams: readonly { id: string; name: string; memberIds: readonly string[] }[]
  nakamuraId: string
  nameOf: NameOf
}

/**
 * Návrh obsazení podle skupin z losu: Nakamura vylosovanému zrakově
 * postiženému, trojicím celé týmy podle toho, koho si kdo vybral, dospělým
 * dospělé postavy a jednotlivcům zbylé studentské postavy podle preferencí.
 * Obsazené postavy ani hráče nemění. Kdo se ve své skupině nevejde, dostane
 * návrh v posledním kole mezi všemi volnými postavami; `notes` vysvětlí proč.
 */
export function castFromLottery(input: CastFromLotteryInput): { assign: Map<string, number>; notes: string[] } {
  const { selected, players, adults, students, teams, nakamuraId, nameOf } = input
  const assign = new Map<string, number>()
  const notes: string[] = []
  const taken = new Set(players.map(p => p.characterId).filter(Boolean) as string[])
  const isFree = (cid: string) => !taken.has(cid) && !assign.has(cid)
  const free = new Map(players.filter(p => !p.characterId).map(p => [p.id, p]))
  const groupOf = new Map(selected.map(s => [s.id, s]))
  const inGroup = (g: LotteryGroup) => [...free.values()].filter(p => groupOf.get(p.id)?.group === g)
  const put = (cid: string, pid: number) => { assign.set(cid, pid); free.delete(pid) }
  const student = new Map(students.map(c => [c.id, c]))
  const fullName = (p: SuggestPlayer) => `${p.data.firstName} ${p.data.lastName}`.trim()

  // Nakamura
  const nak = adults.find(c => c.id === nakamuraId)
  for (const p of inGroup("nakamura")) {
    if (nak && isFree(nak.id) && suggestScore(p.data, nak, nameOf) !== null) put(nak.id, p.id)
    else notes.push(`${fullName(p)} (los na Nakamuru): Nakamura je obsazený nebo nesedí, dostane jinou postavu.`)
  }

  // Trojice: celé týmy. Nejvíc trojic, při shodě nejvyšší součet skóre (trojic je pár, stačí zkusit vše).
  const byGroup = new Map<number, SuggestPlayer[]>()
  for (const p of inGroup("team")) {
    const g = groupOf.get(p.id)!.teamGroup
    if (g !== null) byGroup.set(g, [...(byGroup.get(g) ?? []), p])
  }
  const trios = [...byGroup.values()].filter(m => m.length === 3)
  const options = trios.map(members => teams.flatMap(t => {
    if (!t.memberIds.every(isFree)) return []
    const picks = members.map(m => m.data.team.picks[t.id])
    if (picks.some(c => !c || !t.memberIds.includes(c)) || new Set(picks).size !== 3) return []
    const scores = members.map((m, i) => { const c = student.get(picks[i]!); return c ? suggestScore(m.data, c, nameOf) : null })
    if (scores.some(s => s === null)) return []
    return [{ team: t, picks: picks as string[], score: scores.reduce<number>((a, s) => a + s!, 0) }]
  }))
  let best: { count: number; score: number; pick: (number | null)[] } = { count: -1, score: 0, pick: [] }
  const usedTeams = new Set<string>()
  const pick: (number | null)[] = []
  const search = (i: number, count: number, score: number) => {
    if (i === trios.length) {
      if (count > best.count || (count === best.count && score > best.score)) best = { count, score, pick: [...pick] }
      return
    }
    options[i].forEach((o, k) => {
      if (usedTeams.has(o.team.id)) return
      usedTeams.add(o.team.id); pick.push(k)
      search(i + 1, count + 1, score + o.score)
      usedTeams.delete(o.team.id); pick.pop()
    })
    pick.push(null)
    search(i + 1, count, score)
    pick.pop()
  }
  search(0, 0, 0)
  trios.forEach((members, i) => {
    const k = best.pick[i]
    if (k === null || k === undefined) {
      notes.push(`Trojice ${members.map(fullName).join(", ")}: ${options[i].length === 0
        ? "není volný tým, kde by si všichni vybrali různé postavy a ty jim seděly"
        : "týmy, které by jim seděly, dostaly jiné trojice"}. Dostanou postavy jednotlivě.`)
      return
    }
    const o = options[i][k]
    members.forEach((m, j) => put(o.picks[j], m.id))
  })

  // Dospělí, pak jednotlivci; nakonec všichni zbylí na všechny zbylé postavy.
  const round = (chars: readonly CastCharacter[], people: SuggestPlayer[]) => {
    for (const [cid, pid] of suggestCast(chars.filter(c => isFree(c.id)), people, nameOf)) put(cid, pid)
  }
  round(adults, inGroup("adult"))
  round(students, inGroup("student"))
  const strays = new Set([...free.keys()].filter(id => groupOf.has(id)))
  round([...adults, ...students], [...free.values()])
  const moved = [...strays].filter(id => !free.has(id)).length
  if (moved > 0) notes.push(`${moved === 1 ? "1 hráč dostal" : `${moved} hráčů dostalo`} postavu mimo svou skupinu z losu, protože v ní nic volného nesedělo.`)
  if (free.size > 0) notes.push(`${free.size === 1 ? "1 hráč nemá" : `${free.size} hráčů nemá`} žádnou volnou postavu, která by seděla (odmítnutí, rod nebo cesta v přihlášce).`)
  return { assign, notes }
}
