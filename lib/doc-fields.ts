// Textová pole dokumentů postav (viz docs/superpowers/specs/2026-11-06-dokumenty-postav-design.md).
// Každá entita má pevný seznam polí; stav se vede pro každé pole zvlášť.

export type DocEntityType = "character" | "team" | "unit" | "role" | "circle" | "trait"
export type Visibility = "private" | "internal" | "public" | "prelarp"

export type DocField = {
  key: string
  label: string
  /** krátká nápověda pro autora */
  hint: string
  visibility: Visibility
  /** pole s více oddíly (např. víc legend): každý začíná nadpisem „## Název“ */
  sections?: { singular: string }
}

export const DOC_FIELDS: Record<DocEntityType, DocField[]> = {
  character: [
    { key: "medallion", label: "Medailonek", hint: "Co o postavě vědí lidi už před přihláškou na larp (web). Krátký odstavec.", visibility: "prelarp" },
    { key: "legends",     label: "Legendy",       hint: "Důležité momenty ze života postavy, ve 3. osobě. Každou legendu začni nadpisem ## Název.", visibility: "private", sections: { singular: "legenda" } },
    { key: "inner_world", label: "Vnitřní svět",  hint: "Jak postava přemýšlí, v 1. osobě.",               visibility: "private" },
    { key: "summary",     label: "Shrnutí",       hint: "To nejdůležitější v bodech.",                     visibility: "private" },
    { key: "relationships", label: "Vztahy",      hint: "Zatím jako text: pod ### jménem popis vztahu. Později se převede na strukturované vztahy.", visibility: "private" },
    { key: "questions",   label: "Otázky",        hint: "Otázky, které hráči pomůžou rozvinout hru.",       visibility: "private" },
    { key: "why_hunter",  label: "Proč lovcem",   hint: "Proč se potřebuji stát lovcem?",                  visibility: "private" },
    { key: "other_wants", label: "Co dalšího chci", hint: "Co dalšího chci, mimo to stát se lovcem?",      visibility: "private" },
    { key: "stands_out",  label: "Čím vystupuju", hint: "Čím vystupuju z řady?",                           visibility: "private" },
  ],
  team: [
    { key: "medallion", label: "Medailonek", hint: "Co o týmu vědí lidi už před přihláškou na larp (web). Krátký odstavec.", visibility: "prelarp" },
    { key: "public",   label: "Veřejné", hint: "Co o týmu vědí na larpu všechny postavy. Platí ve všech bězích, nezmiňuj jednotku.", visibility: "public" },
    { key: "internal", label: "Interní", hint: "Co ví jen členové týmu. Platí ve všech bězích.",              visibility: "internal" },
  ],
  unit: [
    { key: "medallion", label: "Medailonek", hint: "Co o jednotce vědí lidi už před přihláškou na larp (web). Krátký odstavec.", visibility: "prelarp" },
    { key: "public",   label: "Veřejné", hint: "Co o jednotce vědí na larpu všechny postavy. Lidi z jednotky piš šablonou, mění se mezi běhy.", visibility: "public" },
    { key: "internal", label: "Interní", hint: "Co ví jen členové jednotky. Lidi z jednotky piš šablonou.",               visibility: "internal" },
  ],
  role: [
    { key: "personal", label: "Osobní", hint: "Co ví jen držitel role. Roli může v různých bězích držet kdokoli z týmu.", visibility: "private" },
  ],
  circle: [
    { key: "medallion", label: "Medailonek", hint: "Co o kruhu vědí lidi už před přihláškou na larp (web). Krátký odstavec.", visibility: "prelarp" },
    { key: "public",   label: "Veřejné",  hint: "Co o kruhu vědí na larpu všechny postavy.",  visibility: "public" },
    { key: "internal", label: "Společné", hint: "Co ví jen členové kruhu.", visibility: "internal" },
  ],
  trait: [
    { key: "public", label: "Popis", hint: "Krátký veřejný popis specializace nebo původu.", visibility: "public" },
  ],
}

export const VISIBILITY_LABELS: Record<Visibility, string> = {
  private: "jen hráč",
  internal: "jen členové",
  public: "veřejné",
  prelarp: "před hrou",
}

export const isDocEntityType = (t: unknown): t is DocEntityType =>
  typeof t === "string" && Object.hasOwn(DOC_FIELDS, t)

export const fieldsOf = (type: DocEntityType) => DOC_FIELDS[type]

export function isDocField(type: unknown, field: unknown): boolean {
  return typeof type === "string" && Object.hasOwn(DOC_FIELDS, type) &&
    DOC_FIELDS[type as DocEntityType].some(f => f.key === field)
}

export const docKey = (type: DocEntityType, entityId: string, field: string) => `${type}:${entityId}:${field}`

/** Počet oddílů (nadpisů „## “) v textu pole s více oddíly. */
export function countSections(body: string): number {
  return body.split("\n").filter(l => /^## \S/.test(l)).length
}

/** Text s připojeným dalším oddílem; vrací i pozici kurzoru za nadpisem. */
export function appendSection(body: string, singular: string): { body: string; cursor: number } {
  const n = countSections(body) + 1
  const title = `${singular.charAt(0).toUpperCase()}${singular.slice(1)} ${n}`
  const trimmed = body.replace(/\s+$/, "")
  const prefix = trimmed ? `${trimmed}\n\n` : ""
  const next = `${prefix}## ${title}\n\n`
  return { body: next, cursor: next.length }
}
