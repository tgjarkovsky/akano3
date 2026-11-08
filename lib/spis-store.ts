import { randomBytes } from "node:crypto"
import { sql } from "@/lib/db"
import { TEAMS, UNITS, CIRCLES } from "@/lib/data"
import { DOC_PLAYERS } from "@/lib/doc-ids"
import { ensureDocTables } from "@/lib/docs-store"
import { ensureSetupColumns } from "@/lib/setup-schema"
import { SPECIALIZATION_OPTIONS, ORIGIN_OPTIONS } from "@/lib/setup-options"
import { computeUnitSlots, slotOfTeam } from "@/lib/unit-slots"
import { resolveGender, resolveRoleNames, type Gender } from "@/lib/gender-markup"
import type { Triplet } from "@/lib/types"
import { composeCharacterDoc, composeAcademy, docStats, formatRunDate, type AcademyEntry, type CharacterDoc, type DogTag, type MemberGroup, type StoredText } from "@/lib/character-doc"

// Spisy postav pro hráče. Každá postava má na každý běh tajný odkaz;
// spis přes něj jde otevřít, až Příprava běh zveřejní.

let ready: Promise<void> | null = null

export function ensureSpisTables(): Promise<void> {
  ready ??= (async () => {
    await Promise.all([ensureDocTables(), ensureSetupColumns()])
    await sql`
      CREATE TABLE IF NOT EXISTS doc_links (
        run_id       INT  NOT NULL,
        character_id TEXT NOT NULL,
        token        TEXT NOT NULL UNIQUE,
        created_by   TEXT,
        created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        PRIMARY KEY (run_id, character_id)
      )
    `
    await sql`
      CREATE TABLE IF NOT EXISTS run_docs (
        run_id       INT PRIMARY KEY,
        published_at TIMESTAMPTZ,
        published_by TEXT
      )
    `
  })().catch(err => { ready = null; throw err })
  return ready
}

const newToken = () => randomBytes(18).toString("base64url")

type RunContext = {
  runName: string
  runDate?: string
  unitOfTeam: Map<string, string>
  /** trojice týmu stejně jako v Obsazení: uložená, u starších běhů dopočítaná */
  tripletOfTeam: Map<string, Triplet>
  /** pevná role postavy (Příprava → Pravidla), id role v unit_roles */
  fixedRoleOf: Map<string, string>
  roles: Map<string, { unitId: string; triplet: string; key: string; nameM: string; nameF: string }>
  state: Map<string, { specialization: string | null; origin: string | null }>
  circleOf: Map<string, string>
  gender: Map<string, string | null>
  texts: Map<string, StoredText>
  /** dogtagy všech hráčských postav v běhu */
  roster: DogTag[]
}

async function loadRunContext(runId: number): Promise<RunContext | null> {
  await ensureSpisTables()
  const [runs, units, states, circles, texts, meta, roleRows, roleRules] = await Promise.all([
    sql`SELECT name, to_char(starts_on, 'YYYY-MM-DD') AS starts_on, to_char(ends_on, 'YYYY-MM-DD') AS ends_on FROM runs WHERE id = ${runId}`,
    sql`SELECT team_id, unit_id, triplet FROM team_units WHERE run_id = ${runId}`,
    sql`SELECT character_id, specialization, origin FROM character_state WHERE run_id = ${runId}`,
    sql`SELECT circle_id, character_id FROM circle_members WHERE run_id = ${runId} ORDER BY circle_id`,
    sql`SELECT entity_type, entity_id, field, body, status FROM doc_texts`,
    sql`SELECT character_id, gender FROM character_meta`,
    sql`SELECT id, unit_id, triplet, key, name_m, name_f FROM unit_roles`,
    sql`SELECT subject_id, allowed FROM assignment_rules WHERE subject_type = 'character' AND property = 'role'`,
  ])
  if (runs.length === 0) return null
  const circleOf = new Map<string, string>()
  for (const r of circles) if (!circleOf.has(r.character_id as string)) circleOf.set(r.character_id as string, r.circle_id as string)
  const ctx: Omit<RunContext, "roster"> = {
    runName: runs[0].name as string,
    runDate: formatRunDate(runs[0].starts_on as string | null, runs[0].ends_on as string | null),
    unitOfTeam: new Map(units.map(r => [r.team_id as string, r.unit_id as string])),
    tripletOfTeam: tripletsOf(units.map(r => ({
      teamId: r.team_id as string, unitId: r.unit_id as string | null,
      triplet: r.triplet === "A" || r.triplet === "B" ? r.triplet : null,
    }))),
    fixedRoleOf: new Map(roleRules.filter(r => (r.allowed as string[]).length === 1).map(r => [r.subject_id as string, (r.allowed as string[])[0]])),
    roles: new Map(roleRows.map(r => [String(r.id), {
      unitId: r.unit_id as string, triplet: r.triplet as string, key: r.key as string, nameM: r.name_m as string, nameF: r.name_f as string,
    }])),
    state: new Map(states.map(r => [r.character_id as string, {
      specialization: r.specialization as string | null, origin: r.origin as string | null,
    }])),
    circleOf,
    gender: new Map(meta.map(r => [r.character_id as string, r.gender as string | null])),
    texts: new Map(texts.map(r => [
      `${r.entity_type}:${r.entity_id}:${r.field}`,
      { body: r.body as string, status: r.status as string | null },
    ])),
  }
  return { ...ctx, roster: DOC_PLAYERS.map(c => dogTag(ctx, c.id, c.name)) }
}

