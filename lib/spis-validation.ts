// Vstupy API spisů v Přípravě.

export type SpisAction =
  | { action: "create-links"; runId: number; by: string | null }
  | { action: "regenerate"; runId: number; characterId: string; by: string | null }
  | { action: "publish" | "unpublish"; runId: number; by: string | null }

type Ok<T> = { ok: true; value: T }
type Err = { ok: false; error: string }

/** Číslo běhu z query nebo těla; jen kladné celé číslo. */
export function parseRunId(v: unknown): number | null {
  const n = typeof v === "string" && /^[1-9]\d{0,8}$/.test(v) ? Number(v) : v
  return typeof n === "number" && Number.isInteger(n) && n >= 1 && n < 1e9 ? n : null
}

export function parseSpisAction(raw: unknown, characterIds: readonly string[]): Ok<SpisAction> | Err {
  if (typeof raw !== "object" || raw === null) return { ok: false, error: "Neplatné tělo požadavku" }
  const r = raw as Record<string, unknown>
  const runId = parseRunId(r.runId)
  if (runId === null) return { ok: false, error: "Neplatný běh" }
  const by = typeof r.by === "string" ? r.by.slice(0, 80) : null
  switch (r.action) {
    case "create-links":
      return { ok: true, value: { action: "create-links", runId, by } }
    case "publish":
    case "unpublish":
      return { ok: true, value: { action: r.action, runId, by } }
    case "regenerate":
      if (typeof r.characterId !== "string" || !characterIds.includes(r.characterId)) return { ok: false, error: "Neznámá postava" }
      return { ok: true, value: { action: "regenerate", runId, characterId: r.characterId, by } }
    default:
      return { ok: false, error: "Neznámá akce" }
  }
}
