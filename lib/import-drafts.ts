import { sql } from "@/lib/db"
import type { ImportPayload } from "@/lib/doc-validation"

// Návrhy importu: soubor importu, který poslal Claude (scripts/akano-mcp.mjs)
// nebo kdokoli s tokenem importu. Nic se z nich neuloží, dokud je Příprava
// v Texty → Import neprojde a nepotvrdí.

export type DraftStatus = "pending" | "applied" | "discarded"

export type ImportDraft = {
  id: number
  title: string
  source: string | null
  notes: string | null
  payload: ImportPayload
  status: DraftStatus
  createdBy: string | null
  createdAt: string
  resolvedBy: string | null
  resolvedAt: string | null
}

let ready: Promise<unknown> | null = null

function ensureDraftTable() {
  ready ??= sql`
    CREATE TABLE IF NOT EXISTS import_drafts (
      id          SERIAL PRIMARY KEY,
      title       TEXT NOT NULL,
      source      TEXT,
      notes       TEXT,
      payload     JSONB NOT NULL,
      status      TEXT NOT NULL DEFAULT 'pending',
      created_by  TEXT,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      resolved_by TEXT,
      resolved_at TIMESTAMPTZ
    )
  `.catch(err => { ready = null; throw err })
  return ready
}

const iso = (v: unknown) => v ? new Date(v as string).toISOString() : null

function rowToDraft(r: Record<string, unknown>): ImportDraft {
  return {
    id: r.id as number, title: r.title as string,
    source: (r.source as string) ?? null, notes: (r.notes as string) ?? null,
    payload: r.payload as ImportPayload, status: r.status as DraftStatus,
    createdBy: (r.created_by as string) ?? null, createdAt: iso(r.created_at)!,
    resolvedBy: (r.resolved_by as string) ?? null, resolvedAt: iso(r.resolved_at),
  }
}

export async function createDraft(d: { title: string; source: string | null; notes: string | null; payload: ImportPayload; by: string | null }) {
  await ensureDraftTable()
  const [row] = await sql`
    INSERT INTO import_drafts (title, source, notes, payload, created_by)
    VALUES (${d.title}, ${d.source}, ${d.notes}, ${JSON.stringify(d.payload)}::jsonb, ${d.by})
    RETURNING *
  `
  return rowToDraft(row)
}

/** Čekající návrhy a posledních 20 vyřízených. */
export async function listDrafts(): Promise<ImportDraft[]> {
  await ensureDraftTable()
  const rows = await sql`
    (SELECT * FROM import_drafts WHERE status = 'pending' ORDER BY created_at DESC)
    UNION ALL
    (SELECT * FROM import_drafts WHERE status <> 'pending' ORDER BY resolved_at DESC NULLS LAST LIMIT 20)
  `
  return rows.map(rowToDraft)
}

/** Vyřídí čekající návrh. Vrací false, když neexistuje nebo už vyřízený je. */
export async function resolveDraft(id: number, status: "applied" | "discarded", by: string | null): Promise<boolean> {
  await ensureDraftTable()
  const rows = await sql`
    UPDATE import_drafts SET status = ${status}, resolved_by = ${by}, resolved_at = NOW()
    WHERE id = ${id} AND status = 'pending'
    RETURNING id
  `
  return rows.length > 0
}
