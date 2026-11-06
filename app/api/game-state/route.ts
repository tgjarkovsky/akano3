import { sql } from "@/lib/db"
import { getActiveRunId } from "@/lib/runs"
import { ensureSetupColumns } from "@/lib/setup-schema"

export const dynamic = "force-dynamic"

export async function GET() {
  try {
    const runId = await getActiveRunId()
    await ensureSetupColumns()

    const [alarm, config, characterPoints, charState, circleMembers, teamUnits, pointLog, qrCodes, runs] =
      await Promise.all([
        sql`SELECT * FROM alarm_state WHERE run_id = ${runId} LIMIT 1`,
        sql`SELECT * FROM game_config WHERE run_id = ${runId} LIMIT 1`,
        sql`SELECT character_id, points FROM character_points WHERE run_id = ${runId}`,
        sql`SELECT character_id, kaichi_level, peer_point_pool, lesson_claimed_this_window, specialization, origin FROM character_state WHERE run_id = ${runId}`,
        sql`SELECT circle_id, character_id FROM circle_members WHERE run_id = ${runId}`,
        sql`SELECT team_id, unit_id, triplet FROM team_units WHERE run_id = ${runId} ORDER BY team_id`,
        sql`SELECT * FROM point_log WHERE run_id = ${runId} ORDER BY timestamp DESC LIMIT 200`,
        sql`SELECT * FROM qr_codes ORDER BY created_at DESC`,
        sql`SELECT id, name, is_active, created_at FROM runs ORDER BY id ASC`,
      ])

    return Response.json({
      activeRunId: runId,
      runs,
      alarm: alarm[0],
      config: config[0],
      characterPoints,
      charState,
      circleMembers,
      teamUnits,
      pointLog,
      qrCodes,
    })
  } catch (err) {
    console.error("[api/game-state]", err)
    return new Response("Server error", { status: 500 })
  }
}
