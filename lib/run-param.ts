import { sql } from "@/lib/db"
import { getActiveRunId } from "@/lib/runs"

/**
 * Běh, se kterým pracuje Příprava: z požadavku (?run= nebo runId v těle),
 * bez něj aktivní běh. Neexistující nebo neplatný běh vrací null.
 * Příprava se dělá dávno před hraním, proto na aktivním běhu nezávisí.
 */
export async function requestedRunId(value: unknown): Promise<number | null> {
  if (value === undefined || value === null || value === "") return getActiveRunId()
  const id = typeof value === "string" && /^\d+$/.test(value) ? Number(value) : value
  if (typeof id !== "number" || !Number.isInteger(id) || id <= 0) return null
  const [r] = await sql`SELECT id FROM runs WHERE id = ${id}`
  return r ? id : null
}

export const runParam = (req: Request) => new URL(req.url).searchParams.get("run")
export const unknownRun = () => new Response("Neznámý běh", { status: 400 })
