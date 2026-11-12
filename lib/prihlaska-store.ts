import { randomBytes } from "node:crypto"
import { sql } from "@/lib/db"
import { TEAMS, UNITS, CIRCLES } from "@/lib/data"
import { DOC_PLAYERS, DOC_ADULTS } from "@/lib/doc-ids"
import { ensureDocTables } from "@/lib/docs-store"
import { getRules } from "@/lib/rules-store"
import { indexRules, allowedValues, describeRule, type AssignmentRule } from "@/lib/assignment-rules"
import { ruleOptionsFor, PROPERTY_LABELS } from "@/lib/rule-options"
import { SPECIALIZATION_OPTIONS, ORIGIN_OPTIONS } from "@/lib/setup-options"
import {
  characterLimits, splitMedallion,
  type Catalog, type CatalogEntry, type LimitKind, type Prihlaska, type PrihlaskaIds,
} from "@/lib/prihlaska"

// Přihlášky na hru a katalog medailonků pro veřejný formulář.
// Ven jdou jen texty „před hrou“ (medailonek, citlivá témata) a veřejné
// popisy specializací a původů. Odpovědi čte jen Příprava.

let ready: Promise<void> | null = null

export function ensurePrihlaskaTables(): Promise<void> {
  ready ??= (async () => {
    await ensureDocTables()
    await sql`
      CREATE TABLE IF NOT EXISTS prihlasky (
        id         SERIAL PRIMARY KEY,
        token      TEXT NOT NULL UNIQUE,
        data       JSONB NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        edits      INT NOT NULL DEFAULT 0
      )
    `
  })().catch(err => { ready = null; throw err })
  return ready
}

export const PRIHLASKA_TOKEN = /^[A-Za-z0-9_-]{24}$/
export const isPrihlaskaToken = (v: unknown): v is string => typeof v === "string" && PRIHLASKA_TOKEN.test(v)
const newToken = () => randomBytes(18).toString("base64url")

export const PRIHLASKA_IDS: PrihlaskaIds = {
  adultIds: DOC_ADULTS.map(c => c.id),
  teamMembers: Object.fromEntries(TEAMS.map(t => [t.id, t.memberIds])),
  unitIds: UNITS.map(u => u.id),
  circleIds: CIRCLES.map(c => c.id),
  specializationIds: SPECIALIZATION_OPTIONS.map(o => o.value),
  originIds: ORIGIN_OPTIONS.map(o => o.value),
}

const PRELARP_FIELDS = ["medallion", "sensitive"]

/** Medailonky, citlivá témata, rody a omezení postav pro formulář. */
export async function getCatalog(): Promise<Catalog> {
  await ensurePrihlaskaTables()
  const [texts, meta, rules] = await Promise.all([
    sql`SELECT entity_type, entity_id, field, body FROM doc_texts
        WHERE (field = ANY(${PRELARP_FIELDS}) AND entity_type IN ('character', 'team', 'unit', 'circle', 'adult'))
           OR (entity_type = 'trait' AND field = 'public')`,
    sql`SELECT character_id, gender FROM character_meta`,
    getRules(),
  ])
  return buildCatalog({
    text: new Map(texts.map(r => [`${r.entity_type}:${r.entity_id}:${r.field}`, (r.body as string).trim()])),
    gender: new Map(meta.map(r => [r.character_id as string, r.gender === "m" || r.gender === "f" ? r.gender : null])),
    rules,
  })
}

