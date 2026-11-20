import type { Prihlaska } from "./prihlaska.ts"

// Trojice z přihlášek: kdo se hlásil spolu jako tým. Formulář má jen volný text
// „S kým se hlásíš“, proto Příprava trojice propojí (prihlasky.team_group) a tady
// je návrh propojení podle jmen. Bez databáze, ať jde testovat.

export const MAX_GROUP = 3

type Entry = { id: number; data: Pick<Prihlaska, "firstName" | "lastName" | "nickname" | "paths" | "team"> }

/** Malá písmena bez diakritiky, jen slova oddělená mezerou. */
export const normalizeName = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim()

/** Zmiňuje text `mates` člověka `who`? Celé jméno, nebo jméno i příjmení jako samostatná slova. */
export function mentions(mates: string, who: Entry["data"]): boolean {
  const words = new Set(normalizeName(mates).split(" "))
  const first = normalizeName(who.firstName), last = normalizeName(who.lastName)
  if (!first || !last) return false
  const lastWords = last.split(" ")
  return words.has(first.split(" ")[0]) && lastWords.every(w => words.has(w))
}

/**
 * Návrh trojic: týmové přihlášky bez skupiny propojené tím, že aspoň jedna
 * strana zmiňuje druhou. Souvislé skupiny 2–3 lidí jsou návrh, větší jsou
 * nejednoznačné a vrací se zvlášť k ručnímu rozřešení.
 */
export function suggestGroups(entries: readonly Entry[]): { groups: number[][]; ambiguous: number[][] } {
  const team = entries.filter(e => e.data.paths.team)
  const parent = new Map(team.map(e => [e.id, e.id]))
  const find = (x: number): number => { const p = parent.get(x)!; if (p === x) return x; const r = find(p); parent.set(x, r); return r }
  for (const a of team) for (const b of team) {
    if (a.id < b.id && (mentions(a.data.team.mates, b.data) || mentions(b.data.team.mates, a.data))) parent.set(find(a.id), find(b.id))
  }
  const comps = new Map<number, number[]>()
  for (const e of team) {
    const r = find(e.id)
    comps.set(r, [...(comps.get(r) ?? []), e.id])
  }
  const groups: number[][] = [], ambiguous: number[][] = []
  for (const c of comps.values()) {
    if (c.length < 2) continue
    const sorted = [...c].sort((x, y) => x - y)
    ;(c.length <= MAX_GROUP ? groups : ambiguous).push(sorted)
  }
  const byFirst = (x: number[], y: number[]) => x[0] - y[0]
  return { groups: groups.sort(byFirst), ambiguous: ambiguous.sort(byFirst) }
}

/** Kontrola skupiny před uložením: 2–3 různé týmové přihlášky. */
export function checkGroup(ids: readonly number[], entries: readonly Entry[]): string | null {
  if (new Set(ids).size !== ids.length) return "Přihláška je ve skupině dvakrát"
  if (ids.length < 2 || ids.length > MAX_GROUP) return "Trojice má 2 až 3 lidi"
  for (const id of ids) {
    const e = entries.find(x => x.id === id)
    if (!e) return "Přihláška neexistuje"
    if (!e.data.paths.team) return `${e.data.firstName} ${e.data.lastName} se nehlásí s týmem`
  }
  return null
}
