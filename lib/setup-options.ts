import type { Specialization, Origin, Triplet } from "./types.ts"

// Možnosti pro obsazení běhu. Sdílí je server (validace) i Příprava (výběr).

export const SPECIALIZATION_OPTIONS: { value: Specialization; label: string }[] = [
  { value: "combat",   label: "Boj" },
  { value: "tactical", label: "Taktika" },
  { value: "support",  label: "Podpora" },
]

export const ORIGIN_OPTIONS: { value: Origin; label: string }[] = [
  { value: "mistni",   label: "Místní" },
  { value: "pribuzni", label: "Příbuzní" },
  { value: "cizi",     label: "Cizí" },
]

export const TRIPLETS: Triplet[] = ["A", "B"]

export const isSpecialization = (v: unknown): v is Specialization =>
  SPECIALIZATION_OPTIONS.some(o => o.value === v)
export const isOrigin = (v: unknown): v is Origin =>
  ORIGIN_OPTIONS.some(o => o.value === v)
export const isTriplet = (v: unknown): v is Triplet =>
  v === "A" || v === "B"
