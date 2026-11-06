"use client"

import React, { useCallback, useState } from "react"
import { useGame } from "@/lib/game-context"
import { adminFetch } from "@/lib/admin-client"

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
        addToast(res.status === 401 ? "Příprava není přihlášená, změna se neuložila" : "Změnu se nepodařilo uložit", "error")
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
export function Segmented<T extends string>({ label, options, value, onChange, busy }: {
  label: string
  options: { value: T; label: string }[]
  value: T | undefined
  onChange: (v: T) => void
  busy?: boolean
}) {
  return (
    <div role="radiogroup" aria-label={label} className="seg" style={{ opacity: busy ? 0.55 : 1 }}>
      {options.map(o => {
        const on = o.value === value
        return (
          <button key={o.value} type="button" role="radio" aria-checked={on} disabled={busy}
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
