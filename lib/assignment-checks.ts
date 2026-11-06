import type { UnitSlots } from "./unit-slots.ts"

// Kontroly obsazení běhu v Přípravě. Chyby blokují zveřejnění dokumentů
// (až bude), varování jen upozorňují.

export type CheckTarget =
  | { type: "unit"; id: string }
  | { type: "team"; id: string }
  | { type: "character"; id: string }

export type AssignmentIssue = {
  level: "error" | "warning"
  message: string
  target: CheckTarget
}

type CheckCharacter = {
  id: string
  name: string
  specialization?: string
  origin?: string
  circleIds: string[]
}

export function checkAssignment(input: {
  slots: readonly UnitSlots[]
  unitName: (id: string) => string
  teamName: (id: string) => string
  /** týmy, které nejsou v žádném slotu ani v přetečení (bez platné jednotky) */
  unplacedTeamIds: readonly string[]
  players: readonly CheckCharacter[]
}): AssignmentIssue[] {
  const issues: AssignmentIssue[] = []

  for (const s of input.slots) {
    const unit = input.unitName(s.unitId)
    for (const t of ["A", "B"] as const) {
      if (s[t] === null) issues.push({ level: "error", message: `${unit}: trojice ${t} nemá tým`, target: { type: "unit", id: s.unitId } })
    }
    if (s.overflow.length > 0) {
      issues.push({
        level: "error",
        message: `${unit}: navíc ${s.overflow.map(input.teamName).join(", ")}`,
        target: { type: "unit", id: s.unitId },
      })
    }
  }
  for (const teamId of input.unplacedTeamIds) {
    issues.push({ level: "error", message: `${input.teamName(teamId)} není v žádné jednotce`, target: { type: "team", id: teamId } })
  }

  for (const c of input.players) {
    const missing: string[] = []
    if (!c.specialization) missing.push("specializace")
    if (!c.origin) missing.push("původ")
    if (missing.length > 0) {
      issues.push({ level: "error", message: `${c.name}: chybí ${missing.join(" a ")}`, target: { type: "character", id: c.id } })
    }
    // Postava je vždy právě v jednom kruhu.
    if (c.circleIds.length === 0) {
      issues.push({ level: "error", message: `${c.name}: není v žádném kruhu`, target: { type: "character", id: c.id } })
    } else if (c.circleIds.length > 1) {
      issues.push({ level: "error", message: `${c.name}: je ve ${c.circleIds.length} kruzích, smí být jen v jednom`, target: { type: "character", id: c.id } })
    }
  }

  return issues
}

/** Postavy, které mají aspoň jeden problém. Pro filtr „Chybí něco“ v tabulce. */
export function charactersWithIssues(issues: readonly AssignmentIssue[]): Set<string> {
  return new Set(issues.filter(i => i.target.type === "character").map(i => i.target.id))
}
