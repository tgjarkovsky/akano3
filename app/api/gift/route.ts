import { sql } from "@/lib/db"
import { CHARACTERS } from "@/lib/data"
import { validateGift } from "@/lib/gift-validation"
import { findActiveRunId } from "@/lib/runs"
import { noActiveRun } from "@/lib/run-status"

export async function POST(req: Request) {
  try {
    const { fromId, toId, amount } = await req.json() as { fromId: string; toId: string; amount: number }
    const error = validateGift(fromId, toId, amount, CHARACTERS)
    if (error) return new Response(error, { status: 400 })

    const from = CHARACTERS.find(c => c.id === fromId)!
    const to   = CHARACTERS.find(c => c.id === toId)!

    const runId = await findActiveRunId()
    if (runId === null) return noActiveRun()
    const id = `PE${crypto.randomUUID()}`

    // Atomická operace: odečti pool + přidej body příjemci + zapiš log v jedné transakci
    // CTE zajistí že pool deduction a character_points update jsou nedělitelné
    const rows = await sql`
      WITH deduct AS (
        UPDATE character_state
        SET peer_point_pool = peer_point_pool - ${amount}
        WHERE character_id = ${fromId} AND run_id = ${runId} AND peer_point_pool >= ${amount}
        RETURNING character_id
      ),
      add_points AS (
        UPDATE character_points
        SET points = points + ${amount}
        WHERE character_id = ${toId} AND run_id = ${runId}
          AND EXISTS (SELECT 1 FROM deduct)
        RETURNING character_id
      )
      INSERT INTO point_log (id, run_id, source_role, source_character_id, target_type, target_id, resolved_team_ids, resolved_character_ids, amount, action_type, note)
      SELECT ${id}, ${runId}, 'student', ${fromId}, 'student', ${toId}, ${[to.teamId!]}, ${[toId]}, ${amount}, 'peer_gift', ${`Dar od ${from.name} pro ${to.name}`}
      WHERE EXISTS (SELECT 1 FROM deduct)
      RETURNING id
    `

    if (rows.length === 0) return new Response("Nedostatečný pool bodů", { status: 422 })

    return new Response(null, { status: 204 })
  } catch (err) {
    console.error("[api/gift]", err)
    return new Response("Server error", { status: 500 })
  }
}
