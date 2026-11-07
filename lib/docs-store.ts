import { sql } from "@/lib/db"
import type { DocEntityType } from "@/lib/doc-fields"
import { statusAfterEdit, statusAfterAction, checkTransition, statusOf, type StoredStatus, type StatusAction } from "@/lib/doc-status"
import type { ImportRole, RoleInput } from "@/lib/doc-validation"
import type { Triplet } from "@/lib/types"

// Texty dokumentů postav v databázi. Souběžné úpravy hlídá číslo verze:
// kdo ukládá, posílá verzi, kterou viděl; když se mezitím změnila, dostane konflikt.

let ready: Promise<void> | null = null

export function ensureDocTables(): Promise<void> {
  ready ??= (async () => {
    await sql`
      CREATE TABLE IF NOT EXISTS doc_texts (
        entity_type TEXT NOT NULL,
        entity_id   TEXT NOT NULL,
        field       TEXT NOT NULL,
        body        TEXT NOT NULL DEFAULT '',
        status      TEXT,
        changed_after_approval BOOLEAN NOT NULL DEFAULT FALSE,
        version     INT NOT NULL DEFAULT 1,
        updated_by  TEXT, updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        done_by     TEXT, done_at TIMESTAMPTZ,
        approved_by TEXT, approved_at TIMESTAMPTZ,
        PRIMARY KEY (entity_type, entity_id, field)
      )
    `
    await sql`
      CREATE TABLE IF NOT EXISTS unit_roles (
        id SERIAL PRIMARY KEY,
        unit_id TEXT NOT NULL,
        triplet TEXT NOT NULL,
        key     TEXT NOT NULL,
        name_m  TEXT NOT NULL,
        name_f  TEXT NOT NULL,
        sort_order INT NOT NULL DEFAULT 0,
        UNIQUE (unit_id, key)
      )
    `
    // Jednorázové úpravy dat. Značka a úprava jsou jeden příkaz, takže proběhnou spolu, nebo vůbec.
    await sql`CREATE TABLE IF NOT EXISTS doc_migrations (name TEXT PRIMARY KEY, done_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`
    // 2026-11-07: dosavadní veřejné texty týmů jsou medailonky (známé před přihláškou na larp).
    await sql`
      WITH m AS (
        INSERT INTO doc_migrations (name) VALUES ('team-public-to-medallion')
        ON CONFLICT (name) DO NOTHING RETURNING name
      )
      UPDATE doc_texts t SET field = 'medallion'
      WHERE EXISTS (SELECT 1 FROM m) AND t.entity_type = 'team' AND t.field = 'public'
        AND NOT EXISTS (SELECT 1 FROM doc_texts d WHERE d.entity_type = 'team' AND d.entity_id = t.entity_id AND d.field = 'medallion')
    `
    await sql`
      CREATE TABLE IF NOT EXISTS character_meta (
        character_id TEXT PRIMARY KEY,
        gender TEXT
      )
    `
  })().catch(err => { ready = null; throw err })
  return ready
}

export type TextMeta = {
  entityType: DocEntityType; entityId: string; field: string
  length: number; status: StoredStatus; changedAfterApproval: boolean; version: number
  updatedBy: string | null; updatedAt: string
  doneBy: string | null; doneAt: string | null
  approvedBy: string | null; approvedAt: string | null
}
export type TextRecord = TextMeta & { body: string }

export type UnitRole = { id: number; unitId: string; triplet: Triplet; key: string; nameM: string; nameF: string; sortOrder: number }

const iso = (v: unknown) => v ? new Date(v as string).toISOString() : null

function rowToMeta(r: Record<string, unknown>): TextMeta {
  return {
    entityType: r.entity_type as DocEntityType, entityId: r.entity_id as string, field: r.field as string,
    length: Number(r.length ?? (r.body as string | undefined)?.length ?? 0),
    status: (r.status as StoredStatus) ?? null,
    changedAfterApproval: r.changed_after_approval as boolean,
    version: r.version as number,
    updatedBy: (r.updated_by as string) ?? null, updatedAt: iso(r.updated_at)!,
    doneBy: (r.done_by as string) ?? null, doneAt: iso(r.done_at),
    approvedBy: (r.approved_by as string) ?? null, approvedAt: iso(r.approved_at),
  }
}
const rowToRecord = (r: Record<string, unknown>): TextRecord => ({ ...rowToMeta(r), body: r.body as string })

function rowToRole(r: Record<string, unknown>): UnitRole {
  return {
    id: r.id as number, unitId: r.unit_id as string, triplet: r.triplet as Triplet, key: r.key as string,
    nameM: r.name_m as string, nameF: r.name_f as string, sortOrder: r.sort_order as number,
  }
}

