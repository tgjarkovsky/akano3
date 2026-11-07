import type { UnitSlots } from "./unit-slots.ts"
import { allowedValues, describeRule, type RuleOption, type RuleProperty } from "./assignment-rules.ts"
import { fixedRole, requiredSlot, roleLabel, type RuleRole } from "./role-rules.ts"

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
  teamId?: string
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
  /** pravidla obsazení (lib/assignment-rules.ts); bez nich se porušení nekontroluje */
  rules?: Map<string, string[]>
  optionsFor?: (p: RuleProperty) => readonly RuleOption[]
  /** role jednotek; s nimi se kontrolují pevné role (tým ve správné jednotce a trojici) */
  roles?: readonly RuleRole[]
}): AssignmentIssue[] {
  const issues: AssignmentIssue[] = []
  const rules = input.rules
  const optionsFor = input.optionsFor
  const violation = (subjectType: "character" | "team", id: string, property: RuleProperty, value: string | undefined) => {
    if (!rules || !optionsFor || value === undefined) return null
    const allowed = allowedValues(rules, subjectType, id, property)
    if (allowed === null || allowed.includes(value)) return null
    const options = optionsFor(property)
    const label = options.find(o => o.value === value)?.label ?? value
    const rule = describeRule(allowed, options).text
    return `${label} porušuje pravidlo (${rule.charAt(0).toLowerCase()}${rule.slice(1)})`
  }

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
  for (const s of input.slots) {
    for (const teamId of [s.A, s.B, ...s.overflow]) {
      if (!teamId) continue
      const v = violation("team", teamId, "unit", s.unitId)
      if (v) issues.push({ level: "error", message: `${input.teamName(teamId)}: jednotka ${v}`, target: { type: "team", id: teamId } })
    }
  }
  // Pevná role člena určuje jednotku a trojici týmu.
  if (rules && input.roles) {
    const roles = input.roles
    const placeOf = (teamId: string) => {
      for (const s of input.slots) {
        if (s.A === teamId) return { unitId: s.unitId, triplet: "A" as const }
        if (s.B === teamId) return { unitId: s.unitId, triplet: "B" as const }
        if (s.overflow.includes(teamId)) return { unitId: s.unitId, triplet: null }
      }
      return null
    }
    const teamIds = [...new Set(input.players.map(c => c.teamId).filter((t): t is string => !!t))]
    for (const teamId of teamIds) {
      const members = input.players.filter(c => c.teamId === teamId)
      const { slot, conflict } = requiredSlot(rules, roles, members.map(c => c.id))
      if (!slot) continue
      const fixed = members.flatMap(c => { const r = fixedRole(rules, roles, c.id); return r ? [`${c.name} (${roleLabel(r)})`] : [] })
      if (conflict) {
        issues.push({ level: "error", message: `${input.teamName(teamId)}: pevné role ${fixed.join(", ")} jsou v různých trojicích`, target: { type: "team", id: teamId } })
        continue
      }
      const at = placeOf(teamId)
      if (!at || at.unitId !== slot.unitId || at.triplet !== slot.triplet) {
        issues.push({
          level: "error",
          message: `${input.teamName(teamId)} patří do ${input.unitName(slot.unitId)} · trojice ${slot.triplet} (pevná role ${fixed.join(", ")})`,
          target: { type: "team", id: teamId },
        })
      }
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
    const broken = [
      violation("character", c.id, "specialization", c.specialization),
      violation("character", c.id, "origin", c.origin),
      ...c.circleIds.map(id => violation("character", c.id, "circle", id)),
    ].filter(Boolean)
    for (const v of broken) issues.push({ level: "error", message: `${c.name}: ${v}`, target: { type: "character", id: c.id } })
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
