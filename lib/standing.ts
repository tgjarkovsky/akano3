export type Standing = { rank: number; total: number }

export function standingOf(id: string, rows: { id: string; points: number }[]): Standing | null {
  const row = rows.find(r => r.id === id)
  if (!row) return null
  return { rank: rows.filter(r => r.points > row.points).length + 1, total: rows.length }
}
