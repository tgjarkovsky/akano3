// Přihláška na hru (náhrada Google formuláře). Hráč u každé možnosti volí
// „chci moc“, „klidně“ nebo „nechci“; ukládá se jen to, co není „klidně“.
// Validace vstupu z veřejného formuláře, střety s pevnými prvky postav a CSV
// pro Přípravu. Bez závislostí na databázi, ať jde testovat.

export type Pref = "yes" | "ok" | "no"
export const PREF_KINDS = ["adult", "character", "unit", "circle", "specialization", "origin"] as const
export type PrefKind = typeof PREF_KINDS[number]
export type Prefs = Record<PrefKind, Record<string, "yes" | "no">>

export const RUN_CHOICES = [
  { value: "first", label: "První běh, 22.–25. 7. 2027" },
  { value: "second", label: "Druhý běh, 29. 7.–1. 8. 2027" },
  { value: "any", label: "Je mi to jedno, mohu oba" },
] as const
export const SUBSTITUTE_CHOICES = [
  { value: "until-event", label: "Až do konání akce" },
  { value: "until-june", label: "Jen do konce června" },
  { value: "until-april", label: "Jen do konce dubna (do 30. 4. se platí)" },
  { value: "no", label: "Nechci být náhradník*ice" },
] as const
export const NEWSLETTER_CHOICES = [
  { value: "yes", label: "Ano" },
  { value: "no", label: "Ne" },
  { value: "already", label: "Už ho dostávám" },
] as const
/** Jaké postavy chce hráč hrát; ostatní mu formulář neukáže. */
export const GENDER_CHOICES = [
  { value: "f", label: "Dívčí postavy" },
  { value: "m", label: "Chlapecké postavy" },
  { value: "any", label: "Kterékoli" },
] as const

export type RunChoice = typeof RUN_CHOICES[number]["value"]
export type SubstituteChoice = typeof SUBSTITUTE_CHOICES[number]["value"]
export type NewsletterChoice = typeof NEWSLETTER_CHOICES[number]["value"]
export type GenderChoice = typeof GENDER_CHOICES[number]["value"]

export type Prihlaska = {
  firstName: string
  lastName: string
  nickname: string
  email: string
  phone: string
  run: RunChoice
  substitute: SubstituteChoice
  newsletter: NewsletterChoice
  paths: { adult: boolean; team: boolean; student: boolean }
  genderPref: GenderChoice
  team: {
    mates: string
    /** když vylosují jen mě, jedu i bez trojice s jinou postavou */
    solo: boolean
    /** tým → koho z něj bych hrál(a) */
    picks: Record<string, string>
  }
  prefs: Prefs
  visionImpaired: boolean
  noteCasting: string
  noteOrg: string
}

export type PrihlaskaIds = {
  adultIds: readonly string[]
  teamMembers: Readonly<Record<string, readonly string[]>>
  unitIds: readonly string[]
  circleIds: readonly string[]
  specializationIds: readonly string[]
  originIds: readonly string[]
}

type Ok<T> = { ok: true; value: T }
type Err = { ok: false; error: string }

export const MAX_NOTE = 4000
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const PHONE = /^\+?[\d][\d ()-]{5,24}$/

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v)
const oneOf = <T extends string>(v: unknown, list: readonly { value: T }[]): v is T => list.some(o => o.value === v)

function text(v: unknown, label: string, max: number, required: boolean): Ok<string> | Err {
  if (v !== undefined && v !== null && typeof v !== "string") return { ok: false, error: `${label}: neplatná hodnota` }
  const s = typeof v === "string" ? v.trim() : ""
  if (required && !s) return { ok: false, error: `Vyplň ${label.toLowerCase()}.` }
  if (s.length > max) return { ok: false, error: `${label}: text je příliš dlouhý.` }
  return { ok: true, value: s }
}

export const idsOfKind = (ids: PrihlaskaIds, kind: PrefKind): readonly string[] => {
  switch (kind) {
    case "adult": return ids.adultIds
    case "character": return Object.values(ids.teamMembers).flat()
    case "unit": return ids.unitIds
    case "circle": return ids.circleIds
    case "specialization": return ids.specializationIds
    case "origin": return ids.originIds
  }
}

function parsePrefs(raw: unknown, ids: PrihlaskaIds): Ok<Prefs> | Err {
  if (!isObj(raw)) return { ok: false, error: "Chybí volby." }
  const out = {} as Prefs
  for (const kind of PREF_KINDS) {
    const src = raw[kind] ?? {}
    if (!isObj(src)) return { ok: false, error: "Neplatné volby." }
    const known = idsOfKind(ids, kind)
    out[kind] = {}
    for (const [id, v] of Object.entries(src)) {
      if (!known.includes(id)) return { ok: false, error: "Neznámá postava nebo skupina." }
      if (v === "ok") continue
      if (v !== "yes" && v !== "no") return { ok: false, error: "Neplatná volba." }
      out[kind][id] = v
    }
  }
  return { ok: true, value: out }
}