/** Katalog z textů (klíč „typ:id:pole“), rodů postav a pravidel obsazení. */
export function buildCatalog({ text, gender, rules }: {
  text: Map<string, string>
  gender: Map<string, "m" | "f" | null>
  rules: AssignmentRule[]
}): Catalog {

  const entry = (type: string, id: string, name: string, field = "medallion"): CatalogEntry & { bullets: string[] } => {
    const { motto, facts, bullets, body } = splitMedallion(text.get(`${type}:${id}:${field}`) ?? "")
    const sensitive = text.get(`${type}:${id}:sensitive`)
    return { id, name, ...(motto ? { motto } : {}), facts, bullets, body, ...(sensitive ? { sensitive } : {}) }
  }
  const plain = ({ bullets: _b, ...e }: CatalogEntry & { bullets: string[] }): CatalogEntry => e

  const index = indexRules(rules)
  const allowed = (s: "character" | "team", id: string, p: LimitKind) => allowedValues(index, s, id, p)
  const teamOf = (id: string) => TEAMS.find(t => t.memberIds.includes(id))!.id

  // Na kartě jen prvky napevno („jednotka Murakami“). Omezení typu „kromě X“
  // karta neukazuje, hlídá je kontrola střetů.
  const fixedOf = (characterId: string): string[] => {
    const out: string[] = []
    const add = (p: LimitKind, values: string[] | null) => {
      const d = describeRule(values, ruleOptionsFor(p))
      if (d.kind === "fixed") out.push(`${PROPERTY_LABELS[p].toLowerCase()} ${d.text.replace(/^Napevno: /, "")}`)
    }
    add("unit", allowed("team", teamOf(characterId), "unit"))
    for (const p of ["specialization", "origin", "circle"] as const) add(p, allowed("character", characterId, p))
    return out
  }

  return {
    adults: DOC_ADULTS.map(c => plain(entry("adult", c.id, c.name))),
    characters: DOC_PLAYERS.map(c => ({
      ...plain(entry("character", c.id, c.name)),
      teamId: c.teamId!,
      gender: gender.get(c.id) ?? null,
      fixed: fixedOf(c.id),
    })),
    teams: TEAMS.map(t => {
      const { bullets, ...e } = entry("team", t.id, t.name)
      return { ...e, color: t.color, memberIds: t.memberIds, themes: bullets }
    }),
    units: UNITS.map(u => plain(entry("unit", u.id, u.name))),
    circles: CIRCLES.map(c => plain(entry("circle", c.id, c.name))),
    specializations: SPECIALIZATION_OPTIONS.map(o => plain(entry("trait", `specialization:${o.value}`, o.label, "public"))).map(e => ({ ...e, id: e.id.split(":")[1] })),
    origins: ORIGIN_OPTIONS.map(o => plain(entry("trait", `origin:${o.value}`, o.label, "public"))).map(e => ({ ...e, id: e.id.split(":")[1] })),
    limits: characterLimits({
      characters: DOC_PLAYERS.map(c => ({ id: c.id, teamId: c.teamId!, gender: gender.get(c.id) ?? null })),
      allowed,
      circleIds: CIRCLES.map(c => c.id),
    }),
  }
}

export type StoredPrihlaska = { id: number; createdAt: string; updatedAt: string; edits: number; data: Prihlaska }

const iso = (v: unknown) => new Date(v as string).toISOString()
const rowTo = (r: Record<string, unknown>): StoredPrihlaska => ({
  id: r.id as number, createdAt: iso(r.created_at), updatedAt: iso(r.updated_at), edits: r.edits as number, data: r.data as Prihlaska,
})

export async function createPrihlaska(data: Prihlaska): Promise<string> {
  await ensurePrihlaskaTables()
  const token = newToken()
  await sql`INSERT INTO prihlasky (token, data) VALUES (${token}, ${JSON.stringify(data)}::jsonb)`
  return token
}

export async function getPrihlaskaByToken(token: string): Promise<StoredPrihlaska | null> {
  await ensurePrihlaskaTables()
  const [row] = await sql`SELECT id, data, created_at, updated_at, edits FROM prihlasky WHERE token = ${token}`
  return row ? rowTo(row) : null
}

export async function updatePrihlaska(token: string, data: Prihlaska): Promise<boolean> {
  await ensurePrihlaskaTables()
  const rows = await sql`
    UPDATE prihlasky SET data = ${JSON.stringify(data)}::jsonb, updated_at = NOW(), edits = edits + 1
    WHERE token = ${token} RETURNING id
  `
  return rows.length > 0
}

/** Všechny přihlášky pro Přípravu, nejnovější první. Token se nevrací. */
export async function listPrihlasky(): Promise<StoredPrihlaska[]> {
  await ensurePrihlaskaTables()
  const rows = await sql`SELECT id, data, created_at, updated_at, edits FROM prihlasky ORDER BY created_at DESC`
  return rows.map(rowTo)
}
