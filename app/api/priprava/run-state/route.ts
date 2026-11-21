import { sql } from "@/lib/db"
import { requireAdmin } from "@/lib/admin-password"
import { ensureSetupColumns } from "@/lib/setup-schema"
import { requestedRunId, runParam, unknownRun } from "@/lib/run-param"

export const dynamic = "force-dynamic"

// GET /api/priprava/run-state?run=ID — rozvržení běhu pro Obsazení: jednotky týmů,
// specializace a původy postav, kruhy. Stejné řádky jako /api/game-state, ale pro
// libovolný běh (Příprava nezávisí na aktivním běhu).
export async function GET(req: Request) {
  const denied = await requireAdmin(req)
  if (denied) return denied
  try {
    const runId = await requestedRunId(runParam(req))
    if (runId === null) return unknownRun()
    await ensureSetupColumns()
    const [charState, circleMembers, teamUnits] = await Promise.all([
      sql`SELECT character_id, kaichi_level, peer_point_pool, lesson_claimed_this_window, specialization, origin FROM character_state WHERE run_id = ${runId}`,
      sql`SELECT circle_id, character_id FROM circle_members WHERE run_id = ${runId}`,
      sql`SELECT team_id, unit_id, triplet FROM team_units WHERE run_id = ${runId} ORDER BY team_id`,
    ])
    return Response.json({ runId, charState, circleMembers, teamUnits }, { headers: { "Cache-Control": "no-store" } })
  } catch (err) {
    console.error("[priprava/run-state GET]", err)
    return new Response("Server error", { status: 500 })
  }
}
