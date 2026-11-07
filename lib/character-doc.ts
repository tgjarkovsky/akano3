// Skládání spisu postavy pro jeden běh (viz docs/superpowers/specs/2026-11-06-dokumenty-postav-design.md,
// oddíl Skládání dokumentu). Čistá funkce: dostane obsazení a texty, vrátí kapitoly
// v pevném pořadí. Prázdné texty a kapitoly bez textu vynechá.

import { countSections } from "./doc-fields.ts"

export type DocVisibility = "self" | "team" | "unit" | "circle" | "public" | "prelarp"

/** Tři úrovně, které vidí hráč. Kdo přesně skupinu tvoří, říká kapitola. */
export type DocLevel = "self" | "group" | "public"

export const DOC_LEVEL: Record<DocVisibility, DocLevel> = {
  self: "self",
  team: "group", unit: "group", circle: "group",
  public: "public", prelarp: "public",
}

export const DOC_LEVEL_LABELS: Record<DocLevel, string> = {
  self: "jen ty",
  group: "skupinové",
  public: "veřejné",
}

/** Jak se text sází: příběh ve 3. osobě, vnitřní hlas v 1. osobě, ostatní běžně. */
export type DocVoice = "story" | "inner"

export type DocBlock = {
  key: string
  title: string
  body: string
  visibility: DocVisibility
  voice?: DocVoice
  /** stav textu v Přípravě; hráčům se neposílá */
  approved?: boolean
}

export type DocChapter = { key: string; kicker: string; title: string; blocks: DocBlock[] }

export type CharacterDoc = {
  runName: string
  /** termín běhu pro hráče, např. „12.–14. června 2027“ */
  runDate?: string
  character: { id: string; name: string }
  header: {
    team?: string
    teammates: string[]
    unit?: string
    specialization?: string
    origin?: string
    circle?: string
  }
  chapters: DocChapter[]
}

export type StoredText = { body: string; status: string | null }
export type TextLookup = (entityType: string, entityId: string, field: string) => StoredText | undefined

type Named = { id: string; name: string }
type Trait = { id: string; label: string }

export type DocInput = {
  runName: string
  runDate?: string
  character: { id: string; name: string }
  team?: Named & { teammates: string[] }
  unit?: Named
  circle?: Named
  /** id ve tvaru „specialization:combat“, stejně jako entity textů */
  specialization?: Trait
  origin?: Trait
  text: TextLookup
}

// Pořadí a nadpisy textů jádra. Tři otázky jdou za vnitřním světem.
// Pole „legends“ (3. osoba) se hráči ukazuje jako Příběh, s víc oddíly ## jako Příběhy.
const CORE: [field: string, title: string][] = [
  ["medallion",     "Medailonek"],
  ["legends",       "Příběh"],
  ["inner_world",   "Vnitřní svět"],
  ["why_hunter",    "Proč se potřebuji stát lovcem?"],
  ["other_wants",   "Co dalšího chci?"],
  ["stands_out",    "Čím vystupuju z řady?"],
  ["summary",       "Shrnutí"],
  ["relationships", "Vztahy"],
  ["questions",     "Otázky do hry"],
]

const VOICE: Record<string, DocVoice> = { legends: "story", inner_world: "inner" }

export function composeCharacterDoc(input: DocInput): CharacterDoc {
  const { character, team, unit, circle, specialization, origin, text } = input

  const block = (type: string, id: string, field: string, title: string, visibility: DocVisibility): DocBlock[] => {
    const t = text(type, id, field)
    if (!t || !t.body.trim()) return []
    if (type === "character" && field === "legends" && countSections(t.body) > 1) title = "Příběhy"
    const voice: DocVoice | undefined = type === "character" ? VOICE[field] : undefined
    return [{
      key: `${type}:${id}:${field}`, title, body: t.body.trim(), visibility,
      ...(voice ? { voice } : {}), approved: t.status === "approved",
    }]
  }

  const chapters: DocChapter[] = [
    {
      key: "core", kicker: "Jádro postavy", title: "Já",
      blocks: CORE.flatMap(([field, title]) => block("character", character.id, field, title, field === "medallion" ? "prelarp" : "self")),
    },
  ]
  if (team) chapters.push({
    key: "team", kicker: "Tvůj tým", title: team.name,
    blocks: [
      ...block("team", team.id, "medallion", "Medailonek", "prelarp"),
      ...block("team", team.id, "public", "Co o vás vědí všichni", "public"),
      ...block("team", team.id, "internal", "Jen mezi vámi", "team"),
    ],
  })
  if (unit) chapters.push({
    key: "unit", kicker: "Tvoje jednotka", title: unit.name,
    blocks: [
      ...block("unit", unit.id, "medallion", "Medailonek", "prelarp"),
      ...block("unit", unit.id, "public", "Co o jednotce vědí všichni", "public"),
      ...block("unit", unit.id, "internal", "Jen v jednotce", "unit"),
    ],
  })
  if (circle) chapters.push({
    key: "circle", kicker: "Tvůj kruh", title: circle.name,
    blocks: [
      ...block("circle", circle.id, "medallion", "Medailonek", "prelarp"),
      ...block("circle", circle.id, "public", "Co o kruhu vědí všichni", "public"),
      ...block("circle", circle.id, "internal", "Společné", "circle"),
    ],
  })
  chapters.push({
    key: "traits", kicker: "Zařazení", title: "Specializace a původ",
    blocks: [
      ...(specialization ? block("trait", specialization.id, "public", `Specializace: ${specialization.label}`, "public") : []),
      ...(origin ? block("trait", origin.id, "public", `Původ: ${origin.label}`, "public") : []),
    ],
  })

  return {
    runName: input.runName,
    ...(input.runDate ? { runDate: input.runDate } : {}),
    character: { id: character.id, name: character.name },
    header: {
      team: team?.name,
      teammates: team?.teammates ?? [],
      unit: unit?.name,
      specialization: specialization?.label,
      origin: origin?.label,
      circle: circle?.name,
    },
    chapters: chapters.filter(c => c.blocks.length > 0),
  }
}

