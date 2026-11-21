import { sql } from "@/lib/db"
import { templateRunId } from "@/lib/run-status"

/** Aktivní běh (hraje se ve Velínu), nebo null, když se zrovna nehraje. */
export async function findActiveRunId(): Promise<number | null> {
  const [row] = await sql`SELECT id FROM runs WHERE is_active = TRUE LIMIT 1`
  return row ? (row.id as number) : null
}

/** Aktivní běh; bez něj hází. Herní API raději findActiveRunId() + noActiveRun(). */
export async function getActiveRunId(): Promise<number> {
  const id = await findActiveRunId()
  if (id === null) throw new Error("No active run")
  return id
}

/** Běh, ze kterého nový běh kopíruje rozvržení: aktivní, bez něj poslední založený. */
export async function findTemplateRunId(): Promise<number | null> {
  const rows = await sql`SELECT id, is_active, created_at FROM runs`
  return templateRunId(rows.map(r => ({ id: r.id as number, isActive: r.is_active as boolean, createdAt: r.created_at as string })))
}
