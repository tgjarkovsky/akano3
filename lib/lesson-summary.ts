import type { Character } from "./types"

export type LessonClaimSummary = {
  claimed: Character[]
  pending: Character[]
  total: number
}

const byTeamThenName = (a: Character, b: Character) =>
  (a.teamId ?? "").localeCompare(b.teamId ?? "", "cs") || a.name.localeCompare(b.name, "cs")

export function summarizeLessonClaims(characters: Character[]): LessonClaimSummary {
  const players = characters.filter(c => c.role === "student" || c.role === "ruze")
  return {
    claimed: players.filter(c => c.lessonClaimedThisWindow).sort(byTeamThenName),
    pending: players.filter(c => !c.lessonClaimedThisWindow).sort(byTeamThenName),
    total: players.length,
  }
}
