"use client"

import React, { useCallback, useEffect, useMemo, useState } from "react"
import { useGame } from "@/lib/game-context"
import { adminFetch, getOrganizer } from "@/lib/admin-client"

// Společné kousky obsazení běhu: ukládání, segmentový přepínač, nadpis sekce.

/** Uloží akci obsazení a hned načte stav hry. `pending` drží klíč právě ukládané změny. */
export function useSetupSave() {
  const { addToast, refreshGameState } = useGame()
  const [pending, setPending] = useState<string | null>(null)

  const save = useCallback(async (key: string, payload: Record<string, unknown>): Promise<boolean> => {
    setPending(key)
    try {
      const res = await adminFetch("/api/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
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
      await refreshGameState()
      return true
    } catch {
      addToast("Chyba sítě, změna se neuložila", "error")
      return false
    } finally {
      setPending(null)
    }
  }, [addToast, refreshGameState])

  return { save, pending }
}

type HolderRow = { characterId: string; roleId: string; fixed: boolean }

/**
 * Role jednotek v aktivním běhu (lib/role-holders.ts): kdo drží kterou roli.
 * `held` je id postavy → id role, `fixed` postavy s pevnou rolí z Pravidel.
 * Po přesunu týmu nebo změně běhu zavolej reload.
 */
export function useRoleHolders() {
  const { addToast, activeRunId } = useGame()
  const [rows, setRows] = useState<HolderRow[]>([])
  const [pending, setPending] = useState<string | null>(null)

  const reload = useCallback(async () => {
    try {
      const res = await adminFetch("/api/priprava/role-holders")
      if (res.ok) setRows(await res.json())
    } catch { /* bez sítě zůstane poslední stav */ }
  }, [])
  useEffect(() => { void reload() }, [reload, activeRunId])

  const assign = useCallback(async (characterId: string, roleId: string | null) => {
    setPending(characterId)
    try {
      const res = await adminFetch("/api/priprava/role-holders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ characterId, roleId, by: getOrganizer() }),
      })
      if (!res.ok) { addToast(res.status === 409 || res.status === 400 ? await res.text() : "Roli se nepodařilo uložit", "error"); return }
      setRows(await res.json())
    } catch {
      addToast("Chyba sítě, role se neuložila", "error")
    } finally {
      setPending(null)
    }
  }, [addToast])

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
