import { sql } from "@/lib/db"
import { getActiveRunId } from "@/lib/runs"
import { CHARACTERS, CIRCLES, TEAMS, UNITS } from "@/lib/data"
import { validateConfigBody } from "@/lib/request-validation"
import { parsePoolRefill } from "@/lib/peer-pool"
import { requireAdmin } from "@/lib/admin-password"
import { configActionNeedsAdmin } from "@/lib/config-auth"
import { ensureSetupColumns } from "@/lib/setup-schema"
import { computeUnitSlots, planTeamMove, type TeamPlacement } from "@/lib/unit-slots"
import type { Triplet } from "@/lib/types"

// Obsazení běhu (jednotky, kruhy, specializace, původ) jen z Přípravy s heslem.
// Tým je vždy v jedné jednotce (placeTeam), postava vždy v jednom kruhu (setCharacterCircle).
// Doplnění poolu darů volá Velín během hry.

export async function POST(req: Request) {
  try {
    const raw: unknown = await req.json().catch(() => null)
    if (configActionNeedsAdmin((raw as { action?: unknown } | null)?.action)) {
      const denied = await requireAdmin(req)
      if (denied) return denied
    }
    const error = validateConfigBody(raw, {
      teamIds: TEAMS.map(t => t.id),
      unitIds: UNITS.map(u => u.id),
      circleIds: CIRCLES.map(c => c.id),
      characterIds: CHARACTERS.map(c => c.id),
    })
    if (error) return new Response(error, { status: 400 })
    const body = raw as
      | { action: "setSpecialization"; characterId: string; specialization: string | null }
      | { action: "placeTeam"; teamId: string; unitId: string; triplet: Triplet }
      | { action: "setOrigin"; characterId: string; origin: string | null }
      | { action: "setCharacterCircle"; characterId: string; circleId: string }
      | { action: "refillPeerPool"; amount: number; mode: string }

    const runId = await getActiveRunId()
    await ensureSetupColumns()

    if (body.action === "placeTeam") {
      // Přesun do slotu jednotky; obsazený slot se vymění (lib/unit-slots.ts).
      const rows = await sql`SELECT team_id, unit_id, triplet FROM team_units WHERE run_id = ${runId} ORDER BY team_id`
      const placements: TeamPlacement[] = rows.map(r => ({
        teamId: r.team_id as string, unitId: r.unit_id as string | null, triplet: (r.triplet as Triplet | null) ?? null,
      }))
      if (!placements.some(p => p.teamId === body.teamId)) return new Response("Tým nemá v běhu záznam", { status: 404 })
      const slots = computeUnitSlots(UNITS.map(u => u.id), placements)
      const writes = planTeamMove(slots, body.teamId, { unitId: body.unitId, triplet: body.triplet })
      if (writes.length > 0) {
        await sql.transaction(writes.map(w =>
          sql`UPDATE team_units SET unit_id = ${w.unitId}, triplet = ${w.triplet} WHERE team_id = ${w.teamId} AND run_id = ${runId}`
        ))
      }
    } else if (body.action === "setOrigin") {
      await sql`UPDATE character_state SET origin = ${body.origin} WHERE character_id = ${body.characterId} AND run_id = ${runId}`
    } else if (body.action === "setCharacterCircle") {
      // Postava je vždy právě v jednom kruhu: smazat všechna členství, vložit jedno.
      await sql.transaction([
        sql`DELETE FROM circle_members WHERE character_id = ${body.characterId} AND run_id = ${runId}`,
        sql`INSERT INTO circle_members (circle_id, character_id, run_id) VALUES (${body.circleId}, ${body.characterId}, ${runId})`,
      ])
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