/** Trojice týmů v běhu. Chybějící trojici doplní stejně jako Obsazení (lib/unit-slots.ts). */
function tripletsOf(placements: { teamId: string; unitId: string | null; triplet: Triplet | null }[]): Map<string, Triplet> {
  const order = TEAMS.map(t => t.id)
  const sorted = [...placements].sort((a, b) => order.indexOf(a.teamId) - order.indexOf(b.teamId))
  const slots = computeUnitSlots(UNITS.map(u => u.id), sorted)
  const out = new Map<string, Triplet>()
  for (const p of sorted) {
    const at = slotOfTeam(slots, p.teamId)
    if (at) out.set(p.teamId, at.triplet)
  }
  return out
}

const GENDER_LABEL: Record<string, string> = { m: "muž", f: "žena" }
const nameOf = (id: string) => DOC_PLAYERS.find(c => c.id === id)?.name ?? id

function dogTag(ctx: Omit<RunContext, "roster">, id: string, name: string): DogTag {
  const team = TEAMS.find(t => t.memberIds.includes(id))
  const st = ctx.state.get(id)
  const g = ctx.gender.get(id)
  const tag: DogTag = {
    id, name,
    gender: g ? GENDER_LABEL[g] : undefined,
    team: team?.name,
    unit: UNITS.find(u => team && u.id === ctx.unitOfTeam.get(team.id))?.name,
    circle: CIRCLES.find(c => c.id === ctx.circleOf.get(id))?.name,
    specialization: SPECIALIZATION_OPTIONS.find(o => o.value === st?.specialization)?.label,
    origin: ORIGIN_OPTIONS.find(o => o.value === st?.origin)?.label,
  }
  return Object.fromEntries(Object.entries(tag).filter(([, v]) => v !== undefined)) as DogTag
}

/** Členové jednotky po týmech v tomto běhu. */
function unitMembers(ctx: Omit<RunContext, "roster">, unitId: string): MemberGroup[] {
  return TEAMS.filter(t => ctx.unitOfTeam.get(t.id) === unitId)
    .map(t => ({ label: t.name, names: t.memberIds.map(nameOf) }))
}

/** Členové kruhu v tomto běhu, v pořadí postav. */
function circleMembers(ctx: Omit<RunContext, "roster">, circleId: string): string[] {
  return DOC_PLAYERS.filter(c => ctx.circleOf.get(c.id) === circleId).map(c => c.name)
}

/**
 * Role postavy v jednotce. Zatím jen pevná role z pravidel, a jen když tým
 * v běhu opravdu stojí v její jednotce a trojici (jinak to hlásí kontroly obsazení).
 */
function roleOf(ctx: Omit<RunContext, "roster">, characterId: string, teamId: string | undefined) {
  const id = ctx.fixedRoleOf.get(characterId)
  const role = id ? ctx.roles.get(id) : undefined
  if (!id || !role || !teamId) return undefined
  if (ctx.unitOfTeam.get(teamId) !== role.unitId || ctx.tripletOfTeam.get(teamId) !== role.triplet) return undefined
  return { id, name: ctx.gender.get(characterId) === "f" ? role.nameF : role.nameM }
}

/**
 * Kdo v běhu drží roli: klíč „jednotka:klíč role“ → id postavy. Zatím jen
 * pevné role, které roleOf uzná (tým stojí v jednotce a trojici role).
 */
function roleHolders(ctx: Omit<RunContext, "roster">): Map<string, string> {
  const out = new Map<string, string>()
  for (const characterId of ctx.fixedRoleOf.keys()) {
    const team = TEAMS.find(t => t.memberIds.includes(characterId))
    const held = roleOf(ctx, characterId, team?.id)
    const role = held && ctx.roles.get(held.id)
    if (role) out.set(`${role.unitId}:${role.key}`, characterId)
  }
  return out
}