export async function getOverview() {
  await ensureDocTables()
  const [texts, roles, meta] = await Promise.all([
    sql`SELECT entity_type, entity_id, field, length(body) AS length, status, changed_after_approval, version,
               updated_by, updated_at, done_by, done_at, approved_by, approved_at FROM doc_texts`,
    sql`SELECT * FROM unit_roles ORDER BY unit_id, triplet, sort_order, id`,
    sql`SELECT character_id, gender FROM character_meta`,
  ])
  return {
    texts: texts.map(rowToMeta),
    roles: roles.map(rowToRole),
    genders: Object.fromEntries(meta.map(m => [m.character_id as string, m.gender as string | null])),
  }
}

export async function getEntityTexts(entityType: DocEntityType, entityId: string): Promise<TextRecord[]> {
  await ensureDocTables()
  const rows = await sql`SELECT * FROM doc_texts WHERE entity_type = ${entityType} AND entity_id = ${entityId}`
  return rows.map(rowToRecord)
}

async function getText(entityType: string, entityId: string, field: string): Promise<TextRecord | null> {
  const [row] = await sql`SELECT * FROM doc_texts WHERE entity_type = ${entityType} AND entity_id = ${entityId} AND field = ${field}`
  return row ? rowToRecord(row) : null
}

export type SaveResult = { ok: true; record: TextRecord } | { ok: false; conflict: TextRecord | null; error?: string }

export async function saveText(input: {
  entityType: DocEntityType; entityId: string; field: string
  body: string; expectedVersion: number | null; keepStatus: boolean; by: string | null
}): Promise<SaveResult> {
  await ensureDocTables()
  const { entityType, entityId, field, body, by } = input

  if (input.expectedVersion === null) {
    const rows = await sql`
      INSERT INTO doc_texts (entity_type, entity_id, field, body, updated_by)
      VALUES (${entityType}, ${entityId}, ${field}, ${body}, ${by})
      ON CONFLICT (entity_type, entity_id, field) DO NOTHING
      RETURNING *
    `
    if (rows.length > 0) return { ok: true, record: rowToRecord(rows[0]) }
    return { ok: false, conflict: await getText(entityType, entityId, field) }
  }

  const current = await getText(entityType, entityId, field)
  if (!current || current.version !== input.expectedVersion) return { ok: false, conflict: current }
  const next = statusAfterEdit(
    { status: current.status, changedAfterApproval: current.changedAfterApproval },
    current.body !== body, input.keepStatus,
  )
  const rows = await sql`
    UPDATE doc_texts SET
      body = ${body}, status = ${next.status}, changed_after_approval = ${next.changedAfterApproval},
      version = version + 1, updated_by = ${by}, updated_at = NOW()
    WHERE entity_type = ${entityType} AND entity_id = ${entityId} AND field = ${field} AND version = ${input.expectedVersion}
    RETURNING *
  `
  if (rows.length > 0) return { ok: true, record: rowToRecord(rows[0]) }
  return { ok: false, conflict: await getText(entityType, entityId, field) }
}

export async function changeStatus(input: {
  entityType: DocEntityType; entityId: string; field: string
  action: StatusAction; expectedVersion: number; by: string | null
}): Promise<SaveResult> {
  await ensureDocTables()
  const current = await getText(input.entityType, input.entityId, input.field)
  if (!current || current.version !== input.expectedVersion) return { ok: false, conflict: current }
  const err = checkTransition(statusOf(current), input.action)
  if (err) return { ok: false, conflict: null, error: err }
  const next = statusAfterAction(input.action)
  const { by } = input
  const rows = await sql`
    UPDATE doc_texts SET
      status = ${next.status},
      changed_after_approval = CASE WHEN ${next.clearsChangedFlag} THEN FALSE ELSE changed_after_approval END,
      done_by     = CASE WHEN ${input.action} = 'done'    THEN ${by} ELSE done_by END,
      done_at     = CASE WHEN ${input.action} = 'done'    THEN NOW() ELSE done_at END,
      approved_by = CASE WHEN ${input.action} = 'approve' THEN ${by} ELSE approved_by END,
      approved_at = CASE WHEN ${input.action} = 'approve' THEN NOW() ELSE approved_at END,
      version = version + 1
    WHERE entity_type = ${input.entityType} AND entity_id = ${input.entityId} AND field = ${input.field}
      AND version = ${input.expectedVersion}
    RETURNING *
  `
  if (rows.length > 0) return { ok: true, record: rowToRecord(rows[0]) }
  return { ok: false, conflict: await getText(input.entityType, input.entityId, input.field) }
}

// ── Role jednotek ──────────────────────────────────────────────────────

export async function createRole(r: RoleInput): Promise<UnitRole | "duplicate"> {
  await ensureDocTables()
  const rows = await sql`
    INSERT INTO unit_roles (unit_id, triplet, key, name_m, name_f, sort_order)
    VALUES (${r.unitId}, ${r.triplet}, ${r.key}, ${r.nameM}, ${r.nameF},
      (SELECT COALESCE(MAX(sort_order), 0) + 1 FROM unit_roles WHERE unit_id = ${r.unitId} AND triplet = ${r.triplet}))
    ON CONFLICT (unit_id, key) DO NOTHING
    RETURNING *
  `
  return rows.length > 0 ? rowToRole(rows[0]) : "duplicate"
}

