import type { PointEntry } from "./types.ts"
import { resolvedCharsOf, isReversal, isReversed } from "./point-resolution.ts"

export type HistoryItem = {
  entry: PointEntry
  amount: number
  runningTotal: number
  reversed: boolean
  isReversal: boolean
}

// Entries that credited the character, newest first, with the running total
// accumulated up to and including each entry. The log may be truncated, so the total is anchored at currentPoints and computed backwards.
export function characterHistory(log: PointEntry[], characterId: string, currentPoints: number): HistoryItem[] {
  const mine = log
    .filter(e => resolvedCharsOf(e).includes(characterId))
    .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
  let total = currentPoints
  return mine
    .map(entry => {
      const runningTotal = total
      total -= entry.amount
      return {
        entry,
        amount: entry.amount,
        runningTotal,
        reversed: isReversed(entry, log),
        isReversal: isReversal(entry),
      }
    })
}
