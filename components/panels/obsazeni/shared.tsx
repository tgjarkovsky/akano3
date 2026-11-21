"use client"

import React, { useCallback, useEffect, useMemo, useState } from "react"
import { useGame } from "@/lib/game-context"
import { adminFetch, getOrganizer } from "@/lib/admin-client"
import { buildCharacters, buildTeams, type CharStateRow, type CircleMemberRow, type TeamUnitRow } from "@/lib/run-state"
import type { Character, Team } from "@/lib/types"

// Společné kousky obsazení běhu: stav vybraného běhu, ukládání, role, segmentový
// přepínač, nadpis sekce. Obsazení pracuje s během vybraným nahoře (ne nutně aktivním).

/** Rozvržení vybraného běhu: postavy (specializace, původ, kruhy, jednotka) a týmy. */
export function useRunState(runId: number | null) {
  const [state, setState] = useState<{ runId: number; characters: Character[]; teams: Team[] } | null>(null)
  const reload = useCallback(async () => {
    if (runId === null) return
    try {
      const res = await adminFetch(`/api/priprava/run-state?run=${runId}`)
      if (!res.ok) return
      const d = await res.json() as { runId: number; charState: CharStateRow[]; circleMembers: CircleMemberRow[]; teamUnits: TeamUnitRow[] }
      const characters = buildCharacters(d.charState, [], d.circleMembers, d.teamUnits)
      setState({ runId: d.runId, characters, teams: buildTeams(characters, d.teamUnits) })
    } catch { /* bez sítě zůstane poslední stav */ }
  }, [runId])
  useEffect(() => { void reload() }, [reload])
  // Dokud se nový běh nenačte, neukazuj starý.
  const current = state && state.runId === runId ? state : null
  return { characters: current?.characters ?? null, teams: current?.teams ?? null, reload }
}

/** Uloží akci obsazení v běhu a pak zavolá onSaved (načtení stavu). `pending` drží klíč právě ukládané změny. */
export function useSetupSave(runId: number | null, onSaved: () => Promise<void>) {
  const { addToast, refreshGameState } = useGame()
  const [pending, setPending] = useState<string | null>(null)

  const save = useCallback(async (key: string, payload: Record<string, unknown>): Promise<boolean> => {
    setPending(key)
    try {
      const res = await adminFetch("/api/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...payload, runId }),
      })
      if (!res.ok) {
        addToast(
          res.status === 401 ? "Příprava není přihlášená, změna se neuložila"
          : res.status === 409 ? await res.text()
          : "Změnu se nepodařilo uložit",
          "error",
        )
        return false
      }
      await Promise.all([onSaved(), refreshGameState()])
      return true
    } catch {
      addToast("Chyba sítě, změna se neuložila", "error")
      return false
    } finally {
      setPending(null)
    }
  }, [addToast, refreshGameState, runId, onSaved])

  return { save, pending }
}

type HolderRow = { characterId: string; roleId: string; fixed: boolean }

/**
 * Role jednotek v běhu (lib/role-holders.ts): kdo drží kterou roli.
 * `held` je id postavy → id role, `fixed` postavy s pevnou rolí z Pravidel.
 * Po přesunu týmu nebo změně běhu zavolej reload.
 */
export function useRoleHolders(runId: number | null) {
  const { addToast } = useGame()
  const [rows, setRows] = useState<HolderRow[]>([])
  const [pending, setPending] = useState<string | null>(null)

  const reload = useCallback(async () => {
    try {
      if (runId === null) return
      const res = await adminFetch(`/api/priprava/role-holders?run=${runId}`)
      if (res.ok) setRows(await res.json())
    } catch { /* bez sítě zůstane poslední stav */ }
  }, [runId])
  useEffect(() => { void reload() }, [reload])

  const assign = useCallback(async (characterId: string, roleId: string | null) => {
    setPending(characterId)
    try {
      const res = await adminFetch("/api/priprava/role-holders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ characterId, roleId, runId, by: getOrganizer() }),
      })
      if (!res.ok) { addToast(res.status === 409 || res.status === 400 ? await res.text() : "Roli se nepodařilo uložit", "error"); return }
      setRows(await res.json())
    } catch {
      addToast("Chyba sítě, role se neuložila", "error")
    } finally {
      setPending(null)
    }
  }, [addToast, runId])

  const held = useMemo(() => new Map(rows.map(r => [r.characterId, r.roleId])), [rows])
  const fixed = useMemo(() => new Set(rows.filter(r => r.fixed).map(r => r.characterId)), [rows])
  return { held, fixed, assign, pending, reload }
}

export function SectionTitle({ children, note }: { children: React.ReactNode; note?: React.ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12, flexWrap: "wrap", margin: "0 0 12px" }}>
      <h2 style={{
        fontFamily: "var(--font-display)", textTransform: "uppercase", letterSpacing: "0.06em",
        fontSize: "1rem", fontWeight: 700, color: "var(--c-accent)", margin: 0,
      }}>{children}</h2>
      {note && <span style={{ fontSize: "0.8rem", color: "var(--c-text-faint)" }}>{note}</span>}
    </div>
  )
}

/** Tři (nebo víc) vzájemně výlučných tlačítek. Vybrané je plné, ostatní obrysové. */
export function Segmented<T extends string>({ label, options, value, onChange, busy, allowed }: {
  label: string
  options: { value: T; label: string }[]
  value: T | undefined
  onChange: (v: T) => void
  busy?: boolean
  /** povolené hodnoty podle pravidel; null = všechny */
  allowed?: readonly string[] | null
}) {
  return (
    <div role="radiogroup" aria-label={label} className="seg" style={{ opacity: busy ? 0.55 : 1 }}>
      {options.map(o => {
        const on = o.value === value
        const blocked = !!allowed && !allowed.includes(o.value)
        return (
          <button key={o.value} type="button" role="radio" aria-checked={on} disabled={busy || (blocked && !on)}
            title={blocked ? "Zakázáno pravidlem" : undefined}
            onClick={() => { if (!on) onChange(o.value) }}
            className={on ? "seg-item seg-on" : "seg-item"}>
            {o.label}
          </button>
        )
      })}
    </div>
  )
}

/** Krátce zvýrazní prvek a odroluje k němu (proklik z kontrol). */
export function focusElement(id: string) {
  const el = document.getElementById(id)
  if (!el) return
  el.scrollIntoView({ behavior: "smooth", block: "center" })
  el.classList.remove("flash")
  void el.offsetWidth
  el.classList.add("flash")
}
