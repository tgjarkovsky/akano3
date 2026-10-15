import { sql } from "@/lib/db"
import { resolveTargetCharacters, teamsOfChars } from "@/lib/utils"
import { reversalCredits, REVERSAL_PREFIX, type RunMapping } from "@/lib/point-resolution"
import { getActiveRunId } from "@/lib/runs"
import type { PointEntry } from "@/lib/types"

async function loadRunMapping(targetType: string, runId: number): Promise<RunMapping | undefined> {
  if (targetType !== "unit" && targetType !== "circle") return undefined
  const [tuRows, cmRows] = await Promise.all([
    sql`SELECT team_id, unit_id FROM team_units WHERE run_id = ${runId}`,
    sql`SELECT circle_id, character_id FROM circle_members WHERE run_id = ${runId}`,
  ])
  const teamUnits: Record<string, string> = {}
  for (const r of tuRows) teamUnits[r.team_id] = r.unit_id
  const circleMembers: Record<string, string[]> = {}
  for (const r of cmRows) (circleMembers[r.circle_id] ??= []).push(r.character_id)
  return { teamUnits, circleMembers }
}

export async function POST(req: Request) {
  try {
    const body = await req.json() as Omit<PointEntry, "id" | "timestamp" | "resolvedTeamIds" | "resolvedCharacterIds"> & { reversesId?: string }

    // Růže is limited to small nudges on individual students.
    // ponytail: role comes from the client (no session auth anywhere in this API) —
    // consistency guard, not security; real auth would need sessions.
    if (body.sourceRole === "ruze" && (body.targetType !== "student" || Math.abs(body.amount) > 5)) {
      return new Response("Ruze may only assign ±5 points to individual students", { status: 400 })
    }

    const runId = await getActiveRunId()

    let resolvedCharacterIds: string[]
    let resolvedTeamIds: string[]
    let amount = body.amount

    if (body.reversesId) {
      // Reversal: credit exactly the recipients of the original, not the current mapping.
      const [original] = await sql`
        SELECT amount, resolved_team_ids, resolved_character_ids FROM point_log
        WHERE id = ${body.reversesId} AND run_id = ${runId}
      `
      if (!original) return new Response("Original entry not found", { status: 404 })
      const prefix = `${REVERSAL_PREFIX}${body.reversesId}`
      const [existing] = await sql`
        SELECT id FROM point_log
        WHERE run_id = ${runId} AND action_type = 'correction'
          AND (note = ${prefix} OR note LIKE ${prefix + " (%"})
      `
      if (existing) return new Response("Entry already reversed", { status: 409 })
      ;({ resolvedCharacterIds, resolvedTeamIds } = reversalCredits({
        resolvedCharacterIds: original.resolved_character_ids ?? undefined,
        resolvedTeamIds: original.resolved_team_ids ?? [],
      }))
      amount = -original.amount
    } else {
      const mapping = await loadRunMapping(body.targetType, runId)
      resolvedCharacterIds = resolveTargetCharacters(body.targetType, body.targetId, mapping)
      resolvedTeamIds = teamsOfChars(resolvedCharacterIds)
    }

    const id = `PE${crypto.randomUUID()}`

    await sql.transaction([
      sql`
        INSERT INTO point_log (id, run_id, source_role, source_character_id, target_type, target_id, resolved_team_ids, resolved_character_ids, amount, action_type, note)
        VALUES (${id}, ${runId}, ${body.sourceRole}, ${body.sourceCharacterId}, ${body.targetType}, ${body.targetId}, ${resolvedTeamIds}, ${resolvedCharacterIds}, ${amount}, ${body.actionType}, ${body.note ?? null})
      `,
      ...resolvedCharacterIds.map(charId =>
        sql`UPDATE character_points SET points = points + ${amount} WHERE character_id = ${charId} AND run_id = ${runId}`
      ),
    ])

    return Response.json({ id, resolvedTeamIds, resolvedCharacterIds })
  } catch (err) {
    console.error("[api/points]", err)
    return new Response("Server error", { status: 500 })
  }
}
