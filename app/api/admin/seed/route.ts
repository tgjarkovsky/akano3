import { sql } from "@/lib/db"
import { requireAdmin } from "@/lib/admin-password"
import { INITIAL_POINT_LOG, CHARACTERS } from "@/lib/data"

export const dynamic = "force-dynamic"

// Seed mock point data for run 1.
// Resets point_log and character_points for run 1, then inserts INITIAL_POINT_LOG
// and each student's starting individual points (team totals derive from these).
export async function POST(req: Request) {
  const denied = await requireAdmin(req)
  if (denied) return denied

  try {
    const runId = 1
    const pointChars = CHARACTERS.filter(c => c.role === "student" || c.role === "ruze")

    await sql.transaction([
      sql`DELETE FROM point_log        WHERE run_id = ${runId}`,
      sql`DELETE FROM character_points WHERE run_id = ${runId}`,
      ...INITIAL_POINT_LOG.map(e =>
        sql`
          INSERT INTO point_log
            (id, run_id, source_role, source_character_id, target_type, target_id,
             resolved_team_ids, amount, action_type, note, timestamp)
          VALUES
            (${e.id}, ${runId}, ${e.sourceRole}, ${e.sourceCharacterId},
             ${e.targetType}, ${e.targetId}, ${e.resolvedTeamIds},
             ${e.amount}, ${e.actionType}, ${e.note ?? null}, ${e.timestamp.toISOString()})
        `
      ),
      ...pointChars.map(c =>
        sql`
          INSERT INTO character_points (character_id, run_id, points)
          VALUES (${c.id}, ${runId}, ${c.points})
        `
      ),
    ])

    return Response.json({ ok: true, seeded: INITIAL_POINT_LOG.length, characters: pointChars.length })
  } catch (err) {
    console.error("[admin/seed]", err)
    return new Response(String(err), { status: 500 })
  }
}
