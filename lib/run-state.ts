import { CHARACTERS, TEAMS } from "./data"
import type { Character, Team } from "./types"

// Stav běhu z databáze (character_state, circle_members, team_units) nad statickými
// postavami a týmy. Používá ho stav hry (aktivní běh) i Obsazení (kterýkoli běh).

export type CharStateRow = { character_id: string; kaichi_level: number; peer_point_pool: number; lesson_claimed_this_window: boolean; specialization: string | null; origin?: string | null }
export type TeamUnitRow = { team_id: string; unit_id: string; triplet?: string | null }
export type CircleMemberRow = { circle_id: string; character_id: string }

// Merge static CHARACTERS with mutable DB state
export function buildCharacters(
  charState: CharStateRow[],
  characterPoints: { character_id: string; points: number }[],
  circleMembers: CircleMemberRow[],
  teamUnits: TeamUnitRow[]
): Character[] {
  const circlesByChar: Record<string, string[]> = {}
  for (const { circle_id, character_id } of circleMembers) {
    if (!circlesByChar[character_id]) circlesByChar[character_id] = []
    circlesByChar[character_id].push(circle_id)
  }
  const unitByTeam: Record<string, string> = {}
  for (const { team_id, unit_id } of teamUnits) unitByTeam[team_id] = unit_id
  const pointsByChar: Record<string, number> = {}
  for (const { character_id, points } of characterPoints) pointsByChar[character_id] = points

  return CHARACTERS.map(c => {
    const state = charState.find(s => s.character_id === c.id)
    return {
      ...c,
      kaichiLevel: state?.kaichi_level ?? c.kaichiLevel,
      peerPointPool: state?.peer_point_pool ?? c.peerPointPool,
      lessonClaimedThisWindow: state?.lesson_claimed_this_window ?? false,
      specialization: (state?.specialization as Character["specialization"]) ?? c.specialization,
      origin: (state?.origin as Character["origin"]) ?? undefined,
      points: pointsByChar[c.id] ?? c.points,
      circleIds: circlesByChar[c.id] ?? c.circleIds,
      unitId: c.teamId ? (unitByTeam[c.teamId] ?? c.unitId) : c.unitId,
    }
  })
}

// Team total = sum of its members' individual points.
function teamPointsFromChars(chars: Character[]): Record<string, number> {
  const m: Record<string, number> = {}
  for (const c of chars) if (c.teamId) m[c.teamId] = (m[c.teamId] ?? 0) + c.points
  return m
}

// Derive teams from character points + unit assignments.
export function buildTeams(
  chars: Character[],
  teamUnits: TeamUnitRow[]
): Team[] {
  const pointsMap = teamPointsFromChars(chars)
  const unitMap: Record<string, string> = {}
  const tripletMap: Record<string, Team["triplet"]> = {}
  for (const { team_id, unit_id, triplet } of teamUnits) {
    unitMap[team_id] = unit_id
    if (triplet === "A" || triplet === "B") tripletMap[team_id] = triplet
  }

  return TEAMS.map(t => ({
    ...t,
    points: pointsMap[t.id] ?? 0,
    unitId: unitMap[t.id] ?? t.unitId,
    triplet: tripletMap[t.id],
  }))
}

