import { prefOf, fitsGender, type Prihlaska, type SubstituteChoice } from "./prihlaska.ts"

// Obsazení hráčů na postavy: stav přihlášky vůči běhu, shoda hráče s postavou
// podle jeho voleb v přihlášce, co hráči ještě chybí (platba, fotka) a kontrola
// nahrané fotky. Bez databáze, ať jde testovat. Ukládá lib/cast-store.ts.

export const CAST_STATUSES = [
  { value: "new", label: "Nová" },
  { value: "accepted", label: "Přijat" },
  { value: "substitute", label: "Náhradník" },
  { value: "declined", label: "Nejede" },
] as const
export type CastStatus = typeof CAST_STATUSES[number]["value"]

export const isCastStatus = (v: unknown): v is CastStatus => CAST_STATUSES.some(s => s.value === v)
export const statusLabel = (s: CastStatus) => CAST_STATUSES.find(x => x.value === s)!.label

/** Přijatý hráč a náhradník patří k běhu, nová a odmítnutá přihláška k žádnému. */
export const statusNeedsRun = (s: CastStatus) => s === "accepted" || s === "substitute"

/** Stav a běh přihlášky z požadavku Přípravy. */
export function parseStatusChange(status: unknown, runId: unknown): { status: CastStatus; runId: number | null } | { error: string } {
  if (!isCastStatus(status)) return { error: "Neznámý stav přihlášky" }
  if (!statusNeedsRun(status)) return { status, runId: null }
  if (typeof runId !== "number" || !Number.isInteger(runId) || runId <= 0) return { error: "Vyber běh" }
  return { status, runId }
}

/** Na postavu v běhu jde obsadit jen přihláška přijatá na ten běh. */
export const canBeCast = (p: { status: CastStatus; runId: number | null }, runId: number) =>
  p.status === "accepted" && p.runId === runId

// ── Shoda hráče s postavou ─────────────────────────────────────────────

export type CastCharacter = {
  id: string
  kind: "player" | "adult"
  teamId?: string
  gender: "m" | "f" | null
  /** hodnoty postavy v běhu (z Obsazení), které hráč mohl v přihlášce odmítnout */
  unitId?: string
  circleId?: string
  specialization?: string
  origin?: string
}

export type CastFit = {
  /** hráč postavu chce (★ nebo ji vybral v trojici) */
  wanted: boolean
  /** hráč postavu odmítl (✗) */
  refused: boolean
  /** další důvody, proč postava hráči nesedí */
  warnings: string[]
}

type NameOf = (kind: "unit" | "circle" | "specialization" | "origin", id: string) => string

const GENDER_WORD = { f: "ženské", m: "mužské" } as const

export function castFit(p: Prihlaska, c: CastCharacter, nameOf: NameOf): CastFit {
  const warnings: string[] = []
  let wanted: boolean, refused: boolean
  if (c.kind === "adult") {
    const pref = prefOf(p.prefs, "adult", c.id)
    wanted = pref === "yes"
    refused = pref === "no"
    if (!p.paths.adult) warnings.push("nehlásí se za dospělého")
  } else {
    const pref = prefOf(p.prefs, "character", c.id)
    const picked = p.paths.team && !!c.teamId && p.team.picks[c.teamId] === c.id
    wanted = pref === "yes" || picked
    refused = pref === "no"
    if (!p.paths.team && !p.paths.student) warnings.push("hlásí se jen za dospělého")
    else if (!p.paths.student && !picked) warnings.push("hlásí se jen s trojicí do jiných postav")
    const elements = [
      ["unit", c.unitId, "jednotku"],
      ["circle", c.circleId, "kruh"],
      ["specialization", c.specialization, "specializaci"],
      ["origin", c.origin, "původ"],
    ] as const
    for (const [kind, value, word] of elements) {
      if (value && prefOf(p.prefs, kind, value) === "no") warnings.push(`nechce ${word} ${nameOf(kind, value)}`)
    }
  }
  if (!fitsGender(p.genderPref, c.gender)) warnings.push(`chce hrát jen ${GENDER_WORD[p.genderPref as "f" | "m"]} postavy`)
  return { wanted, refused, warnings }
}

/** Krátká značka do výběru hráče: ★ chce, ✗ nechce, ⚠ něco nesedí. */
export function fitMark(f: CastFit): string {
  return [f.wanted ? "★" : "", f.refused ? "✗" : "", f.warnings.length ? "⚠" : ""].join("")
}

// ── Návrh obsazení ─────────────────────────────────────────────────────

