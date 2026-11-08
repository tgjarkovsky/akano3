import type { Triplet } from "./types.ts"

// Role v jednotce pro jeden běh. Tým, který v běhu obsadí trojici, si její
// role rozdělí (Obsazení → nástěnka jednotek, tabulka role_holders).
// Pevná role z Pravidel má přednost a nejde ji v běhu změnit.
// Čisté funkce, sdílí je server, Obsazení i spis.

export type HolderRole = { id: string; unitId: string; triplet: Triplet }
export type StoredHolder = { roleId: string; characterId: string }
export type Slot = { unitId: string; triplet: Triplet }

export type HolderInput = {
  roles: readonly HolderRole[]
  /** pevné role z Pravidel: id postavy → id role */
  fixedRoleOf: ReadonlyMap<string, string>
  /** uložené rozdělení běhu */
  stored: readonly StoredHolder[]
  teamOf: (characterId: string) => string | undefined
  slotOf: (teamId: string) => Slot | null | undefined
}

/**
 * Kdo v běhu drží kterou roli: id postavy → id role. Platí jen role ze slotu,
 * ve kterém tým postavy v běhu stojí. Nejdřív pevné role, pak uložené
 * rozdělení; roli i postavu může mít jen jedna položka.
 */
export function effectiveRoles(input: HolderInput): Map<string, string> {
  const roleById = new Map(input.roles.map(r => [r.id, r]))
  const out = new Map<string, string>()
  const taken = new Set<string>()
  const fits = (characterId: string, roleId: string) => {
    const role = roleById.get(roleId)
    const team = input.teamOf(characterId)
    const slot = team ? input.slotOf(team) : null
    return !!role && !!slot && slot.unitId === role.unitId && slot.triplet === role.triplet
  }
  const add = (characterId: string, roleId: string) => {
    if (out.has(characterId) || taken.has(roleId) || !fits(characterId, roleId)) return
    out.set(characterId, roleId)
    taken.add(roleId)
  }
  for (const [characterId, roleId] of input.fixedRoleOf) add(characterId, roleId)
  // Postava s pevnou rolí (i neplatnou v tomhle běhu) jinou roli nedostane.
  for (const h of input.stored) if (!input.fixedRoleOf.has(h.characterId)) add(h.characterId, h.roleId)
  return out
}

/**
 * Nové uložené rozdělení týmu po tom, co postava dostane roli (null = bez role).
 * Když roli drží spoluhráč, vymění si je. Vrací role všech členů bez pevné role
 * (null = bez role), nebo text chyby.
 */
export function planRoleAssign(input: HolderInput & {
  members: readonly string[]
  characterId: string
  roleId: string | null
}): { holders: { characterId: string; roleId: string | null }[] } | { error: string } {
  if (!input.members.includes(input.characterId)) return { error: "Postava není v týmu" }
  if (input.fixedRoleOf.has(input.characterId)) return { error: "Postava má roli napevno v Pravidlech" }
  const team = input.teamOf(input.characterId)
  const slot = team ? input.slotOf(team) : null
  if (!slot) return { error: "Tým nestojí v žádné trojici" }
  if (input.roleId !== null) {
    const role = input.roles.find(r => r.id === input.roleId)
    if (!role) return { error: "Role neexistuje" }
    if (role.unitId !== slot.unitId || role.triplet !== slot.triplet) return { error: "Role nepatří do trojice týmu" }
    if ([...input.fixedRoleOf.values()].includes(input.roleId)) return { error: "Roli má někdo napevno v Pravidlech" }
  }
  const current = effectiveRoles(input)
  const next = new Map(input.members.filter(id => !input.fixedRoleOf.has(id)).map(id => [id, current.get(id) ?? null]))
  const previous = next.get(input.characterId) ?? null
  if (input.roleId !== null) {
    for (const [id, r] of next) if (id !== input.characterId && r === input.roleId) next.set(id, previous)
  }
  next.set(input.characterId, input.roleId)
  return { holders: [...next].map(([characterId, roleId]) => ({ characterId, roleId })) }
}

/** Role trojice, které v běhu nikdo nedrží. */
export function unheldRoles(roles: readonly HolderRole[], held: ReadonlyMap<string, string>, slot: Slot): HolderRole[] {
  const taken = new Set(held.values())
  return roles.filter(r => r.unitId === slot.unitId && r.triplet === slot.triplet && !taken.has(r.id))
}
