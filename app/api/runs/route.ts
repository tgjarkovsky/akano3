import { sql } from "@/lib/db"
import { CHARACTERS } from "@/lib/data"
import { getActiveRunId } from "@/lib/runs"
import { ensureSetupColumns } from "@/lib/setup-schema"
import { requireAdmin } from "@/lib/admin-password"

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
  const denied = await requireAdmin(req)
  if (denied) return denied
  try {
    const { name } = await req.json() as { name: string }
    if (!name?.trim()) return new Response("Název je povinný", { status: 400 })

    const oldRunId = await getActiveRunId()
    await ensureSetupColumns()

    // Copy team→unit mapping (včetně trojice A/B) from current run
    const teamUnitRows = await sql`
      SELECT team_id, unit_id, triplet FROM team_units WHERE run_id = ${oldRunId}
    ` as { team_id: string; unit_id: string; triplet: string | null }[]

    const [newRun] = await sql`
      INSERT INTO runs (name, is_active) VALUES (${name.trim()}, FALSE) RETURNING id
    `
    const newRunId = newRun.id as number

    // Obsazení postav (specializace, původ, kruhy) se přebírá jako výchozí bod
    const prevStateRows = await sql`
      SELECT character_id, specialization, origin FROM character_state WHERE run_id = ${oldRunId}
    ` as { character_id: string; specialization: string | null; origin: string | null }[]
    const prevState = new Map(prevStateRows.map(r => [r.character_id, r]))
    const circleRows = await sql`
      SELECT circle_id, character_id FROM circle_members WHERE run_id = ${oldRunId}
    ` as { circle_id: string; character_id: string }[]

    const pointChars = CHARACTERS.filter(c => c.role === "student" || c.role === "ruze")

    await sql.transaction([
      // Body: 0 pro všechny hráče (týmový součet se dopočítá)
      ...pointChars.map(c =>
        sql`INSERT INTO character_points (character_id, run_id, points) VALUES (${c.id}, ${newRunId}, 0)`
      ),
      // Stav postav: výchozí hodnoty
      ...CHARACTERS.map(c =>
        sql`
          INSERT INTO character_state (character_id, run_id, kaichi_level, peer_point_pool, lesson_claimed_this_window, specialization, origin)
          VALUES (${c.id}, ${newRunId}, 0, 20, false, ${prevState.get(c.id)?.specialization ?? null}, ${prevState.get(c.id)?.origin ?? null})
        `
      ),
      // Alarm
      sql`INSERT INTO alarm_state (run_id, active, type, message, color) VALUES (${newRunId}, false, 'evacuation', '', '#c0392b')`,
      // Game config
      sql`INSERT INTO game_config (run_id, lesson_window_active, lesson_window_end) VALUES (${newRunId}, false, null)`,
      // Přiřazení jednotek (zkopírovat z předchozího běhu)
      ...teamUnitRows.map(r =>
        sql`INSERT INTO team_units (team_id, unit_id, triplet, run_id) VALUES (${r.team_id}, ${r.unit_id}, ${r.triplet}, ${newRunId})`
      ),
      // Kruhy (zkopírovat z předchozího běhu)
      ...circleRows.map(r =>
        sql`INSERT INTO circle_members (circle_id, character_id, run_id) VALUES (${r.circle_id}, ${r.character_id}, ${newRunId})`
      ),
    ])

    return Response.json({ id: newRunId })
  } catch (err) {
    console.error("[api/runs POST]", err)
    return new Response("Server error", { status: 500 })
  }
}

export async function PATCH(req: Request) {
  const denied = await requireAdmin(req)
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
