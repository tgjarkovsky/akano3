import { CHARACTERS, TEAMS, UNITS, CIRCLES } from "@/lib/data"
import { SPECIALIZATION_OPTIONS, ORIGIN_OPTIONS } from "@/lib/setup-options"
import type { DocIds } from "@/lib/doc-validation"

// Entity, ke kterým se píšou texty. Specializace a původy mají id „druh:hodnota“.

export const TRAIT_ENTITIES = [
  ...SPECIALIZATION_OPTIONS.map(o => ({ id: `specialization:${o.value}`, name: o.label, group: "Specializace" })),
  ...ORIGIN_OPTIONS.map(o => ({ id: `origin:${o.value}`, name: o.label, group: "Původ" })),
]

export const DOC_PLAYERS = CHARACTERS.filter(c => c.role === "student" || c.role === "ruze")

/** Dospělé postavy (učitelé) mají jen texty pro přihlášku. */
export const DOC_ADULTS = CHARACTERS.filter(c => c.role === "teacher")

export const DOC_IDS: DocIds = {
  characterIds: DOC_PLAYERS.map(c => c.id),
  teamIds: TEAMS.map(t => t.id),
  unitIds: UNITS.map(u => u.id),
  circleIds: CIRCLES.map(c => c.id),
  traitIds: TRAIT_ENTITIES.map(t => t.id),
  adultIds: DOC_ADULTS.map(c => c.id),
}
