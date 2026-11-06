import { sql } from "@/lib/db"
import { CHARACTERS } from "@/lib/data"
import { getActiveRunId } from "@/lib/runs"
import { adminGuard } from "@/lib/admin-auth"

export const dynamic = "force-dynamic"

export async function GET() {
  try {
    const runs = await sql`SELECT id, name, is_active, created_at FROM runs ORDER BY id ASC`
    return Response.json(runs)
  } catch (err) {
    console.error("[api/runs GET]", err)
    return new Response("Server error", { status: 500 })
  }
}

export async function POST(req: Request) {
  const denied = adminGuard(req)
  if (denied) return denied
  try {
    const { name } = await req.json() as { name: string }
    if (!name?.trim()) return new Response("Název je povinný", { status: 400 })

    const oldRunId = await getActiveRunId()

    // Copy team→unit mapping from current run
    const teamUnitRows = await sql`
      SELECT team_id, unit_id FROM team_units WHERE run_id = ${oldRunId}
    ` as { team_id: string; unit_id: string }[]

    const [newRun] = await sql`
      INSERT INTO runs (name, is_active) VALUES (${name.trim()}, FALSE) RETURNING id
    `
    const newRunId = newRun.id as number

    const pointChars = CHARACTERS.filter(c => c.role === "student" || c.role === "ruze")

    await sql.transaction([
      // Body: 0 pro všechny hráče (týmový součet se dopočítá)
      ...pointChars.map(c =>
        sql`INSERT INTO character_points (character_id, run_id, points) VALUES (${c.id}, ${newRunId}, 0)`
      ),
      // Stav postav: výchozí hodnoty
      ...CHARACTERS.map(c =>
        sql`
          INSERT INTO character_state (character_id, run_id, kaichi_level, peer_point_pool, lesson_claimed_this_window, specialization)
          VALUES (${c.id}, ${newRunId}, 0, 20, false, null)
        `
      ),
      // Alarm
      sql`INSERT INTO alarm_state (run_id, active, type, message, color) VALUES (${newRunId}, false, 'evacuation', '', '#c0392b')`,
      // Game config
      sql`INSERT INTO game_config (run_id, lesson_window_active, lesson_window_end) VALUES (${newRunId}, false, null)`,
      // Přiřazení jednotek (zkopírovat z předchozího běhu)
      ...teamUnitRows.map(r =>
        sql`INSERT INTO team_units (team_id, unit_id, run_id) VALUES (${r.team_id}, ${r.unit_id}, ${newRunId})`
      ),
    ])

    return Response.json({ id: newRunId })
  } catch (err) {
    console.error("[api/runs POST]", err)
    return new Response("Server error", { status: 500 })
  }
}

export async function PATCH(req: Request) {
  const denied = adminGuard(req)
  if (denied) return denied
  try {
    const body = await req.json() as { action: "setActive"; runId: number }
    if (body.action !== "setActive") return new Response("Bad request", { status: 400 })

    const [existing] = await sql`SELECT id FROM runs WHERE id = ${body.runId}`
    if (!existing) return new Response("Run not found", { status: 404 })

    await sql.transaction([
      sql`UPDATE runs SET is_active = FALSE WHERE is_active = TRUE`,
      sql`UPDATE runs SET is_active = TRUE WHERE id = ${body.runId}`,
    ])

    return new Response(null, { status: 204 })
  } catch (err) {
    console.error("[api/runs PATCH]", err)
    return new Response("Server error", { status: 500 })
  }
}
