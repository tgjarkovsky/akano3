import { sql } from "@/lib/db"
import { getActiveRunId } from "@/lib/runs"
import { CHARACTERS, CIRCLES, TEAMS, UNITS } from "@/lib/data"
import { validateConfigBody } from "@/lib/request-validation"
import { parsePoolRefill } from "@/lib/peer-pool"

// GM-only: manage team→unit, circle members, specializations

export async function POST(req: Request) {
  try {
    const raw: unknown = await req.json().catch(() => null)
    const error = validateConfigBody(raw, {
      teamIds: TEAMS.map(t => t.id),
      unitIds: UNITS.map(u => u.id),
      circleIds: CIRCLES.map(c => c.id),
      characterIds: CHARACTERS.map(c => c.id),
    })
    if (error) return new Response(error, { status: 400 })
    const body = raw as
      | { action: "setTeamUnit"; teamId: string; unitId: string }
      | { action: "setCircleMembers"; circleId: string; memberIds: string[] }
      | { action: "setSpecialization"; characterId: string; specialization: string | null }
      | { action: "refillPeerPool"; amount: number; mode: string }

    const runId = await getActiveRunId()

    if (body.action === "setTeamUnit") {
      await sql`UPDATE team_units SET unit_id = ${body.unitId} WHERE team_id = ${body.teamId} AND run_id = ${runId}`
    } else if (body.action === "setCircleMembers") {
      if (body.memberIds.length > 0) {
        await sql.transaction([
          sql`DELETE FROM circle_members WHERE circle_id = ${body.circleId} AND run_id = ${runId}`,
          sql`INSERT INTO circle_members (circle_id, character_id, run_id) SELECT ${body.circleId}, unnest(${body.memberIds}::text[]), ${runId}`,
        ])
      } else {
        await sql`DELETE FROM circle_members WHERE circle_id = ${body.circleId} AND run_id = ${runId}`
      }
    } else if (body.action === "setSpecialization") {
      await sql`UPDATE character_state SET specialization = ${body.specialization} WHERE character_id = ${body.characterId} AND run_id = ${runId}`
    } else if (body.action === "refillPeerPool") {
      const refill = parsePoolRefill(body)
      if (typeof refill === "string") return new Response(refill, { status: 400 })
      const playerIds = CHARACTERS.filter(c => c.role === "student" || c.role === "ruze").map(c => c.id)
      await sql`UPDATE character_state
        SET peer_point_pool = CASE WHEN ${refill.mode} = 'add' THEN peer_point_pool + ${refill.amount}::int ELSE ${refill.amount}::int END
        WHERE run_id = ${runId} AND character_id = ANY(${playerIds}::text[])`
    } else {
      return new Response("Bad request", { status: 400 })
    }

    return new Response(null, { status: 204 })
  } catch {
    return new Response("Server error", { status: 500 })
  }
}
