import { randomBytes } from "node:crypto"
import { sql } from "@/lib/db"
import { TEAMS, UNITS, CIRCLES } from "@/lib/data"
import { DOC_PLAYERS } from "@/lib/doc-ids"
import { ensureDocTables } from "@/lib/docs-store"
import { ensureSetupColumns } from "@/lib/setup-schema"
import { SPECIALIZATION_OPTIONS, ORIGIN_OPTIONS } from "@/lib/setup-options"
import { composeCharacterDoc, composeAcademy, docStats, formatRunDate, peopleCount, type AcademyEntry, type CharacterDoc, type StoredText } from "@/lib/character-doc"

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
  state: Map<string, { specialization: string | null; origin: string | null }>
  circleOf: Map<string, string>
  texts: Map<string, StoredText>
}

async function loadRunContext(runId: number): Promise<RunContext | null> {
  await ensureSpisTables()
  const [runs, units, states, circles, texts] = await Promise.all([
    sql`SELECT name, to_char(starts_on, 'YYYY-MM-DD') AS starts_on, to_char(ends_on, 'YYYY-MM-DD') AS ends_on FROM runs WHERE id = ${runId}`,
    sql`SELECT team_id, unit_id FROM team_units WHERE run_id = ${runId}`,
    sql`SELECT character_id, specialization, origin FROM character_state WHERE run_id = ${runId}`,
    sql`SELECT circle_id, character_id FROM circle_members WHERE run_id = ${runId} ORDER BY circle_id`,
    sql`SELECT entity_type, entity_id, field, body, status FROM doc_texts WHERE entity_type <> 'role'`,
  ])
  if (runs.length === 0) return null
  const circleOf = new Map<string, string>()
  for (const r of circles) if (!circleOf.has(r.character_id as string)) circleOf.set(r.character_id as string, r.circle_id as string)
  return {
    runName: runs[0].name as string,
    runDate: formatRunDate(runs[0].starts_on as string | null, runs[0].ends_on as string | null),
    unitOfTeam: new Map(units.map(r => [r.team_id as string, r.unit_id as string])),
    state: new Map(states.map(r => [r.character_id as string, {
      specialization: r.specialization as string | null, origin: r.origin as string | null,
    }])),
    circleOf,
    texts: new Map(texts.map(r => [
      `${r.entity_type}:${r.entity_id}:${r.field}`,
      { body: r.body as string, status: r.status as string | null },
    ])),
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
  const nameOf = (id: string) => DOC_PLAYERS.find(c => c.id === id)?.name ?? id

  return composeCharacterDoc({
    runName: ctx.runName,
    runDate: ctx.runDate,
    character: { id: character.id, name: character.name },
    team: team && { id: team.id, name: team.name, teammates: team.memberIds.filter(id => id !== characterId).map(nameOf) },
    unit: unit && { id: unit.id, name: unit.name },
    circle: circle && { id: circle.id, name: circle.name },
    specialization: spec && { id: `specialization:${spec.value}`, label: spec.label },
    origin: origin && { id: `origin:${origin.value}`, label: origin.label },
    text: (type, id, field) => ctx.texts.get(`${type}:${id}:${field}`),
  })
}

/** Ostatní skupiny akademie pro osobní knihovnu: jen medailonky a veřejné texty. */
function buildAcademy(ctx: RunContext, characterId: string): AcademyEntry[] {
  const nameOf = (id: string) => DOC_PLAYERS.find(c => c.id === id)?.name ?? id
  const team = TEAMS.find(t => t.memberIds.includes(characterId))
  const circleCount = (id: string) => [...ctx.circleOf.values()].filter(c => c === id).length
  return composeAcademy({
    groups: [
      ...TEAMS.map(t => ({ kind: "team" as const, id: t.id, name: t.name, sub: t.memberIds.map(nameOf).join(", ") })),
      ...UNITS.map(u => {
        const teams = TEAMS.filter(t => ctx.unitOfTeam.get(t.id) === u.id).map(t => t.name)
        return { kind: "unit" as const, id: u.id, name: u.name, sub: teams.length ? teams.join(" a ") : undefined }
      }),
      ...CIRCLES.map(c => {
        const n = circleCount(c.id)
        return { kind: "circle" as const, id: c.id, name: c.name, sub: n ? peopleCount(n) : undefined }
      }),
    ],
    mine: {
      team: team?.id,
      unit: team ? ctx.unitOfTeam.get(team.id) : undefined,
      circle: ctx.circleOf.get(characterId),
    },
    text: (type, id, field) => ctx.texts.get(`${type}:${id}:${field}`),
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
