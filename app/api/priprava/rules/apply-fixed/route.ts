import { sql } from "@/lib/db"
import { requireAdmin } from "@/lib/admin-password"
import { getActiveRunId } from "@/lib/runs"
import { CHARACTERS } from "@/lib/data"
import { indexRules, pendingFixedValues } from "@/lib/assignment-rules"
import { getRules } from "@/lib/rules-store"

export const dynamic = "force-dynamic"

// POST /api/priprava/rules/apply-fixed — v aktivním běhu doplní všem postavám
// hodnoty, které pravidla určují napevno (specializace, původ, kruh).
export async function POST(req: Request) {
  const denied = await requireAdmin(req)
  if (denied) return denied
  try {
    const runId = await getActiveRunId()
    const index = indexRules(await getRules())
    const [state, circles] = await Promise.all([
      sql`SELECT character_id, specialization, origin FROM character_state WHERE run_id = ${runId}`,
      sql`SELECT character_id, circle_id FROM circle_members WHERE run_id = ${runId}`,
    ])
    const players = CHARACTERS.filter(c => c.role === "student" || c.role === "ruze").map(c => {
      const s = state.find(r => r.character_id === c.id)
      return {
        id: c.id,
        specialization: (s?.specialization as string | null) ?? undefined,
        origin: (s?.origin as string | null) ?? undefined,
        circleIds: circles.filter(r => r.character_id === c.id).map(r => r.circle_id as string),
      }
    })
    const todo = pendingFixedValues(index, players)
    if (todo.length > 0) {
      await sql.transaction(todo.flatMap(t =>
        t.property === "specialization"
          ? [sql`UPDATE character_state SET specialization = ${t.value} WHERE character_id = ${t.characterId} AND run_id = ${runId}`]
          : t.property === "origin"
            ? [sql`UPDATE character_state SET origin = ${t.value} WHERE character_id = ${t.characterId} AND run_id = ${runId}`]
            : [
                sql`DELETE FROM circle_members WHERE character_id = ${t.characterId} AND run_id = ${runId}`,
                sql`INSERT INTO circle_members (circle_id, character_id, run_id) VALUES (${t.value}, ${t.characterId}, ${runId})`,
              ]
      ))
    }
    return Response.json({ applied: todo.length })
  } catch (err) {
    console.error("[priprava/rules/apply-fixed]", err)
    return new Response("Server error", { status: 500 })
  }
}
