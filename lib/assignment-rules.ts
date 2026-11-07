// Pravidla obsazení: pro postavu (specializace, původ, kruh, role v jednotce)
// nebo tým (jednotka) seznam povolených hodnot. Pravidla platí ve všech bězích.
// Role jde nastavit jen napevno (jedna hodnota = id role z unit_roles).
//
//   žádné pravidlo / všechny povolené  → libovolná
//   jedna povolená                     → napevno
//   všechny kromě jedné                → kterákoli až na X
//   jiná podmnožina                    → jen vyjmenované

export type RuleProperty = "specialization" | "origin" | "circle" | "role" | "unit"
export type RuleSubject = "character" | "team"

export type AssignmentRule = {
  subjectType: RuleSubject
  subjectId: string
  property: RuleProperty
  allowed: string[]
}

export const PROPERTY_SUBJECT: Record<RuleProperty, RuleSubject> = {
  specialization: "character",
  origin: "character",
  circle: "character",
  role: "character",
  unit: "team",
}

export type RuleOption = { value: string; label: string }

export type RuleKind = "any" | "fixed" | "except" | "some"

export const ruleKey = (subjectType: RuleSubject, subjectId: string, property: RuleProperty) =>
  `${subjectType}:${subjectId}:${property}`

/** Rychlé vyhledávání: klíč → povolené hodnoty. Chybějící klíč = libovolná. */
export function indexRules(rules: readonly AssignmentRule[]): Map<string, string[]> {
  return new Map(rules.map(r => [ruleKey(r.subjectType, r.subjectId, r.property), r.allowed]))
}

export function allowedValues(
  index: Map<string, string[]>, subjectType: RuleSubject, subjectId: string, property: RuleProperty,
): string[] | null {
  return index.get(ruleKey(subjectType, subjectId, property)) ?? null
}

export function isAllowed(
  index: Map<string, string[]>, subjectType: RuleSubject, subjectId: string, property: RuleProperty, value: string,
): boolean {
  const allowed = allowedValues(index, subjectType, subjectId, property)
  return allowed === null || allowed.includes(value)
}

/**
 * Normalizuje povolené hodnoty proti seznamu možností: zahodí neznámé,
 * seřadí podle možností. Vrací null, když jsou povolené všechny (= žádné pravidlo).
 */
export function normalizeAllowed(allowed: readonly string[], options: readonly RuleOption[]): string[] | null {
  const set = new Set(allowed)
  const kept = options.map(o => o.value).filter(v => set.has(v))
  return kept.length === options.length ? null : kept
}

export function describeRule(allowed: readonly string[] | null, options: readonly RuleOption[]): { kind: RuleKind; text: string } {
  const label = (v: string) => options.find(o => o.value === v)?.label ?? v
  if (allowed === null || allowed.length >= options.length) return { kind: "any", text: "Libovolná" }
  if (allowed.length === 1) return { kind: "fixed", text: `Napevno: ${label(allowed[0])}` }
  const denied = options.filter(o => !allowed.includes(o.value))
  if (denied.length === 1) return { kind: "except", text: `Kromě: ${denied[0].label}` }
  return { kind: "some", text: `Jen: ${allowed.map(label).join(", ")}` }
}

/** Validace vstupu z Přípravy. Vrací text chyby nebo null. */
export function validateRuleInput(
  body: unknown,
  ids: { characterIds: readonly string[]; teamIds: readonly string[] },
  optionsFor: (p: RuleProperty) => readonly RuleOption[],
): string | null {
  if (typeof body !== "object" || body === null) return "Neplatné tělo požadavku"
  const b = body as Record<string, unknown>
  const property = b.property
  if (property !== "specialization" && property !== "origin" && property !== "circle" && property !== "role" && property !== "unit") return "Neznámá vlastnost"
  const subjectType = PROPERTY_SUBJECT[property]
  if (b.subjectType !== subjectType) return "Vlastnost nepatří k tomuto typu"
  const subjects = subjectType === "character" ? ids.characterIds : ids.teamIds
  if (typeof b.subjectId !== "string" || !subjects.includes(b.subjectId)) return "Neznámá postava nebo tým"
  if (b.allowed === null) return null
  if (!Array.isArray(b.allowed)) return "Povolené hodnoty musí být seznam"
  const values = optionsFor(property).map(o => o.value)
  if (!b.allowed.every(v => typeof v === "string" && values.includes(v))) return "Neznámá hodnota"
  if (new Set(b.allowed).size !== b.allowed.length) return "Hodnota je v seznamu dvakrát"
  if (b.allowed.length === 0) return "Aspoň jedna hodnota musí zůstat povolená"
  if (property === "role" && b.allowed.length !== 1) return "Role jde nastavit jen napevno"
  return null
}

/** Hodnoty, které pravidlo určuje jednoznačně (napevno) a postava je ještě nemá. */
export function pendingFixedValues(
  index: Map<string, string[]>,
  characters: readonly { id: string; specialization?: string; origin?: string; circleIds: string[] }[],
): { characterId: string; property: "specialization" | "origin" | "circle"; value: string }[] {
  const out: { characterId: string; property: "specialization" | "origin" | "circle"; value: string }[] = []
  for (const c of characters) {
    const current = {
      specialization: c.specialization,
      origin: c.origin,
      circle: c.circleIds.length === 1 ? c.circleIds[0] : undefined,
    }
    for (const property of ["specialization", "origin", "circle"] as const) {
      const allowed = allowedValues(index, "character", c.id, property)
      if (allowed?.length === 1 && current[property] !== allowed[0]) {
        out.push({ characterId: c.id, property, value: allowed[0] })
      }
    }
  }
  return out
}
