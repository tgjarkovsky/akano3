import type { PointEntry } from "./types.ts"

type ShiftEntry = Pick<PointEntry, "timestamp" | "amount" | "resolvedTeamIds" | "resolvedCharacterIds">

const ranksOf = (rows: { id: string; points: number }[]): Record<string, number> => {
  const out: Record<string, number> = {}
  ;[...rows].sort((a, b) => b.points - a.points).forEach((r, i) => { out[r.id] = i + 1 })
  return out
}

// Rank change since `since` (positive = moved up). `teamOf` maps character -> team,
// passed in so this module doesn't depend on data.ts.
export function rankShifts(
  current: { id: string; points: number }[],
  pointLog: ShiftEntry[],
  mode: "students" | "teams",
  since: Date,
  teamOf: (characterId: string) => string | undefined = () => undefined,
): Record<string, number> {
  const recent: Record<string, number> = {}
  const add = (id: string | undefined, n: number) => { if (id) recent[id] = (recent[id] ?? 0) + n }
  for (const e of pointLog) {
    if (e.timestamp <= since) continue
    if (mode === "students") e.resolvedCharacterIds?.forEach(cid => add(cid, e.amount))
    else if (e.resolvedCharacterIds?.length) e.resolvedCharacterIds.forEach(cid => add(teamOf(cid), e.amount))
    else e.resolvedTeamIds.forEach(tid => add(tid, e.amount))
  }
  const now = ranksOf(current)
  const before = ranksOf(current.map(r => ({ id: r.id, points: r.points - (recent[r.id] ?? 0) })))
  return Object.fromEntries(current.map(r => [r.id, before[r.id] - now[r.id]]))
}

export function formatShift(shift: number): string {
  return shift > 0 ? `▲${shift}` : shift < 0 ? `▼${-shift}` : "–"
}
