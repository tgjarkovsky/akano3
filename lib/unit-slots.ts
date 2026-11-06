import type { Triplet } from "./types.ts"

// Rozložení týmů do trojic A/B v jednotkách pro jeden běh.
//
// V databázi má tým jednotku a volitelně trojici (team_units.triplet).
// Starší běhy trojici nemají vůbec, proto se doplňuje odvozením:
//   1. týmy s výslovnou trojicí dostanou svůj slot (první vyhrává, kolize jde dál),
//   2. týmy bez trojice (a kolizní) zaplní volné sloty jednotky v pořadí A, B,
//   3. co se nevejde, je „navíc“ — jednotka má víc než dva týmy, to je chyba obsazení.
// Pořadí uvnitř kroků drží pořadí vstupu, takže výsledek je stabilní.

export type TeamPlacement = { teamId: string; unitId: string | null; triplet: Triplet | null }

export type UnitSlots = {
  unitId: string
  A: string | null
  B: string | null
  /** týmy přiřazené do jednotky, pro které už nezbyl slot */
  overflow: string[]
}

export function computeUnitSlots(unitIds: readonly string[], placements: readonly TeamPlacement[]): UnitSlots[] {
  const byUnit = new Map<string, UnitSlots>(unitIds.map(id => [id, { unitId: id, A: null, B: null, overflow: [] }]))
  const pending: TeamPlacement[] = []

  for (const p of placements) {
    const slots = p.unitId ? byUnit.get(p.unitId) : undefined
    if (!slots) continue
    if (p.triplet && slots[p.triplet] === null) slots[p.triplet] = p.teamId
    else pending.push(p)
  }
  for (const p of pending) {
    const slots = byUnit.get(p.unitId!)!
    if (slots.A === null) slots.A = p.teamId
    else if (slots.B === null) slots.B = p.teamId
    else slots.overflow.push(p.teamId)
  }
  return unitIds.map(id => byUnit.get(id)!)
}

/** Kde tým podle rozložení sedí. null = není v žádném slotu (bez jednotky nebo navíc). */
export function slotOfTeam(slots: readonly UnitSlots[], teamId: string): { unitId: string; triplet: Triplet } | null {
  for (const s of slots) {
    if (s.A === teamId) return { unitId: s.unitId, triplet: "A" }
    if (s.B === teamId) return { unitId: s.unitId, triplet: "B" }
  }
  return null
}

/**
 * Přesun týmu do slotu. Když je slot obsazený, tým, který v něm byl, si
 * vymění místo s přesouvaným (dostane jeho dosavadní slot). Vrací seznam
 * zápisů, které je potřeba uložit; prázdný, když se nic nemění.
 */
export function planTeamMove(
  slots: readonly UnitSlots[],
  teamId: string,
  target: { unitId: string; triplet: Triplet },
): TeamPlacement[] {
  const from = slotOfTeam(slots, teamId)
  if (from && from.unitId === target.unitId && from.triplet === target.triplet) return []
  const targetSlots = slots.find(s => s.unitId === target.unitId)
  if (!targetSlots) return []
  const occupant = targetSlots[target.triplet]

  const writes: TeamPlacement[] = [{ teamId, ...target }]
  if (occupant && occupant !== teamId) {
    if (from) {
      writes.push({ teamId: occupant, unitId: from.unitId, triplet: from.triplet })
    } else {
      // Přesouvaný tým neměl slot (byl navíc nebo bez jednotky): vytlačený tým
      // zůstane v jednotce bez trojice a ukáže se jako navíc, ať ho GM umístí.
      writes.push({ teamId: occupant, unitId: target.unitId, triplet: null })
    }
  }
  return writes
}
