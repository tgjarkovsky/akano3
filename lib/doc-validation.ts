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

// ── Hromadný import textů (např. z Google dokumentu) ─────────────────────

export const MAX_IMPORT_ITEMS = 2000

export type ImportText = { entityType: DocEntityType; entityId: string; field: string; body: string }
export type ImportGender = { characterId: string; gender: "m" | "f" }
/** Role jednotky s osobním textem. Pozná se podle jednotky a klíče; chybějící se založí. */
export type ImportRole = RoleInput & { body: string }
export type ImportPayload = { texts: ImportText[]; genders: ImportGender[]; roles: ImportRole[] }

/**
 * Ověří soubor importu. Texty rolí se neimportují přes texts (id role vzniká
 * až v databázi), ale přes roles: jednotka, trojice, klíč, názvy a osobní text.
 * Duplicitní pole v jednom souboru jsou chyba.
 */
export function parseImport(raw: unknown, ids: DocIds): Ok<ImportPayload> | Err {
  if (!isObj(raw)) return { ok: false, error: "Soubor není objekt JSON" }
  if (!Array.isArray(raw.texts)) return { ok: false, error: "Chybí seznam texts" }
  const gendersRaw = raw.genders ?? []
  if (!Array.isArray(gendersRaw)) return { ok: false, error: "genders musí být seznam" }
  const rolesRaw = raw.roles ?? []
  if (!Array.isArray(rolesRaw)) return { ok: false, error: "roles musí být seznam" }
  if (raw.texts.length + gendersRaw.length + rolesRaw.length > MAX_IMPORT_ITEMS) return { ok: false, error: "Import je příliš velký" }

  const texts: ImportText[] = []
  const seen = new Set<string>()
  for (const [i, t] of raw.texts.entries()) {
    const where = `texts[${i}]`
    if (!isObj(t)) return { ok: false, error: `${where}: není objekt` }
    if (!isDocEntityType(t.entityType) || t.entityType === "role") return { ok: false, error: `${where}: nepodporovaný typ` }
    if (!isKnownEntity(t.entityType, t.entityId, ids)) return { ok: false, error: `${where}: neznámá entita ${String(t.entityId)}` }
    if (!isDocField(t.entityType, t.field)) return { ok: false, error: `${where}: neznámé pole ${String(t.field)}` }
    if (typeof t.body !== "string" || t.body.length > MAX_TEXT_LENGTH) return { ok: false, error: `${where}: neplatný text` }
    const key = `${t.entityType}:${t.entityId}:${t.field}`
    if (seen.has(key)) return { ok: false, error: `${where}: pole ${key} je v souboru dvakrát` }
    seen.add(key)
    texts.push({ entityType: t.entityType, entityId: t.entityId as string, field: t.field as string, body: t.body })
  }

  const genders: ImportGender[] = []
  for (const [i, g] of gendersRaw.entries()) {
    if (!isObj(g) || typeof g.characterId !== "string" || !ids.characterIds.includes(g.characterId)) {
      return { ok: false, error: `genders[${i}]: neznámá postava` }
    }
    if (g.gender !== "m" && g.gender !== "f") return { ok: false, error: `genders[${i}]: rod musí být m nebo f` }
    genders.push({ characterId: g.characterId, gender: g.gender })
  }
  const roles: ImportRole[] = []
  const seenRoles = new Set<string>()
  for (const [i, r] of rolesRaw.entries()) {
    const where = `roles[${i}]`
    const parsed = parseRoleInput(r, ids.unitIds)
    if (!parsed.ok) return { ok: false, error: `${where}: ${parsed.error}` }
    const body = (r as Record<string, unknown>).body
    if (typeof body !== "string" || body.length > MAX_TEXT_LENGTH) return { ok: false, error: `${where}: neplatný text` }
    const key = `${parsed.value.unitId}:${parsed.value.key}`
    if (seenRoles.has(key)) return { ok: false, error: `${where}: role ${key} je v souboru dvakrát` }
    seenRoles.add(key)
    roles.push({ ...parsed.value, body })
  }
  return { ok: true, value: { texts, genders, roles } }
}
