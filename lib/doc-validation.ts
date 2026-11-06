import { isDocField, isDocEntityType, type DocEntityType } from "./doc-fields.ts"
import type { StatusAction } from "./doc-status.ts"
import { isTriplet } from "./setup-options.ts"
import type { Triplet } from "./types.ts"

// Validace vstupů API textů a rolí v Přípravě. Role se ověřují jen tvarem
// (číselné id); jestli existují, rozhoduje databáze.

export const MAX_TEXT_LENGTH = 100_000

export type DocIds = {
  characterIds: readonly string[]
  teamIds: readonly string[]
  unitIds: readonly string[]
  circleIds: readonly string[]
  traitIds: readonly string[]
}

type Ok<T> = { ok: true; value: T }
type Err = { ok: false; error: string }

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null

export function isKnownEntity(type: DocEntityType, id: unknown, ids: DocIds): boolean {
  if (typeof id !== "string") return false
  switch (type) {
    case "character": return ids.characterIds.includes(id)
    case "team":      return ids.teamIds.includes(id)
    case "unit":      return ids.unitIds.includes(id)
    case "circle":    return ids.circleIds.includes(id)
    case "trait":     return ids.traitIds.includes(id)
    case "role":      return /^[1-9]\d{0,8}$/.test(id)
  }
}

export type TextSave = {
  entityType: DocEntityType; entityId: string; field: string
  body: string; expectedVersion: number | null; keepStatus: boolean; by: string | null
}

export function parseTextSave(raw: unknown, ids: DocIds): Ok<TextSave> | Err {
  if (!isObj(raw)) return { ok: false, error: "Neplatné tělo požadavku" }
  if (!isDocEntityType(raw.entityType)) return { ok: false, error: "Neznámý typ" }
  if (!isKnownEntity(raw.entityType, raw.entityId, ids)) return { ok: false, error: "Neznámá entita" }
  if (!isDocField(raw.entityType, raw.field)) return { ok: false, error: "Neznámé pole" }
  if (typeof raw.body !== "string") return { ok: false, error: "Text chybí" }
  if (raw.body.length > MAX_TEXT_LENGTH) return { ok: false, error: "Text je příliš dlouhý" }
  const v = raw.expectedVersion
  if (v !== null && !(typeof v === "number" && Number.isInteger(v) && v >= 1)) return { ok: false, error: "Neplatná verze" }
  return {
    ok: true,
    value: {
      entityType: raw.entityType, entityId: raw.entityId as string, field: raw.field as string,
      body: raw.body, expectedVersion: v as number | null,
      keepStatus: raw.keepStatus === true,
      by: typeof raw.by === "string" ? raw.by.slice(0, 80) : null,
    },
  }
}

export type StatusChange = {
  entityType: DocEntityType; entityId: string; field: string
  action: StatusAction; expectedVersion: number; by: string | null
}

export function parseStatusChange(raw: unknown, ids: DocIds): Ok<StatusChange> | Err {
  if (!isObj(raw)) return { ok: false, error: "Neplatné tělo požadavku" }
  if (!isDocEntityType(raw.entityType)) return { ok: false, error: "Neznámý typ" }
  if (!isKnownEntity(raw.entityType, raw.entityId, ids)) return { ok: false, error: "Neznámá entita" }
  if (!isDocField(raw.entityType, raw.field)) return { ok: false, error: "Neznámé pole" }
  if (raw.action !== "done" && raw.action !== "approve" && raw.action !== "reopen") return { ok: false, error: "Neznámá akce" }
  const v = raw.expectedVersion
  if (!(typeof v === "number" && Number.isInteger(v) && v >= 1)) return { ok: false, error: "Neplatná verze" }
  return {
    ok: true,
    value: {
      entityType: raw.entityType, entityId: raw.entityId as string, field: raw.field as string,
      action: raw.action, expectedVersion: v, by: typeof raw.by === "string" ? raw.by.slice(0, 80) : null,
    },
  }
}

export type RoleInput = { unitId: string; triplet: Triplet; key: string; nameM: string; nameF: string }

export const ROLE_KEY = /^[a-z][a-z0-9_]{0,29}$/

/** Klíč role z názvu: bez diakritiky, malá písmena, podtržítka. */
export function roleKeyFrom(name: string): string {
  const k = name.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()
    .replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").replace(/^[0-9_]+/, "").slice(0, 30)
  return k || "role"
}

export function parseRoleInput(raw: unknown, unitIds: readonly string[]): Ok<RoleInput> | Err {
  if (!isObj(raw)) return { ok: false, error: "Neplatné tělo požadavku" }
  if (typeof raw.unitId !== "string" || !unitIds.includes(raw.unitId)) return { ok: false, error: "Neznámá jednotka" }
  if (!isTriplet(raw.triplet)) return { ok: false, error: "Trojice musí být A nebo B" }
  const nameM = typeof raw.nameM === "string" ? raw.nameM.trim() : ""
  const nameF = typeof raw.nameF === "string" ? raw.nameF.trim() : ""
  if (!nameM || !nameF) return { ok: false, error: "Role potřebuje název v mužském i ženském tvaru" }
  if (nameM.length > 60 || nameF.length > 60) return { ok: false, error: "Název role je příliš dlouhý" }
  if (typeof raw.key !== "string" || !ROLE_KEY.test(raw.key)) {
    return { ok: false, error: "Klíč role: malá písmena bez diakritiky, číslice a _, začíná písmenem" }
  }
  return { ok: true, value: { unitId: raw.unitId, triplet: raw.triplet, key: raw.key, nameM, nameF } }
}
