import { sql } from "@/lib/db"
import { requireAdmin } from "@/lib/admin-password"
import { TEAMS } from "@/lib/data"
import { teamMemberIds, splitPointsWeighted } from "@/lib/utils"
import { getActiveRunId } from "@/lib/runs"

export const dynamic = "force-dynamic"

// One-time: migrate the active run's team_points into individual character_points
// by splitting each team's total unevenly (random weights) across its members.
// Re-running resets character_points for the run first, so it's idempotent-ish.
export async function POST(req: Request) {
  const denied = await requireAdmin(req)
  if (denied) return denied

  try {
    const runId = await getActiveRunId()

    const teamRows = await sql`
      SELECT team_id, points FROM team_points WHERE run_id = ${runId}
    ` as { team_id: string; points: number }[]
    const totals: Record<string, number> = {}
    for (const { team_id, points } of teamRows) totals[team_id] = points

    const inserts: ReturnType<typeof sql>[] = []
    const result: Record<string, number> = {}
    for (const team of TEAMS) {
      const members = teamMemberIds(team.id)
      if (!members.length) continue
      const weights = members.map(() => Math.random() + 0.01)
      const shares = splitPointsWeighted(totals[team.id] ?? 0, weights)
      members.forEach((cid, i) => {
        result[cid] = shares[i]
        inserts.push(sql`
          INSERT INTO character_points (character_id, run_id, points)
          VALUES (${cid}, ${runId}, ${shares[i]})
          ON CONFLICT (character_id, run_id) DO UPDATE SET points = EXCLUDED.points
        `)
      })
    }

    await sql.transaction([
      sql`DELETE FROM character_points WHERE run_id = ${runId}`,
      ...inserts,
    ])

    return Response.json({ ok: true, runId, characters: Object.keys(result).length, split: result })
  } catch (err) {
    console.error("[admin/backfill-points]", err)
    return new Response(String(err), { status: 500 })
  }
}