export async function updateRole(id: number, r: RoleInput): Promise<UnitRole | "duplicate" | "missing"> {
  await ensureDocTables()
  const [clash] = await sql`SELECT id FROM unit_roles WHERE unit_id = ${r.unitId} AND key = ${r.key} AND id <> ${id}`
  if (clash) return "duplicate"
  const rows = await sql`
    UPDATE unit_roles SET unit_id = ${r.unitId}, triplet = ${r.triplet}, key = ${r.key}, name_m = ${r.nameM}, name_f = ${r.nameF}
    WHERE id = ${id} RETURNING *
  `
  return rows.length > 0 ? rowToRole(rows[0]) : "missing"
}

export async function deleteRole(id: number) {
  await ensureDocTables()
  await sql.transaction([
    sql`DELETE FROM doc_texts WHERE entity_type = 'role' AND entity_id = ${String(id)}`,
    sql`DELETE FROM unit_roles WHERE id = ${id}`,
  ])
}

export async function setGender(characterId: string, gender: "m" | "f" | null) {
  await ensureDocTables()
  await sql`
    INSERT INTO character_meta (character_id, gender) VALUES (${characterId}, ${gender})
    ON CONFLICT (character_id) DO UPDATE SET gender = EXCLUDED.gender
  `
}

// ── Hromadný import ────────────────────────────────────────────────────

/**
 * Přepíše texty z importu. Změněný text se vrací do stavu rozepsané (schválený
 * dostane příznak změněno po schválení), stejný text se nechá být.
 */
export async function importTexts(
  texts: { entityType: DocEntityType; entityId: string; field: string; body: string }[],
  genders: { characterId: string; gender: "m" | "f" }[],
  by: string | null,
  roles: ImportRole[] = [],
): Promise<{ created: number; updated: number; unchanged: number; genders: number; roles: number }> {
  await ensureDocTables()
  // Role napřed: jejich osobní text potřebuje id. Existující role (stejná jednotka
  // a klíč) se nechá, jak je, i s názvy a trojicí, které mohl někdo upravit.
  let newRoles = 0
  if (roles.length > 0) {
    const inserted = await sql.transaction(roles.map(r => sql`
      INSERT INTO unit_roles (unit_id, triplet, key, name_m, name_f, sort_order)
      VALUES (${r.unitId}, ${r.triplet}, ${r.key}, ${r.nameM}, ${r.nameF},
        (SELECT COALESCE(MAX(sort_order), 0) + 1 FROM unit_roles WHERE unit_id = ${r.unitId} AND triplet = ${r.triplet}))
      ON CONFLICT (unit_id, key) DO NOTHING
      RETURNING id
    `))
    newRoles = inserted.filter(rows => rows.length > 0).length
    const all = await sql`SELECT id, unit_id, key FROM unit_roles`
    const idOf = new Map(all.map(r => [`${r.unit_id}:${r.key}`, String(r.id)]))
    texts = [...texts, ...roles.map(r => ({ entityType: "role" as const, entityId: idOf.get(`${r.unitId}:${r.key}`)!, field: "personal", body: r.body }))]
  }
  const existing = await sql`SELECT entity_type, entity_id, field, body FROM doc_texts`
  const current = new Map(existing.map(r => [`${r.entity_type}:${r.entity_id}:${r.field}`, r.body as string]))
  let created = 0, updated = 0, unchanged = 0
  const queries = []
  for (const t of texts) {
    const prev = current.get(`${t.entityType}:${t.entityId}:${t.field}`)
    if (prev === t.body) { unchanged++; continue }
    if (prev === undefined) created++; else updated++
    queries.push(sql`
      INSERT INTO doc_texts (entity_type, entity_id, field, body, updated_by)
      VALUES (${t.entityType}, ${t.entityId}, ${t.field}, ${t.body}, ${by})
      ON CONFLICT (entity_type, entity_id, field) DO UPDATE SET
        body = EXCLUDED.body,
        -- status bývá NULL (rozepsané); „x OR NULL“ by dalo NULL do povinného sloupce
        changed_after_approval = doc_texts.changed_after_approval OR COALESCE(doc_texts.status = 'approved', FALSE),
        status = NULL,
        version = doc_texts.version + 1,
        updated_by = EXCLUDED.updated_by,
        updated_at = NOW()
    `)
  }
  for (const g of genders) {
    queries.push(sql`
      INSERT INTO character_meta (character_id, gender) VALUES (${g.characterId}, ${g.gender})
      ON CONFLICT (character_id) DO UPDATE SET gender = EXCLUDED.gender
    `)
  }
  if (queries.length > 0) await sql.transaction(queries)
  return { created, updated, unchanged, genders: genders.length, roles: newRoles }
}
