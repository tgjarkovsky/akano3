// Stav textového pole: prázdné → rozepsané (automaticky) → hotovo (autor) → schváleno (kontrola).
// V databázi je jen „done“ / „approved“ / null; prázdné a rozepsané se počítají z textu.

export type StoredStatus = "done" | "approved" | null
export type DocStatus = "empty" | "draft" | "done" | "approved"
export type StatusAction = "done" | "approve" | "reopen"

export const STATUS_LABELS: Record<DocStatus, string> = {
  empty: "prázdné",
  draft: "rozepsané",
  done: "hotovo",
  approved: "schváleno",
}

const RANK: Record<DocStatus, number> = { empty: 0, draft: 1, done: 2, approved: 3 }

export function statusOf(rec: { length: number; status: StoredStatus } | undefined | null): DocStatus {
  if (!rec || rec.length === 0) return "empty"
  return rec.status ?? "draft"
}

/** Nejhorší stav ze seznamu (pro tečku u entity ve stromu). Prázdný seznam = prázdné. */
export function worstStatus(list: readonly DocStatus[]): DocStatus {
  if (list.length === 0) return "empty"
  return list.reduce((a, b) => RANK[b] < RANK[a] ? b : a)
}

/**
 * Co se stane se stavem po úpravě textu. Hotový nebo schválený text se úpravou
 * vrací do rozepsaného, ať se k hráčům nedostane bez kontroly. „Drobná oprava“
 * (keepStatus) stav nechá. Příznak „změněno po schválení“ zůstává, dokud se text
 * znovu neschválí.
 */
export function statusAfterEdit(
  prev: { status: StoredStatus; changedAfterApproval: boolean },
  bodyChanged: boolean,
  keepStatus: boolean,
): { status: StoredStatus; changedAfterApproval: boolean } {
  if (!bodyChanged || keepStatus || prev.status === null) return prev
  return { status: null, changedAfterApproval: prev.changedAfterApproval || prev.status === "approved" }
}

/** Vrací text chyby, nebo null když je přechod dovolený. */
export function checkTransition(current: DocStatus, action: StatusAction): string | null {
  if (action === "done") {
    if (current === "empty") return "Prázdný text nejde označit jako hotový."
    if (current !== "draft") return "Text už je hotový."
    return null
  }
  if (action === "approve") {
    if (current === "approved") return "Text už je schválený."
    if (current !== "done") return "Schválit jde jen text označený jako hotový."
    return null
  }
  if (current !== "done" && current !== "approved") return "Text není hotový ani schválený."
  return null
}

export function statusAfterAction(action: StatusAction): { status: StoredStatus; clearsChangedFlag: boolean } {
  if (action === "done") return { status: "done", clearsChangedFlag: false }
  if (action === "approve") return { status: "approved", clearsChangedFlag: true }
  return { status: null, clearsChangedFlag: false }
}

export type StatusCounts = Record<DocStatus, number> & { total: number }

export function countStatuses(list: readonly DocStatus[]): StatusCounts {
  const c: StatusCounts = { empty: 0, draft: 0, done: 0, approved: 0, total: list.length }
  for (const s of list) c[s]++
  return c
}
