// Které akce /api/config patří Přípravě (mění obsazení běhu) a smí je volat
// jen přihlášená Příprava. Ostatní akce volá Velín během hry bez hesla.
const SETUP_ACTIONS = new Set(["setTeamUnit", "setCircleMembers", "setSpecialization"])

export function configActionNeedsAdmin(action: unknown): boolean {
  return typeof action === "string" && SETUP_ACTIONS.has(action)
}
