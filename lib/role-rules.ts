import { allowedValues, type RuleOption } from "./assignment-rules.ts"
import type { Triplet } from "./types.ts"

// Pevná role postavy v jednotce (pravidlo „role“ v Příprava → Pravidla).
// Role patří jednotce a trojici, takže pevná role určuje i to, kam tým patří:
// tým s postavou s pevnou rolí smí být jen v jednotce a trojici té role.
// Čisté funkce, sdílí je server i Příprava.

export type RuleRole = { id: number; unitId: string; triplet: Triplet; nameM: string; nameF: string }
export type Slot = { unitId: string; triplet: Triplet }

export const roleLabel = (r: RuleRole) => (r.nameM === r.nameF ? r.nameM : `${r.nameM} / ${r.nameF}`)

/** Možnosti pro pravidlo role: id role → „Orion (Hvězdy · A)“. */
export function roleRuleOptions(roles: readonly RuleRole[], unitName: (id: string) => string): RuleOption[] {
  return roles.map(r => ({ value: String(r.id), label: `${roleLabel(r)} (${unitName(r.unitId)} · ${r.triplet})` }))
}

/** Pevná role postavy, nebo null. Pravidlo na smazanou roli se nepočítá. */
export function fixedRole(index: Map<string, string[]>, roles: readonly RuleRole[], characterId: string): RuleRole | null {
  const allowed = allowedValues(index, "character", characterId, "role")
  if (allowed?.length !== 1) return null
  return roles.find(r => String(r.id) === allowed[0]) ?? null
}

/**
 * Kam tým patří podle pevných rolí svých členů. slot = null: žádný člen nemá
 * pevnou roli. conflict: pevné role členů míří do různých jednotek či trojic.
 */
export function requiredSlot(
  index: Map<string, string[]>, roles: readonly RuleRole[], memberIds: readonly string[],
): { slot: Slot | null; conflict: boolean } {
  let slot: Slot | null = null
  for (const id of memberIds) {
    const r = fixedRole(index, roles, id)
    if (!r) continue
    if (slot && (slot.unitId !== r.unitId || slot.triplet !== r.triplet)) return { slot, conflict: true }
    slot = { unitId: r.unitId, triplet: r.triplet }
  }
  return { slot, conflict: false }
}

/** true, když tým nesmí do daného slotu kvůli pevné roli některého člena. */
export function slotBlockedByRoles(
  index: Map<string, string[]>, roles: readonly RuleRole[], memberIds: readonly string[], target: Slot,
): boolean {
  return memberIds.some(id => {
    const r = fixedRole(index, roles, id)
    return r !== null && (r.unitId !== target.unitId || r.triplet !== target.triplet)
  })
}

/**
 * Proč nejde postavě dát pevnou roli, nebo null. Role smí mít napevno jen jedna
 * postava, role spoluhráčů musí být ve stejné trojici a jednotka role musí
 * projít pravidlem jednotky týmu.
 */
export function fixedRoleConflict(input: {
  index: Map<string, string[]>
  roles: readonly RuleRole[]
  characterId: string
  roleId: string
  teamId: string | undefined
  teammateIds: readonly string[]
  allCharacterIds: readonly string[]
  name: (characterId: string) => string
  unitName: (unitId: string) => string
}): string | null {
  const role = input.roles.find(r => String(r.id) === input.roleId)
  if (!role) return "Role neexistuje"
  const holder = input.allCharacterIds.find(id => id !== input.characterId && fixedRole(input.index, input.roles, id)?.id === role.id)
  if (holder) return `${roleLabel(role)} už má napevno ${input.name(holder)}`
  for (const id of input.teammateIds) {
    if (id === input.characterId) continue
    const r = fixedRole(input.index, input.roles, id)
    if (r && (r.unitId !== role.unitId || r.triplet !== role.triplet)) {
      return `${input.name(id)} ze stejného týmu má napevno ${roleLabel(r)} (${input.unitName(r.unitId)} · ${r.triplet}), tým nemůže být ve dvou trojicích`
    }
  }
  if (input.teamId) {
    const units = allowedValues(input.index, "team", input.teamId, "unit")
    if (units && !units.includes(role.unitId)) return `Pravidlo jednotky týmu nedovoluje ${input.unitName(role.unitId)}`
  }
  return null
}
