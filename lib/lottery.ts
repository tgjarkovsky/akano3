import { suggestCast, suggestScore, playerName, type CastCharacter } from "./cast.ts"
import type { Prihlaska } from "./prihlaska.ts"

// Losování obsazení běhu z nových přihlášek. Bez databáze, ať jde testovat.
// Ze stejného osudí a seedu vyjde vždy stejný výsledek, takže los jde doložit.
//
//  A1  Nakamura: los mezi zrakově postiženými (s cestou dospělého), jinak běžně v A2.
//  A2  Dospělé role: náhodné pořadí lidí s cestou dospělého, shora kdo se vejde,
//      rozdělení na postavy podle preferencí.
//  B1  Studenti: náhodné pořadí všech zbylých se studentskou nebo týmovou cestou;
//      prvních tolik, kolik je studentských postav, je vylosovaných.
//  B2  Týmy (nejvýš 5): shora kompletní vylosované trojice, pak vylosované dvojice
//      doplněné o třetího. Tým podle toho, koho si kdo v přihlášce vybral.
//  B3  Kdo jede jen s týmem a sám bez trojice, se přeskočí (místo jde dál).
//  B4  Zbylé studentské postavy shora dalšími v pořadí podle preferencí.
//  C   Zbytek pořadí jsou náhradníci; kdo náhradníkem být nechce, nejede.

export type LotteryEntry = { id: number; data: Prihlaska; teamGroup: number | null }

type NameOf = Parameters<typeof suggestScore>[2]

export type LotteryInput = {
  entries: readonly LotteryEntry[]
  /** dospělé postavy včetně Nakamury */
  adults: readonly (CastCharacter & { name: string })[]
  /** studentské postavy (s týmem) */
  students: readonly (CastCharacter & { name: string })[]
  teams: readonly { id: string; name: string; memberIds: readonly string[] }[]
  nakamuraId: string
  seed: number
  nameOf: NameOf
  maxTeams?: number
}

export type LotteryVia = "nakamura" | "adult" | "team" | "student"
export type LotteryLine = { level: "info" | "warn"; text: string }

