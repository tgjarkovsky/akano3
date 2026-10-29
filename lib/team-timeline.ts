import type { PointEntry } from "./types.ts"
import { teamDeltaOf } from "./point-resolution.ts"

export type TimelineRow = { time: string } & Record<string, number | string>

// Bucket key must match formatDateTime in ./utils (not imported: utils doesn't load under node tests).
const bucketKey = (d: Date) =>
  d.toLocaleString("cs-CZ", { day:"2-digit", month:"2-digit", hour:"2-digit", minute:"2-digit" })

export const formatTimeOnly = (val: string) => val?.slice(-5) ?? val

export function teamTimeline(teams: { id: string; points: number }[], pointLog: PointEntry[]): TimelineRow[] {
  const sortedLog = [...pointLog].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime())
  const buckets: Record<string, TimelineRow> = {}
  const runningTotals: Record<string, number> = {}
  const deltas = sortedLog.map(teamDeltaOf)
  teams.forEach(t => {
    const loggedSum = deltas.reduce((s, d) => s + (d[t.id] ?? 0), 0)
    runningTotals[t.id] = t.points - loggedSum
  })
  sortedLog.forEach((e, i) => {
    const d = deltas[i]
    for (const tid in d) runningTotals[tid] = (runningTotals[tid] ?? 0) + d[tid]
    const key = bucketKey(e.timestamp)
    if (!buckets[key]) buckets[key] = { time: key }
    teams.forEach(t => { buckets[key][t.id] = runningTotals[t.id] ?? 0 })
  })
  return Object.values(buckets)
}