function parseTeam(raw: unknown, ids: PrihlaskaIds): Ok<Prihlaska["team"]> | Err {
  if (!isObj(raw)) return { ok: false, error: "Vyplň údaje o týmu." }
  const mates = text(raw.mates, "Spoluhráče", 300, true)
  if (!mates.ok) return mates
  if (!isObj(raw.picks)) return { ok: false, error: "Vyber aspoň jeden tým." }
  const picks: Record<string, string> = {}
  for (const [teamId, who] of Object.entries(raw.picks)) {
    const members = ids.teamMembers[teamId]
    if (!members) return { ok: false, error: "Neznámý tým." }
    if (typeof who !== "string" || !members.includes(who)) return { ok: false, error: "U každého vybraného týmu vyber, koho budeš hrát." }
    picks[teamId] = who
  }
  if (Object.keys(picks).length === 0) return { ok: false, error: "Vyber aspoň jeden tým." }
  if (typeof raw.solo !== "boolean") return { ok: false, error: "Vyber, co když vylosují jen tebe." }
  return { ok: true, value: { mates: mates.value, solo: raw.solo, picks } }
}

/** Vstup z veřejného formuláře. Prázdné volby a nevybrané cesty se zahodí. */
export function parsePrihlaska(raw: unknown, ids: PrihlaskaIds): Ok<Prihlaska> | Err {
  if (!isObj(raw)) return { ok: false, error: "Neplatná přihláška." }
  const firstName = text(raw.firstName, "Jméno", 100, true); if (!firstName.ok) return firstName
  const lastName = text(raw.lastName, "Příjmení", 100, true); if (!lastName.ok) return lastName
  const nickname = text(raw.nickname, "Přezdívka", 100, false); if (!nickname.ok) return nickname
  const email = text(raw.email, "E-mail", 200, true); if (!email.ok) return email
  if (!EMAIL.test(email.value)) return { ok: false, error: "E-mail nevypadá správně." }
  const phone = text(raw.phone, "Telefon", 30, true); if (!phone.ok) return phone
  if (!PHONE.test(phone.value)) return { ok: false, error: "Telefon nevypadá správně." }
  if (raw.adult !== true) return { ok: false, error: "Účast je možná jen pro plnoleté." }
  if (!oneOf(raw.run, RUN_CHOICES)) return { ok: false, error: "Vyber běh." }
  if (!oneOf(raw.substitute, SUBSTITUTE_CHOICES)) return { ok: false, error: "Vyber, jak dlouho chceš být náhradník*ice." }
  if (!oneOf(raw.newsletter, NEWSLETTER_CHOICES)) return { ok: false, error: "Vyber, jestli chceš newsletter." }
  if (!isObj(raw.paths)) return { ok: false, error: "Vyber, za co se hlásíš." }
  const paths = { adult: raw.paths.adult === true, team: raw.paths.team === true, student: raw.paths.student === true }
  if (!paths.adult && !paths.team && !paths.student) return { ok: false, error: "Vyber, za co se hlásíš." }
  if (!oneOf(raw.genderPref, GENDER_CHOICES)) return { ok: false, error: "Vyber, jaké postavy chceš hrát." }
  let team: Prihlaska["team"] = { mates: "", solo: false, picks: {} }
  if (paths.team) {
    const t = parseTeam(raw.team, ids); if (!t.ok) return t
    team = t.value
  }
  const prefs = parsePrefs(raw.prefs, ids); if (!prefs.ok) return prefs
  if (!paths.adult) prefs.value.adult = {}
  if (!showsOtherCharacters(paths, team)) prefs.value.character = {}
  if (!paths.student && !paths.team) {
    for (const k of ["unit", "circle", "specialization", "origin"] as const) prefs.value[k] = {}
  }
  const noteCasting = text(raw.noteCasting, "Poznámka k výběru postavy", MAX_NOTE, false); if (!noteCasting.ok) return noteCasting
  const noteOrg = text(raw.noteOrg, "Vzkaz organizátorům", MAX_NOTE, false); if (!noteOrg.ok) return noteOrg
  return {
    ok: true,
    value: {
      firstName: firstName.value, lastName: lastName.value, nickname: nickname.value,
      email: email.value, phone: phone.value,
      run: raw.run, substitute: raw.substitute, newsletter: raw.newsletter,
      paths, genderPref: raw.genderPref, team, prefs: prefs.value,
      visionImpaired: paths.adult && raw.visionImpaired === true,
      noteCasting: noteCasting.value, noteOrg: noteOrg.value,
    },
  }
}

