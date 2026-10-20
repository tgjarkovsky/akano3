export const DEFAULT_DURATION_MIN = 30

export type ConfigIds = {
  teamIds: readonly string[]
  unitIds: readonly string[]
  circleIds: readonly string[]
  characterIds: readonly string[]
}

type Obj = Record<string, unknown>

const isObj = (v: unknown): v is Obj => typeof v === "object" && v !== null

export function parseDurationMin(v: unknown): number | null {
  if (v === undefined) return DEFAULT_DURATION_MIN
  return typeof v === "number" && Number.isFinite(v) && v > 0 ? v : null
}

export function validateLessonBody(body: unknown, characterIds: readonly string[]): string | null {
  if (!isObj(body)) return "Body must be an object"
  if (body.action === "toggle") {
    if (typeof body.active !== "boolean") return "Invalid active"
    if (body.active && parseDurationMin(body.durationMin) === null) return "Invalid durationMin"
    return null
  }
  if (body.action === "claim") {
    if (typeof body.characterId !== "string" || !characterIds.includes(body.characterId)) return "Invalid characterId"
    return null
  }
  return "Unknown action"
}

export function validateConfigBody(body: unknown, ids: ConfigIds): string | null {
  if (!isObj(body)) return "Body must be an object"
  const has = (list: readonly string[], v: unknown) => typeof v === "string" && list.includes(v)

  if (body.action === "setTeamUnit") {
    if (!has(ids.teamIds, body.teamId)) return "Invalid teamId"
    if (!has(ids.unitIds, body.unitId)) return "Invalid unitId"
    return null
  }
  if (body.action === "setCircleMembers") {
    if (!has(ids.circleIds, body.circleId)) return "Invalid circleId"
    if (!Array.isArray(body.memberIds) || !body.memberIds.every(m => has(ids.characterIds, m))) return "Invalid memberIds"
    return null
  }
  if (body.action === "setSpecialization") {
    if (!has(ids.characterIds, body.characterId)) return "Invalid characterId"
    if (body.specialization !== null && typeof body.specialization !== "string") return "Invalid specialization"
    return null
  }
  if (body.action === "refillPeerPool") return null
  return "Unknown action"
}