/**
 * Texty s dosazenými rodovými značkami pro čtenáře a šablonami rolí
 * (lib/gender-markup.ts). Šablona {@klic} míří na roli v jednotce textu:
 * u textu jednotky či role je to ta jednotka, jinak jednotka čtenáře.
 */
function textsFor(ctx: Omit<RunContext, "roster">, characterId: string) {
  const asGender = (g: string | null | undefined): Gender | null => g === "m" || g === "f" ? g : null
  const of = (who: string) => {
    const w = who.toLocaleLowerCase("cs")
    const c = DOC_PLAYERS.find(p => p.id.toLowerCase() === w || p.name.toLocaleLowerCase("cs") === w)
    return c ? asGender(ctx.gender.get(c.id)) : null
  }
  const self = asGender(ctx.gender.get(characterId))
  const team = TEAMS.find(t => t.memberIds.includes(characterId))
  const readerUnit = team ? ctx.unitOfTeam.get(team.id) : undefined
  const holders = roleHolders(ctx)
  const roleByKey = new Map([...ctx.roles.values()].map(r => [`${r.unitId}:${r.key}`, r]))

  return (type: string, id: string, field: string): StoredText | undefined => {
    const t = ctx.texts.get(`${type}:${id}:${field}`)
    if (!t) return undefined
    const unitId = type === "unit" ? id : type === "role" ? ctx.roles.get(id)?.unitId : readerUnit
    const holder = (key: string) => unitId ? holders.get(`${unitId}:${key}`) : undefined
    const role = (key: string) => { const h = holder(key); return h ? asGender(ctx.gender.get(h)) : null }
    const name = (key: string) => {
      const h = holder(key)
      if (h) return nameOf(h)
      const r = unitId ? roleByKey.get(`${unitId}:${key}`) : undefined
      return r && (r.nameM === r.nameF ? r.nameM : `${r.nameM}/${r.nameF}`)
    }
    return { ...t, body: resolveRoleNames(resolveGender(t.body, { self, of, role }), name) }
  }
}

function buildDoc(ctx: RunContext, characterId: string): CharacterDoc | null {
  const character = DOC_PLAYERS.find(c => c.id === characterId)
  if (!character) return null
  const team = TEAMS.find(t => t.memberIds.includes(characterId))
  const unitId = team ? ctx.unitOfTeam.get(team.id) : undefined
  const unit = UNITS.find(u => u.id === unitId)
  const circle = CIRCLES.find(c => c.id === ctx.circleOf.get(characterId))
  const st = ctx.state.get(characterId)
  const spec = SPECIALIZATION_OPTIONS.find(o => o.value === st?.specialization)
  const origin = ORIGIN_OPTIONS.find(o => o.value === st?.origin)

  return composeCharacterDoc({
    runName: ctx.runName,
    runDate: ctx.runDate,
    character: { id: character.id, name: character.name },
    team: team && { id: team.id, name: team.name, teammates: team.memberIds.filter(id => id !== characterId).map(nameOf) },
    unit: unit && { id: unit.id, name: unit.name, members: unitMembers(ctx, unit.id), role: roleOf(ctx, characterId, team?.id) },
    circle: circle && { id: circle.id, name: circle.name, members: circleMembers(ctx, circle.id) },
    roster: ctx.roster,
    specialization: spec && { id: `specialization:${spec.value}`, label: spec.label },
    origin: origin && { id: `origin:${origin.value}`, label: origin.label },
    text: textsFor(ctx, characterId),
  })
}

/** Ostatní skupiny akademie pro osobní knihovnu: jen medailonky a veřejné texty. */
function buildAcademy(ctx: RunContext, characterId: string): AcademyEntry[] {
  const team = TEAMS.find(t => t.memberIds.includes(characterId))
  // Pod jménem skupiny vždy, kdo v ní je.
  const sub = (names: string[]) => names.length ? names.join(", ") : undefined
  return composeAcademy({
    groups: [
      ...TEAMS.map(t => ({ kind: "team" as const, id: t.id, name: t.name, sub: sub(t.memberIds.map(nameOf)) })),
      ...UNITS.map(u => {
        const groups = unitMembers(ctx, u.id)
        return { kind: "unit" as const, id: u.id, name: u.name, sub: groups.length ? groups.map(g => `${g.label}: ${g.names.join(", ")}`).join(" · ") : undefined }
      }),
      ...CIRCLES.map(c => ({ kind: "circle" as const, id: c.id, name: c.name, sub: sub(circleMembers(ctx, c.id)) })),
    ],
    mine: {
      team: team?.id,
      unit: team ? ctx.unitOfTeam.get(team.id) : undefined,
      circle: ctx.circleOf.get(characterId),
    },
    text: textsFor(ctx, characterId),
  })
}