/** Spis pro hráče: bez stavů textů z Přípravy. */
export function forPlayer(doc: CharacterDoc): CharacterDoc {
  return {
    ...doc,
    chapters: doc.chapters.map(c => ({
      ...c,
      blocks: c.blocks.map(({ approved: _approved, ...rest }) => rest),
    })),
  }
}

/** Počet textů ve spisu a kolik z nich ještě není schválených. */
export function docStats(doc: CharacterDoc): { blocks: number; notApproved: number } {
  const blocks = doc.chapters.flatMap(c => c.blocks)
  return { blocks: blocks.length, notApproved: blocks.filter(b => !b.approved).length }
}

// ── Tajné odkazy na spis ──────────────────────────────────────────────

/** Odkaz je 18 náhodných bajtů v base64url, tedy 24 znaků. */
export const SPIS_TOKEN = /^[A-Za-z0-9_-]{24}$/
export const isSpisToken = (v: unknown): v is string => typeof v === "string" && SPIS_TOKEN.test(v)

// ── Termín běhu ───────────────────────────────────────────────────────

const MONTHS = ["ledna", "února", "března", "dubna", "května", "června", "července", "srpna", "září", "října", "listopadu", "prosince"]
const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/

export const isIsoDate = (v: unknown): v is string => {
  if (typeof v !== "string") return false
  const m = v.match(ISO_DATE)
  if (!m) return false
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]))
  return d.getUTCFullYear() === +m[1] && d.getUTCMonth() === +m[2] - 1 && d.getUTCDate() === +m[3]
}

/** „12.–14. června 2027“, „30. června – 2. července 2027“, „5. května 2027“. */
export function formatRunDate(start: string | null | undefined, end?: string | null): string | undefined {
  if (!isIsoDate(start)) return undefined
  const [y1, m1, d1] = start.split("-").map(Number)
  if (!isIsoDate(end) || end <= start) return `${d1}. ${MONTHS[m1 - 1]} ${y1}`
  const [y2, m2, d2] = end.split("-").map(Number)
  if (y1 !== y2) return `${d1}. ${MONTHS[m1 - 1]} ${y1} – ${d2}. ${MONTHS[m2 - 1]} ${y2}`
  if (m1 !== m2) return `${d1}. ${MONTHS[m1 - 1]} – ${d2}. ${MONTHS[m2 - 1]} ${y2}`
  return `${d1}.–${d2}. ${MONTHS[m2 - 1]} ${y2}`
}

// ── Osobní knihovna: akademie ─────────────────────────────────────────
// Ostatní týmy, jednotky a kruhy vidí hráč jen přes medailonek a veřejný text.
// Interní texty sem nikdy nejdou, ani u vlastních skupin (ty má hráč ve spisu).

export type AcademyKind = "team" | "unit" | "circle"

export type AcademyEntry = {
  kind: AcademyKind
  id: string
  name: string
  /** krátký řádek pod jménem: členové týmu, týmy jednotky, počet v kruhu */
  sub?: string
  /** je to hráčova vlastní skupina (odkaz vede na kapitolu spisu) */
  mine: boolean
  blocks: DocBlock[]
}

export type AcademyInput = {
  groups: { kind: AcademyKind; id: string; name: string; sub?: string }[]
  mine: Partial<Record<AcademyKind, string>>
  text: TextLookup
}

export function composeAcademy({ groups, mine, text }: AcademyInput): AcademyEntry[] {
  return groups.map(g => {
    const blocks: DocBlock[] = []
    for (const [field, title, visibility] of [
      ["medallion", "Medailonek", "prelarp"],
      ["public", "Co vědí všichni", "public"],
    ] as const) {
      const t = text(g.kind, g.id, field)
      if (t && t.body.trim()) blocks.push({ key: `${g.kind}:${g.id}:${field}`, title, body: t.body.trim(), visibility })
    }
    return { kind: g.kind, id: g.id, name: g.name, ...(g.sub ? { sub: g.sub } : {}), mine: mine[g.kind] === g.id, blocks }
  })
}

/** Ukázka textu na kartu: bez úsloví a nadpisů, bez značek, zkrácená na celé slovo. */
export function excerpt(body: string, max = 160): string {
  const plain = body.split("\n")
    .filter(l => l.trim() && !/^\s*(>|#|-{3,}\s*$)/.test(l))
    .join(" ")
    .replace(/\[\[\s*[a-z0-9-]+\s*\|([^\]]*)\]\]/g, "$1")
    .replace(/\[\[\s*([a-z0-9-]+)\s*\]\]/g, "$1")
    .replace(/\*+/g, "")
    .replace(/^[-–]\s+/, "")
    .replace(/\s+/g, " ")
    .trim()
  if (plain.length <= max) return plain
  const cut = plain.slice(0, max + 1)
  const space = cut.lastIndexOf(" ")
  return `${(space > max * 0.6 ? cut.slice(0, space) : plain.slice(0, max)).replace(/[\s,;:–-]+$/, "")}…`
}

/** „1 člověk“, „3 lidé“, „5 lidí“. */
export function peopleCount(n: number): string {
  return n === 1 ? "1 člověk" : n >= 2 && n <= 4 ? `${n} lidé` : `${n} lidí`
}
