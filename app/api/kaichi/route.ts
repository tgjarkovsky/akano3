import { sql } from "@/lib/db"
import { findActiveRunId } from "@/lib/runs"
import { noActiveRun } from "@/lib/run-status"
import { parseKaichiLevel } from "@/lib/wiki-validation"

export async function POST(req: Request) {
  try {
    const { characterId, level } = await req.json() as { characterId: string; level?: number }
    const runId = await findActiveRunId()
    if (runId === null) return noActiveRun()
    if (level !== undefined) {
      const parsed = parseKaichiLevel(level)
      if (!parsed.ok) return new Response(parsed.error, { status: 400 })
      await sql`
        UPDATE character_state
        SET kaichi_level = ${parsed.value}
        WHERE character_id = ${characterId} AND run_id = ${runId}
      `
    } else {
      await sql`
        UPDATE character_state
        SET kaichi_level = LEAST(kaichi_level + 1, 8)
        WHERE character_id = ${characterId} AND run_id = ${runId}
      `
    }
    return new Response(null, { status: 204 })
  } catch {
    return new Response("Server error", { status: 500 })
  }
}
