import { CIRCLE_ONLY_GENDER, emptyPrefs, fitsGender, showsOtherCharacters, type Catalog, type CatalogEntry, type Prefs, type PrefKind, type Prihlaska, type RunChoice, type SubstituteChoice, type NewsletterChoice, type GenderChoice } from "@/lib/prihlaska"

// Rozpracovaná přihláška v prohlížeči. Na rozdíl od uložené smí mít prázdné
// volby; doplní je hráč, kontroluje server (lib/prihlaska.ts).

export type Draft = {
  firstName: string
  lastName: string
  nickname: string
  email: string
  phone: string
  adult: boolean | null
  run: RunChoice | ""
  substitute: SubstituteChoice | ""
  newsletter: NewsletterChoice | ""
  paths: { adult: boolean; team: boolean; student: boolean }
  genderPref: GenderChoice | ""
  /** picks: tým → postava, prázdný řetězec = tým vybraný, postava ještě ne */
  team: { mates: string; solo: boolean | null; picks: Record<string, string> }
  prefs: Prefs
  visionImpaired: boolean
  noteCasting: string
  noteOrg: string
}

export const emptyDraft = (): Draft => ({
  firstName: "", lastName: "", nickname: "", email: "", phone: "",
  adult: null, run: "", substitute: "", newsletter: "",
  paths: { adult: false, team: false, student: false },
  genderPref: "",
  team: { mates: "", solo: null, picks: {} },
  prefs: emptyPrefs(),
  visionImpaired: false, noteCasting: "", noteOrg: "",
})

export const draftOf = (p: Prihlaska): Draft => ({
  ...p, adult: true, genderPref: p.genderPref ?? "any",
  team: { mates: p.team.mates, solo: p.paths.team ? p.team.solo : null, picks: { ...p.team.picks } },
})

/** Obnoví koncept z localStorage; neznámý tvar zahodí. */
export function restoreDraft(raw: string | null): Draft | null {
  if (!raw) return null
  try {
    const d = JSON.parse(raw) as Partial<Draft>
    const base = emptyDraft()
    return {
      ...base, ...d,
      paths: { ...base.paths, ...d.paths },
      team: { ...base.team, ...d.team, picks: { ...d.team?.picks } },
      prefs: { ...base.prefs, ...d.prefs },
    }
  } catch {
    return null
  }
}

export type StepId = "uvod" | "udaje" | "cesta" | "dospeli" | "tym" | "postavy" | "prvky" | "souhrn"

export const STEPS: { id: StepId; label: string; when?: (d: Draft) => boolean }[] = [
  { id: "uvod", label: "Úvod" },
  { id: "udaje", label: "Údaje" },
  { id: "cesta", label: "Za co se hlásíš" },
  { id: "dospeli", label: "Dospělí", when: d => d.paths.adult },
  { id: "tym", label: "Tým", when: d => d.paths.team },
  { id: "postavy", label: "Studentské postavy", when: showsCharacters },
  { id: "prvky", label: "Jednotky a kruhy", when: d => d.paths.student || d.paths.team },
  { id: "souhrn", label: "Souhrn" },
]

export function showsCharacters(d: Draft): boolean { return showsOtherCharacters(d.paths, d.team) }

export const activeSteps = (d: Draft) => STEPS.filter(s => !s.when || s.when(d))
export const isStepId = (v: string): v is StepId => STEPS.some(s => s.id === v)

/** Co v kroku chybí, aby šlo pokračovat. Kontroly obsahu voleb dělá až server. */
export function stepError(step: StepId, d: Draft): string | null {
  if (step === "udaje") {
    if (!d.firstName.trim() || !d.lastName.trim()) return "Vyplň jméno a příjmení."
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.email.trim())) return "Vyplň platný e-mail."
    if (!/^\+?\d[\d ()-]{5,24}$/.test(d.phone.trim())) return "Vyplň telefon."
    if (!d.run) return "Vyber běh."
    if (d.adult === null) return "Odpověz, jestli ti bude 18 let."
    if (d.adult === false) return "Účast je možná jen pro plnoleté."
    if (!d.substitute) return "Vyber, jak dlouho chceš být na náhradnickém seznamu."
    if (!d.newsletter) return "Odpověz na otázku o newsletteru."
  }
  if (step === "cesta") {
    if (!d.paths.adult && !d.paths.team && !d.paths.student) return "Vyber, za co se hlásíš."
    if (!d.genderPref) return "Vyber, jaké postavy chceš hrát."
  }
  if (step === "tym") {
    if (!d.team.mates.trim()) return "Napiš, s kým se hlásíš."
    if (d.team.solo === null) return "Vyber, co když vylosují jen tebe."
    const picks = Object.values(d.team.picks)
    if (picks.length === 0) return "Vyber aspoň jeden tým."
    if (picks.some(p => !p)) return "U každého vybraného týmu vyber, koho budeš hrát."
  }
  return null
}

export type KindEntry = CatalogEntry & { gender?: "m" | "f" | null; teamId?: string; fixed?: string[] }

export function entriesOf(c: Catalog, kind: PrefKind): KindEntry[] {
  switch (kind) {
    case "adult": return c.adults
    case "character": return c.characters
    case "unit": return c.units
    case "circle": return c.circles
    case "specialization": return c.specializations
    case "origin": return c.origins
  }
}

export const KIND_ONE: Record<PrefKind, string> = {
  adult: "Dospělá postava",
  character: "Studentská postava",
  unit: "Jednotka",
  circle: "Kruh",
  specialization: "Specializace",
  origin: "Původ",
}

/** Postavy a dospělí, které hráč podle volby rodu uvidí. */
export function visibleEntries(c: Catalog, kind: PrefKind, pref: Draft["genderPref"]): KindEntry[] {
  const all = entriesOf(c, kind)
  if (kind === "character") return all.filter(e => fitsGender(pref, e.gender))
  if (kind === "adult") return all.filter(e => fitsGender(pref, ADULT_GENDER[e.facts.find(([k]) => k === "Gender")?.[1] ?? ""]))
  // kruh jen pro druhý rod (Kuchi-Kuchi, Rituální) hráč nedostane
  if (kind === "circle") return all.filter(e => fitsGender(pref, CIRCLE_ONLY_GENDER[e.id]))
  return all
}
const ADULT_GENDER: Record<string, "m" | "f"> = { muž: "m", žena: "f" }

/** Volby jen pro to, co hráč vidí; skryté postavy a dospělí se neodešlou. */
export function visiblePrefs(c: Catalog, d: Draft): Draft["prefs"] {
  const keep = (kind: "adult" | "character" | "circle") => {
    const ids = new Set(visibleEntries(c, kind, d.genderPref).map(e => e.id))
    return Object.fromEntries(Object.entries(d.prefs[kind]).filter(([id]) => ids.has(id)))
  }
  return { ...d.prefs, adult: keep("adult"), character: keep("character"), circle: keep("circle") }
}

export const genderMark = (g: "m" | "f" | null | undefined) => (g === "f" ? "ž" : g === "m" ? "m" : "")