// ── Hráč ──────────────────────────────────────────────────────────────

export type SpisLookup =
  | { state: "missing" }
  | { state: "unpublished"; name: string }
  | { state: "ok"; doc: CharacterDoc; academy: AcademyEntry[] }

export async function getSpisByToken(token: string): Promise<SpisLookup> {
  await ensureSpisTables()
  const [link] = await sql`
    SELECT l.run_id, l.character_id, d.published_at
    FROM doc_links l LEFT JOIN run_docs d ON d.run_id = l.run_id
    WHERE l.token = ${token}
  `
  if (!link) return { state: "missing" }
  const characterId = link.character_id as string
  if (!link.published_at) return { state: "unpublished", name: DOC_PLAYERS.find(c => c.id === characterId)?.name ?? "" }
  const ctx = await loadRunContext(link.run_id as number)
  const doc = ctx && buildDoc(ctx, characterId)
  return ctx && doc ? { state: "ok", doc, academy: buildAcademy(ctx, characterId) } : { state: "missing" }
}

// ── Příprava ──────────────────────────────────────────────────────────

export type SpisRow = {
  characterId: string
  token: string | null
  blocks: number
  notApproved: number
}
export type SpisOverview = {
  runId: number
  runName: string
  publishedAt: string | null
  publishedBy: string | null
  rows: SpisRow[]
}

export async function getSpisOverview(runId: number): Promise<SpisOverview | null> {
  const ctx = await loadRunContext(runId)
  if (!ctx) return null
  const [links, pub] = await Promise.all([
    sql`SELECT character_id, token FROM doc_links WHERE run_id = ${runId}`,
    sql`SELECT published_at, published_by FROM run_docs WHERE run_id = ${runId}`,
  ])
  const tokenOf = new Map(links.map(r => [r.character_id as string, r.token as string]))
  return {
    runId,
    runName: ctx.runName,
    publishedAt: pub[0]?.published_at ? new Date(pub[0].published_at as string).toISOString() : null,
    publishedBy: (pub[0]?.published_by as string) ?? null,
    rows: DOC_PLAYERS.map(c => {
      const doc = buildDoc(ctx, c.id)!
      return { characterId: c.id, token: tokenOf.get(c.id) ?? null, ...docStats(doc) }
    }),
  }
}

/** Spisy pro náhled a tisk v Přípravě (se stavy textů). */
export async function getRunDocs(runId: number, characterId: string | null): Promise<CharacterDoc[] | null> {
  const ctx = await loadRunContext(runId)
  if (!ctx) return null
  const ids = characterId ? [characterId] : DOC_PLAYERS.map(c => c.id)
  return ids.map(id => buildDoc(ctx, id)).filter((d): d is CharacterDoc => d !== null)
}

export async function runExists(runId: number): Promise<boolean> {
  const rows = await sql`SELECT 1 FROM runs WHERE id = ${runId}`
  return rows.length > 0
}

/** Vytvoří odkazy postavám, které v běhu ještě žádný nemají. */
export async function createMissingLinks(runId: number, by: string | null) {
  await ensureSpisTables()
  await sql.transaction(DOC_PLAYERS.map(c => sql`
    INSERT INTO doc_links (run_id, character_id, token, created_by)
    VALUES (${runId}, ${c.id}, ${newToken()}, ${by})
    ON CONFLICT (run_id, character_id) DO NOTHING
  `))
}

/** Nový odkaz pro jednu postavu; starý tím přestane fungovat. */
export async function regenerateLink(runId: number, characterId: string, by: string | null) {
  await ensureSpisTables()
  await sql`
    INSERT INTO doc_links (run_id, character_id, token, created_by)
    VALUES (${runId}, ${characterId}, ${newToken()}, ${by})
    ON CONFLICT (run_id, character_id) DO UPDATE SET
      token = EXCLUDED.token, created_by = EXCLUDED.created_by, created_at = NOW()
  `
}

export async function setPublished(runId: number, published: boolean, by: string | null) {
  await ensureSpisTables()
  await sql`
    INSERT INTO run_docs (run_id, published_at, published_by)
    VALUES (${runId}, ${published ? new Date().toISOString() : null}, ${published ? by : null})
    ON CONFLICT (run_id) DO UPDATE SET published_at = EXCLUDED.published_at, published_by = EXCLUDED.published_by
  `
}