export type SuggestPlayer = { id: number; data: Prihlaska; characterId: string | null }

/**
 * Skóre dvojice hráč–postava pro návrh, nebo null, když ji navrhnout nejde
 * (postavu odmítl, nesedí rod, nehlásí se na tenhle typ postavy).
 * Každá povolená dvojice má kladné skóre, takže návrh obsadí co nejvíc postav.
 */
export function suggestScore(p: Prihlaska, c: CastCharacter, nameOf: NameOf): number | null {
  const fit = castFit(p, c, nameOf)
  if (fit.refused || !fitsGender(p.genderPref, c.gender)) return null
  const picked = c.kind === "player" && p.paths.team && !!c.teamId && p.team.picks[c.teamId] === c.id
  if (c.kind === "adult" ? !p.paths.adult : !(p.paths.student || picked)) return null
  // Zbylá varování jsou jen odmítnuté prvky postavy (jednotka, kruh, specializace, původ).
  return 100 + (picked ? 30 : fit.wanted ? 20 : 0) - 10 * fit.warnings.length
}

/**
 * Návrh obsazení volných postav volnými přijatými hráči tak, aby byl součet
 * skóre co největší (maďarská metoda). Stávající obsazení nemění.
 * Vrací id postavy → id přihlášky.
 */
export function suggestCast(characters: readonly CastCharacter[], players: readonly SuggestPlayer[], nameOf: NameOf): Map<string, number> {
  const taken = new Set(players.map(p => p.characterId).filter(Boolean))
  const chars = characters.filter(c => !taken.has(c.id))
  const free = players.filter(p => !p.characterId)
  const n = Math.max(chars.length, free.length)
  if (chars.length === 0 || free.length === 0) return new Map()
  const FORBIDDEN = 1e6
  // cost[i][j]: řádek = postava, sloupec = hráč; doplněno na čtverec nulami (nikdo / nic).
  const score: (number | null)[][] = chars.map(c => free.map(p => suggestScore(p.data, c, nameOf)))
  const cost = (i: number, j: number) => {
    if (i >= chars.length || j >= free.length) return 0
    const s = score[i][j]
    return s === null ? FORBIDDEN : -s
  }
  const colOf = hungarian(n, cost)
  const out = new Map<string, number>()
  for (let i = 0; i < chars.length; i++) {
    const j = colOf[i]
    if (j < free.length && score[i][j] !== null) out.set(chars[i].id, free[j].id)
  }
  return out
}

/** Minimální přiřazení řádků sloupcům ve čtvercové matici n×n (O(n³)). Vrací sloupec pro každý řádek. */
function hungarian(n: number, cost: (i: number, j: number) => number): number[] {
  const u = new Array(n + 1).fill(0), v = new Array(n + 1).fill(0)
  const p = new Array(n + 1).fill(0), way = new Array(n + 1).fill(0)
  for (let i = 1; i <= n; i++) {
    p[0] = i
    let j0 = 0
    const minv = new Array(n + 1).fill(Infinity), used = new Array(n + 1).fill(false)
    do {
      used[j0] = true
      const i0 = p[j0]
      let delta = Infinity, j1 = 0
      for (let j = 1; j <= n; j++) {
        if (used[j]) continue
        const cur = cost(i0 - 1, j - 1) - u[i0] - v[j]
        if (cur < minv[j]) { minv[j] = cur; way[j] = j0 }
        if (minv[j] < delta) { delta = minv[j]; j1 = j }
      }
      for (let j = 0; j <= n; j++) {
        if (used[j]) { u[p[j]] += delta; v[j] -= delta } else minv[j] -= delta
      }
      j0 = j1
    } while (p[j0] !== 0)
    do { const j1 = way[j0]; p[j0] = p[j1]; j0 = j1 } while (j0)
  }
  const colOf = new Array(n).fill(-1)
  for (let j = 1; j <= n; j++) if (p[j]) colOf[p[j] - 1] = j - 1
  return colOf
}

// ── Kontroly v Obsazení ────────────────────────────────────────────────

export type CastIssue = {
  level: "error" | "warning"
  message: string
  target: { type: "character"; id: string }
}

/**
 * Hráči na postavě, kterou odmítli nebo která jim nesedí, a postavy bez hráče
 * (souhrnně jedním varováním, ať před začátkem obsazování nezaplaví kontroly).
 * Přijatí hráči bez postavy nemají vlastní řádek, vrací se jako text.
 */
