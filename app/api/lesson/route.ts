import { sql } from "@/lib/db"
import { findActiveRunId } from "@/lib/runs"
import { noActiveRun } from "@/lib/run-status"
import { CHARACTERS } from "@/lib/data"
import { canClaimLesson, LESSON_POINTS } from "@/lib/lesson-claim"
import { parseDurationMin, validateLessonBody } from "@/lib/request-validation"

export async function POST(req: Request) {
  try {
    const raw: unknown = await req.json().catch(() => null)
    const error = validateLessonBody(raw, CHARACTERS.map(c => c.id))
    if (error) return new Response(error, { status: 400 })
    const body = raw as
      | { action: "toggle"; active: boolean; durationMin?: number }
      | { action: "claim"; characterId: string }

    const runId = await findActiveRunId()
    if (runId === null) return noActiveRun()

    if (body.action === "toggle") {
      const end = body.active
        ? new Date(Date.now() + parseDurationMin(body.durationMin)! * 60000).toISOString()
        : null
      if (body.active) {
        await sql.transaction([
          sql`
            UPDATE game_config
            SET lesson_window_active = ${body.active}, lesson_window_end = ${end}, updated_at = NOW()
            WHERE run_id = ${runId}
          `,
          sql`UPDATE character_state SET lesson_claimed_this_window = false WHERE run_id = ${runId}`,
        ])
      } else {
        await sql`
          UPDATE game_config
          SET lesson_window_active = false, lesson_window_end = null, updated_at = NOW()
          WHERE run_id = ${runId}
        `
      }
    } else if (body.action === "claim") {
      const characterId = body.characterId
      const teamId = CHARACTERS.find(c => c.id === characterId)?.teamId
      if (!teamId) return new Response("Postava nemá jednotku", { status: 400 })

      const [state] = await sql`
        SELECT g.lesson_window_active, g.lesson_window_end, s.lesson_claimed_this_window
        FROM game_config g, character_state s
        WHERE g.run_id = ${runId} AND s.run_id = ${runId} AND s.character_id = ${characterId}
      `
      const eligible = state && canClaimLesson({
        windowActive: state.lesson_window_active,
        windowEnd: state.lesson_window_end ? new Date(state.lesson_window_end) : null,
        alreadyClaimed: state.lesson_claimed_this_window,
      }, new Date())
      if (!eligible) return new Response("Body za hodinu nelze uplatnit", { status: 409 })

      const id = `PE${crypto.randomUUID()}`
      // Atomicky: označ claim + přičti body + zapiš log; podmínky se znovu ověřují v SQL
      const rows = await sql`
        WITH claim AS (
          UPDATE character_state
          SET lesson_claimed_this_window = true
          WHERE character_id = ${characterId} AND run_id = ${runId} AND lesson_claimed_this_window = false
            AND EXISTS (
              SELECT 1 FROM game_config
              WHERE run_id = ${runId} AND lesson_window_active = true AND lesson_window_end > NOW()
            )
          RETURNING character_id
        ),
        add_points AS (
          UPDATE character_points
          SET points = points + ${LESSON_POINTS}
          WHERE character_id = ${characterId} AND run_id = ${runId}
            AND EXISTS (SELECT 1 FROM claim)
          RETURNING character_id
        )
        INSERT INTO point_log (id, run_id, source_role, source_character_id, target_type, target_id, resolved_team_ids, resolved_character_ids, amount, action_type, note)
        SELECT ${id}, ${runId}, 'student', ${characterId}, 'student', ${characterId}, ${[teamId]}, ${[characterId]}, ${LESSON_POINTS}, 'lesson', 'Body za hodinu'
        WHERE EXISTS (SELECT 1 FROM claim)
        RETURNING id
      `
      if (rows.length === 0) return new Response("Body za hodinu nelze uplatnit", { status: 409 })
    } else {
      return new Response("Bad request", { status: 400 })
    }

    return new Response(null, { status: 204 })
  } catch {
    return new Response("Server error", { status: 500 })
  }
}
