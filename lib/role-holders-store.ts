import { sql } from "@/lib/db"
import { TEAMS, UNITS } from "@/lib/data"
import { ensureSetupColumns } from "@/lib/setup-schema"
import { getRoles } from "@/lib/docs-store"
import { computeUnitSlots, slotOfTeam } from "@/lib/unit-slots"
import { effectiveRoles, planRoleAssign, type HolderInput } from "@/lib/role-holders"
import type { Triplet } from "@/lib/types"

// Rozdělení rolí jednotek v běhu (tabulka role_holders), viz lib/role-holders.ts.

export const teamOfCharacter = (characterId: string) => TEAMS.find(t => t.memberIds.includes(characterId))?.id

/** Vstup pro výpočet rolí běhu: role, pevné role, uložené rozdělení, sloty týmů. */
export async function loadHolderInput(runId: number): Promise<HolderInput> {
  await ensureSetupColumns()
  const [roles, fixedRows, stored, units] = await Promise.all([
    getRoles(),
    sql`SELECT subject_id, allowed FROM assignment_rules WHERE subject_type = 'character' AND property = 'role'`,
    sql`SELECT role_id, character_id FROM role_holders WHERE run_id = ${runId} ORDER BY updated_at, role_id`,
    sql`SELECT team_id, unit_id, triplet FROM team_units WHERE run_id = ${runId}`,
  ])
  const order = TEAMS.map(t => t.id)
  const placements = units
    .map(r => ({ teamId: r.team_id as string, unitId: r.unit_id as string | null, triplet: r.triplet === "A" || r.triplet === "B" ? r.triplet as Triplet : null }))
    .sort((a, b) => order.indexOf(a.teamId) - order.indexOf(b.teamId))
  const slots = computeUnitSlots(UNITS.map(u => u.id), placements)
  return {
    roles: roles.map(r => ({ id: String(r.id), unitId: r.unitId, triplet: r.triplet })),
    fixedRoleOf: new Map(fixedRows.filter(r => (r.allowed as string[]).length === 1).map(r => [r.subject_id as string, (r.allowed as string[])[0]])),
    stored: stored.map(r => ({ roleId: String(r.role_id), characterId: r.character_id as string })),
    teamOf: teamOfCharacter,
    slotOf: teamId => slotOfTeam(slots, teamId),
  }
}

/** Kdo v běhu drží kterou roli (pevné i rozdělené). */
export async function getRoleHolders(runId: number): Promise<{ characterId: string; roleId: string; fixed: boolean }[]> {
  const input = await loadHolderInput(runId)
  return [...effectiveRoles(input)].map(([characterId, roleId]) => ({ characterId, roleId, fixed: input.fixedRoleOf.has(characterId) }))
}

/** Dá postavě roli v běhu (null = bez role); spoluhráč s tou rolí dostane její dosavadní. */
export async function assignRole(runId: number, characterId: string, roleId: string | null, by: string | null): Promise<string | null> {
  const input = await loadHolderInput(runId)
  const teamId = teamOfCharacter(characterId)
  const members = TEAMS.find(t => t.id === teamId)?.memberIds ?? []
  const plan = planRoleAssign({ ...input, members, characterId, roleId })
  if ("error" in plan) return plan.error
  await sql.transaction([
    sql`DELETE FROM role_holders WHERE run_id = ${runId} AND character_id = ANY(${plan.holders.map(h => h.characterId)}::text[])`,
    ...plan.holders.filter(h => h.roleId !== null).map(h => sql`
      INSERT INTO role_holders (run_id, role_id, character_id, updated_by)
      VALUES (${runId}, ${Number(h.roleId)}, ${h.characterId}, ${by})
      ON CONFLICT (run_id, role_id) DO UPDATE SET character_id = EXCLUDED.character_id, updated_by = EXCLUDED.updated_by, updated_at = NOW()
    `),
  ])
  return null
}