export type LotteryResult = {
  seed: number
  cast: { characterId: string; prihlaskaId: number; via: LotteryVia }[]
  /** náhradníci v pořadí losu (první = první na řadě) */
  substitutes: number[]
  /** nevylosovaní, kteří náhradníky být nechtějí */
  declined: number[]
  /** náhodná pořadí, jak padla */
  adultOrder: number[]
  studentOrder: number[]
  /** krok za krokem, proč kdo kam */
  log: LotteryLine[]
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

/** Dají se všichni lidé rozdělit na různé postavy z povolených dvojic? (Kuhnův algoritmus) */
function fitsAll(people: readonly LotteryEntry[], chars: readonly CastCharacter[], nameOf: NameOf): boolean {
  if (people.length > chars.length) return false
  const ok = people.map(p => chars.map(c => suggestScore(p.data, c, nameOf) !== null))
  const owner = new Array<number>(chars.length).fill(-1)
  const tryPerson = (i: number, seen: boolean[]): boolean => {
    for (let j = 0; j < chars.length; j++) {
      if (!ok[i][j] || seen[j]) continue
      seen[j] = true
      if (owner[j] === -1 || tryPerson(owner[j], seen)) { owner[j] = i; return true }
    }
    return false
  }
  return people.every((_, i) => tryPerson(i, new Array(chars.length).fill(false)))
}

export function runLottery(input: LotteryInput): LotteryResult {
  const { entries, adults, students, teams, nakamuraId, seed, nameOf } = input
  const maxTeams = input.maxTeams ?? 5
  const rand = rng(seed)
  const log: LotteryLine[] = []
  const info = (text: string) => log.push({ level: "info", text })
  const warn = (text: string) => log.push({ level: "warn", text })
  const name = (e: LotteryEntry) => playerName(e.data)
  const charName = new Map([...adults, ...students].map(c => [c.id, c.name]))
  const cast: LotteryResult["cast"] = []
  const used = new Set<number>()
  const place = (characterId: string, e: LotteryEntry, via: LotteryVia) => {
    cast.push({ characterId, prihlaskaId: e.id, via })
    used.add(e.id)
  }

  const unpaired = entries.filter(e => e.data.paths.team && e.teamGroup === null).length
  if (unpaired > 0) warn(`${unpaired === 1 ? "1 přihláška s týmem nemá" : `${unpaired} přihlášek s týmem nemá`} spárovanou trojici (Přihlášky → Spárovat trojice), ${unpaired === 1 ? "losuje se jako jednotlivec" : "losují se jako jednotlivci"}.`)

  // ── A1 Nakamura ──
  const nakamura = adults.find(c => c.id === nakamuraId)
  const freeAdults = adults.filter(c => c.id !== nakamuraId)
  if (nakamura) {
    const vision = entries.filter(e => e.data.paths.adult && e.data.visionImpaired && suggestScore(e.data, nakamura, nameOf) !== null)
    if (vision.length > 0) {
      const pick = vision[Math.floor(rand() * vision.length)]
      place(nakamura.id, pick, "nakamura")
      info(`${nakamura.name}: ${vision.length === 1 ? "jediný zrakově postižený hráč" : `los mezi ${vision.length} zrakově postiženými`}, vylosován(a) ${name(pick)}.`)
    } else {
      freeAdults.unshift(nakamura)
      info(`${nakamura.name}: nikdo se zrakovým postižením se nehlásí, obsadí se jako ostatní dospělé role.`)
    }
  }

  // ── A2 Dospělé role ──
  const adultOrder = shuffle(entries.filter(e => e.data.paths.adult && !used.has(e.id)), rand)
  const chosenAdults: LotteryEntry[] = []
  for (const e of adultOrder) {
    if (chosenAdults.length >= freeAdults.length) break
    if (fitsAll([...chosenAdults, e], freeAdults, nameOf)) chosenAdults.push(e)
    else info(`${name(e)} se na zbylé dospělé role nevejde (odmítnutí nebo rod), jde do losu studentů.`)
  }
  for (const [cid, pid] of suggestCast(freeAdults, chosenAdults.map(e => ({ id: e.id, data: e.data, characterId: null })), nameOf)) {
    place(cid, chosenAdults.find(e => e.id === pid)!, "adult")
  }
  info(`Dospělé role (${freeAdults.length}): vylosováno ${chosenAdults.length} z ${adultOrder.length} v osudí.`)
  if (chosenAdults.length < freeAdults.length) warn(`Na dospělé role nezbyl nikdo pro ${freeAdults.length - chosenAdults.length} postav.`)

  // ── B1 Pořadí studentů ──
  const studentOrder = shuffle(entries.filter(e => (e.data.paths.student || e.data.paths.team) && !used.has(e.id)), rand)
  const drawn = new Set(studentOrder.slice(0, students.length).map(e => e.id))
  info(`Studentské role (${students.length}): v osudí ${studentOrder.length}, vylosováno prvních ${Math.min(students.length, studentOrder.length)}.`)

  // ── B2 Týmy ──
  const groups = new Map<number, LotteryEntry[]>()
  for (const e of studentOrder) if (e.teamGroup !== null && e.data.paths.team) groups.set(e.teamGroup, [...(groups.get(e.teamGroup) ?? []), e])
  const takenTeams = new Set<string>()
  /** trojice vylosované, ale bez týmu: jejich členové nejdou „jen s trojicí, která nevyšla“ */
  const noTeam = new Set<number>()
  let teamCount = 0
  const tryTeam = (members: LotteryEntry[], how: string): void => {
    let best: { team: typeof teams[number]; score: number; picks: string[] } | null = null
    for (const t of shuffle(teams.filter(t => !takenTeams.has(t.id)), rand)) {
      const picks = members.map(m => m.data.team.picks[t.id])
      if (picks.some(p => !p || !t.memberIds.includes(p)) || new Set(picks).size !== members.length) continue
      const scores = members.map((m, i) => suggestScore(m.data, students.find(c => c.id === picks[i])!, nameOf))
      if (scores.some(s => s === null)) continue
      const score = scores.reduce<number>((a, s) => a + s!, 0)
      if (!best || score > best.score) best = { team: t, score, picks }
    }
    const who = members.map(name).join(", ")
    if (!best) {
      const common = teams.filter(t => members.every(m => m.data.team.picks[t.id]))
      const why = common.length === 0 ? "nikdo z nich si nevybral stejný tým"
        : common.every(t => takenTeams.has(t.id)) ? `${common.map(t => t.name).join(", ")} už ${common.length === 1 ? "je obsazený" : "jsou obsazené"}`
        : `v ${common.map(t => t.name).join(", ")} si nevybrali různé postavy, nebo někomu postava nesedí (odmítnutí, rod)`
      members.forEach(m => noTeam.add(m.id))
      warn(`Trojice ${who} (${how}) nedostala tým: ${why}. Jdou jako jednotlivci.`)
      return
    }
    takenTeams.add(best.team.id)
    teamCount++
    members.forEach((m, i) => place(best!.picks[i], m, "team"))
    info(`${best.team.name}: trojice ${how}, ${members.map((m, i) => `${name(m)} → ${charName.get(best!.picks[i])}`).join(", ")}.`)
  }
  const complete = (g: LotteryEntry[]) => g.length === 3 && g.every(m => !used.has(m.id))
  const seenGroups = new Set<number>()
  for (const e of studentOrder) {
    if (teamCount >= maxTeams) break
    const g = e.teamGroup !== null ? groups.get(e.teamGroup) : undefined
    if (!g || seenGroups.has(e.teamGroup!) || !complete(g) || !g.every(m => drawn.has(m.id))) continue
    seenGroups.add(e.teamGroup!)
    tryTeam(g, "vylosovaná celá")
  }
  for (const e of studentOrder) {
    if (teamCount >= maxTeams) break
    const g = e.teamGroup !== null ? groups.get(e.teamGroup) : undefined
    if (!g || seenGroups.has(e.teamGroup!) || !complete(g) || g.filter(m => drawn.has(m.id)).length !== 2) continue
    seenGroups.add(e.teamGroup!)
    const third = g.find(m => !drawn.has(m.id))!
    tryTeam(g, `vylosovaní dva, doplněn(a) ${name(third)}`)
  }
  if (teamCount >= maxTeams) info(`Dosažen limit ${maxTeams} týmů, další trojice jdou jako jednotlivci.`)

  // ── B3 + B4 Zbylé studentské postavy ──
  const teamChars = new Set(teams.filter(t => takenTeams.has(t.id)).flatMap(t => t.memberIds))
  const freeStudents = students.filter(c => !teamChars.has(c.id))
  const singles: LotteryEntry[] = []
  for (const e of studentOrder) {
    if (singles.length >= freeStudents.length) break
    if (used.has(e.id)) continue
    if (!e.data.paths.student && !e.data.team.solo) {
      if (drawn.has(e.id)) info(noTeam.has(e.id)
        ? `${name(e)} jede jen s trojicí, ta tým nedostala; místo přechází na dalšího v pořadí.`
        : `${name(e)} jede jen s trojicí, ta vylosovaná není; místo přechází na dalšího v pořadí.`)
      continue
    }
    if (fitsAll([...singles, e], freeStudents, nameOf)) singles.push(e)
    else info(`${name(e)} se na zbylé studentské postavy nevejde (odmítnutí nebo rod), místo přechází dál.`)
  }
  for (const [cid, pid] of suggestCast(freeStudents, singles.map(e => ({ id: e.id, data: e.data, characterId: null })), nameOf)) {
    place(cid, singles.find(e => e.id === pid)!, "student")
  }
  info(`Jednotlivě obsazeno ${singles.length} z ${freeStudents.length} zbylých studentských postav.`)
  if (singles.length < freeStudents.length) warn(`Bez hráče zůstává ${freeStudents.length - singles.length} studentských postav, v osudí už nikdo nesedí.`)

  // ── C Náhradníci ──
  const rest = [
    ...studentOrder.filter(e => !used.has(e.id)),
    ...adultOrder.filter(e => !used.has(e.id) && !studentOrder.includes(e)),
  ]
  const substitutes = rest.filter(e => e.data.substitute !== "no").map(e => e.id)
  const declined = rest.filter(e => e.data.substitute === "no").map(e => e.id)
  info(`Náhradníci v pořadí losu: ${substitutes.length}${declined.length ? `, ${declined.length} náhradníky být nechtějí (nejedou)` : ""}.`)

  return { seed, cast, substitutes, declined, adultOrder: adultOrder.map(e => e.id), studentOrder: studentOrder.map(e => e.id), log }
}
