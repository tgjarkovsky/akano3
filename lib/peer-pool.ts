export type PoolRefillMode = "add" | "set"
export type PoolRefill = { amount: number; mode: PoolRefillMode }

export const MAX_POOL_REFILL = 100

export function parsePoolRefill(body: unknown): PoolRefill | string {
  const b = (typeof body === "object" && body !== null ? body : {}) as Record<string, unknown>
  const { amount, mode } = b
  if (typeof amount !== "number" || !Number.isInteger(amount) || amount < 1 || amount > MAX_POOL_REFILL) return "Invalid amount"
  if (mode !== "add" && mode !== "set") return "Invalid mode"
  return { amount, mode }
}

export function nextPeerPool(current: number, amount: number, mode: PoolRefillMode): number {
  return mode === "add" ? current + amount : amount
}
