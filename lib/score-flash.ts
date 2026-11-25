export type ScoreDelta = { id: string; delta: number }

export function diffScores(prev: Record<string, number>, next: { id: string; points: number }[]): ScoreDelta[] {
  if (Object.keys(prev).length === 0) return []
  return next.flatMap(({ id, points }) => {
    if (!(id in prev)) return []
    const delta = points - prev[id]
    return delta === 0 ? [] : [{ id, delta }]
  })
}
