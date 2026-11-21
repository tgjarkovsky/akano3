"use client"

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react"
import { adminFetch, getOrganizer } from "@/lib/admin-client"
import { useGame } from "@/lib/game-context"
import { indexRules, type AssignmentRule, type RuleProperty, type RuleSubject } from "@/lib/assignment-rules"
import type { RuleRole } from "@/lib/role-rules"

// Pravidla obsazení pro celou Přípravu: sekce Pravidla je upravuje,
// Běhy a obsazení podle nich zamyká volby a hlásí porušení.

type RulesCtx = {
  rules: AssignmentRule[]
  index: Map<string, string[]>
  /** role jednotek pro pravidlo „role“ (Příprava → Texty → Role) */
  roles: RuleRole[]
  loaded: boolean
  pending: string | null
  saveRule: (subjectType: RuleSubject, subjectId: string, property: RuleProperty, allowed: string[] | null) => Promise<boolean>
  /** doplní pevné hodnoty v běhu (bez runId v aktivním); onDone se zavolá po uložení */
  applyFixed: (runId?: number | null, onDone?: () => void | Promise<void>) => Promise<void>
}

const Ctx = createContext<RulesCtx | null>(null)

export function RulesProvider({ children }: { children: React.ReactNode }) {
  const { addToast, refreshGameState } = useGame()
  const [rules, setRules] = useState<AssignmentRule[]>([])
  const [roles, setRoles] = useState<RuleRole[]>([])
  const [loaded, setLoaded] = useState(false)
  const [pending, setPending] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    adminFetch("/api/priprava/rules")
      .then(r => r.ok ? r.json() : Promise.reject(r.status))
      .then((rows: AssignmentRule[]) => { if (!cancelled) { setRules(rows); setLoaded(true) } })
      .catch(() => { if (!cancelled) { setLoaded(true); addToast("Pravidla se nepodařilo načíst", "error") } })
    adminFetch("/api/priprava/roles")
      .then(r => r.ok ? r.json() : Promise.reject(r.status))
      .then((rows: RuleRole[]) => { if (!cancelled) setRoles(rows) })
      .catch(() => { if (!cancelled) addToast("Role jednotek se nepodařilo načíst", "error") })
    return () => { cancelled = true }
  }, [addToast])

  const saveRule = useCallback<RulesCtx["saveRule"]>(async (subjectType, subjectId, property, allowed) => {
    const key = `${subjectType}:${subjectId}:${property}`
    setPending(key)
    try {
      const res = await adminFetch("/api/priprava/rules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subjectType, subjectId, property, allowed, by: getOrganizer() }),
      })
      if (!res.ok) { addToast(res.status === 400 || res.status === 409 ? await res.text() : "Pravidlo se nepodařilo uložit", "error"); return false }
      setRules(await res.json())
      return true
    } catch {
      addToast("Chyba sítě, pravidlo se neuložilo", "error")
      return false
    } finally {
      setPending(null)
    }
  }, [addToast])

  const applyFixed = useCallback(async (runId?: number | null, onDone?: () => void | Promise<void>) => {
    setPending("apply-fixed")
    try {
      const res = await adminFetch("/api/priprava/rules/apply-fixed", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ runId: runId ?? null }),
      })
      if (!res.ok) { addToast("Pevné hodnoty se nepodařilo doplnit", "error"); return }
      const { applied } = await res.json() as { applied: number }
      await Promise.all([refreshGameState(), onDone?.()])
      addToast(applied === 0 ? "Všechny pevné hodnoty už sedí" : `Doplněno ${applied} pevných hodnot`)
    } catch {
      addToast("Chyba sítě", "error")
    } finally {
      setPending(null)
    }
  }, [addToast, refreshGameState])

  const index = useMemo(() => indexRules(rules), [rules])
  const value = useMemo(() => ({ rules, index, roles, loaded, pending, saveRule, applyFixed }), [rules, index, roles, loaded, pending, saveRule, applyFixed])
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useRules() {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error("useRules must be inside RulesProvider")
  return ctx
}