/** Výběr ze studentských postav: hlásí se za ni, nebo jede i bez vylosované trojice. */
export function showsOtherCharacters(paths: Prihlaska["paths"], team: { solo: boolean | null }): boolean {
  return paths.student || (paths.team && team.solo === true)
}

/** Patří postava daného rodu („m“, „f“, jinak neurčeno) do hráčovy volby? Neurčený rod projde vždy. */
export const fitsGender = (pref: GenderChoice | "", gender: string | null | undefined) =>
  !pref || pref === "any" || (gender !== "m" && gender !== "f") || gender === pref

export const prefOf = (prefs: Prefs, kind: PrefKind, id: string): Pref => prefs[kind][id] ?? "ok"

export const emptyPrefs = (): Prefs => ({ adult: {}, character: {}, unit: {}, circle: {}, specialization: {}, origin: {} })

// ── Střety s pevnými prvky ─────────────────────────────────────────────

export type LimitKind = "unit" | "circle" | "specialization" | "origin"
/** postava → druh prvku → povolené hodnoty (chybí = libovolné) */
export type Limits = Record<string, Partial<Record<LimitKind, string[]>>>

/** Kruhy jen pro jeden rod postavy (medailonky kruhů na webu). */
export const CIRCLE_ONLY_GENDER: Record<string, "m" | "f"> = { C1: "f", C4: "m" }

/**
 * Povolené hodnoty pro každou postavu z pravidel obsazení (jednotka je pravidlo
 * týmu) a z rodu u kruhů jen pro dívky nebo kluky.
 */
export function characterLimits(input: {
  characters: readonly { id: string; teamId: string; gender: "m" | "f" | null }[]
  allowed: (subject: "character" | "team", id: string, property: LimitKind) => string[] | null
  circleIds: readonly string[]
}): Limits {
  const out: Limits = {}
  for (const c of input.characters) {
    const lim: Partial<Record<LimitKind, string[]>> = {}
    const unit = input.allowed("team", c.teamId, "unit")
    if (unit) lim.unit = unit
    for (const p of ["specialization", "origin"] as const) {
      const a = input.allowed("character", c.id, p)
      if (a) lim[p] = a
    }
    let circles = input.allowed("character", c.id, "circle")
    if (c.gender) {
      const byGender = (circles ?? input.circleIds).filter(id => !CIRCLE_ONLY_GENDER[id] || CIRCLE_ONLY_GENDER[id] === c.gender)
      if (byGender.length < input.circleIds.length) circles = byGender
    }
    if (circles) lim.circle = circles
    if (Object.keys(lim).length) out[c.id] = lim
  }
  return out
}

export type Conflict = { characterId: string; kind: LimitKind; allowed: string[]; wanted: boolean }

/** Postavy, které hráč nevyřadil, ale vyřadil všechno, co jim pravidla dovolují. */
export function findConflicts(prefs: Prefs, limits: Limits): Conflict[] {
  const out: Conflict[] = []
  for (const [characterId, lim] of Object.entries(limits)) {
    const pref = prefOf(prefs, "character", characterId)
    if (pref === "no") continue
    for (const kind of ["unit", "circle", "specialization", "origin"] as const) {
      const allowed = lim[kind]
      if (allowed?.length && allowed.every(v => prefOf(prefs, kind, v) === "no")) {
        out.push({ characterId, kind, allowed, wanted: pref === "yes" })
      }
    }
  }
  return out
}

/** Kolik možností druhu zůstává otevřených (nevyřazených). */
export function openCount(prefs: Prefs, kind: PrefKind, all: readonly string[]): { open: number; yes: number; total: number } {
  let no = 0, yes = 0
  for (const id of all) {
    const v = prefOf(prefs, kind, id)
    if (v === "no") no++
    else if (v === "yes") yes++
  }
  return { open: all.length - no, yes, total: all.length }
}

// ── CSV pro Přípravu ───────────────────────────────────────────────────

