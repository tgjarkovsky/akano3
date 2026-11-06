// Skládání spisu postavy pro jeden běh (viz docs/superpowers/specs/2026-11-06-dokumenty-postav-design.md,
// oddíl Skládání dokumentu). Čistá funkce: dostane obsazení a texty, vrátí kapitoly
// v pevném pořadí. Prázdné texty a kapitoly bez textu vynechá.

export type DocVisibility = "self" | "team" | "unit" | "circle" | "public"

export const DOC_VISIBILITY_LABELS: Record<DocVisibility, string> = {
  self: "jen ty",
  team: "tvůj tým",
  unit: "tvoje jednotka",
  circle: "tvůj kruh",
  public: "veřejné",
}

export type DocBlock = {
  key: string
  title: string
  body: string
  visibility: DocVisibility
  /** stav textu v Přípravě; hráčům se neposílá */
  approved?: boolean
}

export type DocChapter = { key: string; kicker: string; title: string; blocks: DocBlock[] }

export type CharacterDoc = {
  runName: string
  character: { id: string; name: string; nickname?: string }
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
  character: { id: string; name: string; nickname?: string }
  team?: Named & { teammates: string[] }
  unit?: Named
  circle?: Named
  /** id ve tvaru „specialization:combat“, stejně jako entity textů */
  specialization?: Trait
  origin?: Trait
  text: TextLookup
}

// Pořadí a nadpisy textů jádra. Tři otázky jdou za vnitřním světem.
const CORE: [field: string, title: string][] = [
  ["legends",       "Legendy"],
  ["inner_world",   "Vnitřní svět"],
  ["why_hunter",    "Proč se potřebuji stát lovcem?"],
  ["other_wants",   "Co dalšího chci?"],
  ["stands_out",    "Čím vystupuju z řady?"],
  ["summary",       "Shrnutí"],
  ["relationships", "Vztahy"],
  ["questions",     "Otázky do hry"],
]

export function composeCharacterDoc(input: DocInput): CharacterDoc {
  const { character, team, unit, circle, specialization, origin, text } = input

  const block = (type: string, id: string, field: string, title: string, visibility: DocVisibility): DocBlock[] => {
    const t = text(type, id, field)
    if (!t || !t.body.trim()) return []
    return [{ key: `${type}:${id}:${field}`, title, body: t.body.trim(), visibility, approved: t.status === "approved" }]
  }

  const chapters: DocChapter[] = [
    {
      key: "core", kicker: "Jádro postavy", title: "Já",
      blocks: CORE.flatMap(([field, title]) => block("character", character.id, field, title, "self")),
    },
  ]
  if (team) chapters.push({
    key: "team", kicker: "Tvůj tým", title: team.name,
    blocks: [
      ...block("team", team.id, "public", "Co o vás ví každý", "public"),
      ...block("team", team.id, "internal", "Jen mezi vámi", "team"),
    ],
  })
  if (unit) chapters.push({
    key: "unit", kicker: "Tvoje jednotka", title: unit.name,
    blocks: [
      ...block("unit", unit.id, "public", "Co o jednotce ví každý", "public"),
      ...block("unit", unit.id, "internal", "Jen v jednotce", "unit"),
    ],
  })
  if (circle) chapters.push({
    key: "circle", kicker: "Tvůj kruh", title: circle.name,
    blocks: [
      ...block("circle", circle.id, "public", "Co o kruhu ví každý", "public"),
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
    character: { id: character.id, name: character.name, ...(character.nickname ? { nickname: character.nickname } : {}) },
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
      blocks: c.blocks.map(({ key, title, body, visibility }) => ({ key, title, body, visibility })),
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