export function checkCast(input: {
  characters: readonly { id: string; name: string }[]
  /** id postavy → hráč a jeho shoda s postavou */
  cast: ReadonlyMap<string, { name: string; fit: CastFit }>
  /** jména přijatých hráčů bez postavy */
  uncast: readonly string[]
}): { issues: CastIssue[]; uncastMessage: string | null } {
  const issues: CastIssue[] = []
  const empty: { id: string; name: string }[] = []
  for (const c of input.characters) {
    const who = input.cast.get(c.id)
    const target = { type: "character" as const, id: c.id }
    if (!who) { empty.push(c); continue }
    if (who.fit.refused) issues.push({ level: "error", message: `${c.name}: ${who.name} tuhle postavu odmítl(a)`, target })
    for (const w of who.fit.warnings) issues.push({ level: "warning", message: `${c.name}: ${who.name} ${w}`, target })
  }
  if (empty.length > 0) {
    const list = empty.length <= 6 ? empty.map(c => c.name).join(", ") : `${empty.length} postav`
    issues.push({ level: "warning", message: `Bez hráče: ${list}`, target: { type: "character", id: empty[0].id } })
  }
  const n = input.uncast.length
  const uncastMessage = n === 0 ? null
    : n > 6 ? `Bez postavy zůstává ${n} přijatých hráčů`
    : `Bez postavy ${n === 1 ? "zůstává" : "zůstávají"}: ${input.uncast.join(", ")}`
  return { issues, uncastMessage }
}

// ── Co hráči chybí ─────────────────────────────────────────────────────

export type PlayerTodo = { paid: boolean; photo: boolean }

/** Co hráči chybí, jako text do upomínky („zaplatit hru a nahrát fotku“). Prázdné = nic. */
export function missingText(t: PlayerTodo): string {
  const parts = [t.paid ? "" : "zaplatit hru", t.photo ? "" : "nahrát fotku"].filter(Boolean)
  return parts.join(" a ")
}

// ── Nepřijetí ──────────────────────────────────────────────────────────

/** Mail o nepřijetí jde náhradníkům a odmítnutým, nové přihlášky se teprve posuzují. */
export const getsRejection = (s: CastStatus) => s === "substitute" || s === "declined"

const SUBSTITUTE_UNTIL: Record<Exclude<SubstituteChoice, "no">, string> = {
  "until-event": "až do konání hry",
  "until-june": "do konce června",
  "until-april": "do konce dubna",
}

/** Věta do mailu o nepřijetí podle toho, co hráč vyplnil u náhradnického seznamu. */
export function substituteText(choice: SubstituteChoice): string {
  if (choice === "no") return "Podle tvé přihlášky tě na náhradnický seznam nezapisujeme. Pokud o něj přece jen stojíš, napiš nám."
  return `Podle tvé přihlášky tě necháváme na náhradnickém seznamu **${SUBSTITUTE_UNTIL[choice]}**. Když se uvolní role, která ti sedí, ozveme se.`
}

// ── Fotka ──────────────────────────────────────────────────────────────

export const PHOTO_MAX_BYTES = 1_000_000

/** Typ obrázku podle prvních bajtů (na deklarovaný typ se nespoléhá). */
export function sniffImage(b: Uint8Array): "image/jpeg" | "image/png" | "image/webp" | null {
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg"
  if (b.length >= 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return "image/png"
  if (b.length >= 12 && ascii(b, 0, 4) === "RIFF" && ascii(b, 8, 12) === "WEBP") return "image/webp"
  return null
}

const ascii = (b: Uint8Array, from: number, to: number) => String.fromCharCode(...b.subarray(from, to))

export function checkPhoto(b: Uint8Array): { mime: string } | { error: string; status: number } {
  if (b.length === 0) return { error: "Fotka je prázdná.", status: 400 }
  if (b.length > PHOTO_MAX_BYTES) return { error: "Fotka je příliš velká.", status: 413 }
  const mime = sniffImage(b)
  if (!mime) return { error: "Fotka musí být JPEG, PNG nebo WebP.", status: 415 }
  return { mime }
}

// ── Jméno hráče ────────────────────────────────────────────────────────

/** „Jana Nováková (Janča)“ pro přehledy Přípravy. */
export const playerName = (p: Pick<Prihlaska, "firstName" | "lastName" | "nickname">) =>
  `${p.firstName} ${p.lastName}`.trim() + (p.nickname ? ` (${p.nickname})` : "")

/** Oslovení v mailu: přezdívka, jinak křestní jméno. */
export const greetingName = (p: Pick<Prihlaska, "firstName" | "nickname">) => p.nickname || p.firstName
