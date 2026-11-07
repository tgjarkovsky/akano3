import { CIRCLES, UNITS } from "@/lib/data"
import { SPECIALIZATION_OPTIONS, ORIGIN_OPTIONS } from "@/lib/setup-options"
import type { RuleOption, RuleProperty } from "@/lib/assignment-rules"

// Možnosti pro pravidla obsazení, sdílené serverem i Přípravou.

const OPTIONS: Record<RuleProperty, RuleOption[]> = {
  specialization: SPECIALIZATION_OPTIONS,
  origin: ORIGIN_OPTIONS,
  circle: CIRCLES.map(c => ({ value: c.id, label: c.name })),
  // Role jsou v databázi (unit_roles); možnosti dodá volající, viz roleRuleOptions.
  role: [],
  unit: UNITS.map(u => ({ value: u.id, label: u.name })),
}

export const ruleOptionsFor = (p: RuleProperty): RuleOption[] => OPTIONS[p]

export const PROPERTY_LABELS: Record<RuleProperty, string> = {
  specialization: "Specializace",
  origin: "Původ",
  circle: "Kruh",
  role: "Role",
  unit: "Jednotka",
}