export function escapeCsv(value: string | number): string {
  const s = String(value)
  return /[",;\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

const yesNo = (b: boolean) => (b ? "ano" : "ne")
const labelOf = (list: readonly { value: string; label: string }[], v: string) => list.find(o => o.value === v)?.label ?? v

/** Jeden řádek na přihlášku; volby jako seznamy jmen „chci moc“ a „nechci“. */
export function buildPrihlaskyCsv(
  rows: readonly { createdAt: string; updatedAt: string; data: Prihlaska }[],
  nameOf: (kind: PrefKind | "team", id: string) => string,
): string {
  const names = (p: Prefs, kind: PrefKind, v: "yes" | "no") =>
    Object.entries(p[kind]).filter(([, x]) => x === v).map(([id]) => nameOf(kind, id)).join(", ")
  const header = [
    "Odesláno", "Upraveno", "Jméno", "Příjmení", "Přezdívka", "E-mail", "Telefon", "Běh", "Náhradník", "Newsletter",
    "Dospělá", "Tým", "Studentská", "Rod postav", "Spoluhráči", "Bez trojice", "Týmy a postava",
    ...PREF_KINDS.flatMap(k => [`${KIND_LABELS[k]} chci moc`, `${KIND_LABELS[k]} nechci`]),
    "Zrakové postižení", "Poznámka k výběru", "Vzkaz",
  ]
  const lines = rows.map(({ createdAt, updatedAt, data: d }) => [
    createdAt, updatedAt, d.firstName, d.lastName, d.nickname, d.email, d.phone,
    labelOf(RUN_CHOICES, d.run), labelOf(SUBSTITUTE_CHOICES, d.substitute), labelOf(NEWSLETTER_CHOICES, d.newsletter),
    yesNo(d.paths.adult), yesNo(d.paths.team), yesNo(d.paths.student), labelOf(GENDER_CHOICES, d.genderPref ?? ""),
    d.team.mates, d.paths.team ? yesNo(d.team.solo) : "",
    Object.entries(d.team.picks).map(([t, c]) => `${nameOf("team", t)}: ${nameOf("character", c)}`).join(", "),
    ...PREF_KINDS.flatMap(k => [names(d.prefs, k, "yes"), names(d.prefs, k, "no")]),
    yesNo(d.visionImpaired), d.noteCasting, d.noteOrg,
  ])
  return [header, ...lines].map(l => l.map(escapeCsv).join(",")).join("\n")
}

export const KIND_LABELS: Record<PrefKind, string> = {
  adult: "Dospělí",
  character: "Postavy",
  unit: "Jednotky",
  circle: "Kruhy",
  specialization: "Specializace",
  origin: "Původy",
}

// ── Katalog pro formulář ───────────────────────────────────────────────

/** Do kdy jde odeslanou přihlášku upravit přes odkaz (konec přihlašování). */
export const EDIT_UNTIL = "2026-12-31T23:59:59+01:00"
export const canEdit = (now: Date = new Date()) => now.getTime() <= Date.parse(EDIT_UNTIL)

export type CatalogEntry = {
  id: string
  name: string
  /** úsloví z první řádky „> 迷い子 – překlad“ */
  motto?: { jp?: string; text: string }
  /** řádky „**Role:** …“ vytažené z textu */
  facts: [string, string][]
  body: string
  sensitive?: string
  /** podtitul (např. „J-pop kapela“), zatím nevyužito u všech druhů */
  sub?: string
}
export type CatalogCharacter = CatalogEntry & {
  teamId: string
  gender: "m" | "f" | null
  /** pevné nebo omezené prvky z Pravidel: „jednotka Murakami“ */
  fixed: string[]
}
export type CatalogTeam = CatalogEntry & { color: string; memberIds: string[]; themes: string[] }
export type Catalog = {
  adults: CatalogEntry[]
  characters: CatalogCharacter[]
  teams: CatalogTeam[]
  units: CatalogEntry[]
  circles: CatalogEntry[]
  specializations: CatalogEntry[]
  origins: CatalogEntry[]
  limits: Limits
}

const CJK = /[぀-ヿ一-鿿]/

/** Rozloží medailonek: úsloví, řádky „**Klíč:** hodnota“, odrážky (témata týmu) a zbytek. */
export function splitMedallion(raw: string): Pick<CatalogEntry, "motto" | "facts" | "body"> & { bullets: string[] } {
  const lines = raw.replace(/\r/g, "").split("\n")
  let motto: CatalogEntry["motto"]
  const facts: [string, string][] = []
  const bullets: string[] = []
  const rest: string[] = []
  for (const line of lines) {
    const t = line.trim()
    if (!motto && !rest.some(l => l.trim()) && t.startsWith("> ")) {
      const m = t.slice(2).trim()
      const i = m.indexOf(" – ")
      motto = i > 0 && CJK.test(m.slice(0, i)) ? { jp: m.slice(0, i), text: m.slice(i + 3) } : { text: m }
      continue
    }
    const f = t.match(/^\*\*([^*:]{1,30}):\*\*\s*(.+)$/)
    if (f) { facts.push([f[1], f[2]]); continue }
    const b = t.match(/^[-–] (.+)$/)
    if (b) { bullets.push(b[1].trim()); continue }
    if (/^\*\*?Témata\*?\*?:?$/i.test(t) || /^Témata:?$/i.test(t)) continue
    rest.push(line)
  }
  return { motto, facts, bullets, body: rest.join("\n").replace(/\n{3,}/g, "\n\n").trim() }
}
