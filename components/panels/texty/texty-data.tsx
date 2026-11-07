"use client"

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react"
import { adminFetch } from "@/lib/admin-client"
import { useGame } from "@/lib/game-context"
import { TEAMS, UNITS, CIRCLES } from "@/lib/data"
import { DOC_PLAYERS, TRAIT_ENTITIES } from "@/lib/doc-ids"
import { DOC_FIELDS, docKey, type DocEntityType } from "@/lib/doc-fields"
import { statusOf, worstStatus, type DocStatus } from "@/lib/doc-status"
import type { TextMeta, TextRecord, UnitRole } from "@/lib/docs-store"
import type { Triplet } from "@/lib/types"

// Data sekce Texty: stavy všech polí, role jednotek, gendery postav.

export type Category = DocEntityType

export const CATEGORIES: { value: Category; label: string }[] = [
  { value: "character", label: "Postavy" },
  { value: "team",      label: "Týmy" },
  { value: "unit",      label: "Jednotky" },
  { value: "role",      label: "Role" },
  { value: "circle",    label: "Kruhy" },
  { value: "trait",     label: "Specializace a původy" },
]

export type DocEntity = {
  type: DocEntityType
  id: string
  name: string
  sub?: string
  group?: string
  color?: string
}

export const STATUS_COLORS: Record<DocStatus, string> = {
  empty: "transparent",
  draft: "#C08A2C",
  done: "#2FAEAE",
  approved: "#5BBF87",
}

export function buildEntities(category: Category, roles: readonly UnitRole[]): DocEntity[] {
  switch (category) {
    case "character":
      return DOC_PLAYERS.map(c => {
        const team = TEAMS.find(t => t.id === c.teamId)
        return { type: "character", id: c.id, name: c.name, group: team?.name, color: team?.color }
      })
    case "team":
      return TEAMS.map(t => ({ type: "team", id: t.id, name: t.name, color: t.color }))
    case "unit":
      return UNITS.map(u => ({ type: "unit", id: u.id, name: u.name }))
    case "role":
      return UNITS.flatMap(u => (["A", "B"] as Triplet[]).flatMap(t =>
        roles.filter(r => r.unitId === u.id && r.triplet === t)
          .map(r => ({ type: "role" as const, id: String(r.id), name: r.nameM, sub: r.nameF !== r.nameM ? r.nameF : undefined, group: `${u.name} · trojice ${t}` }))))
    case "circle":
      return CIRCLES.map(c => ({ type: "circle", id: c.id, name: c.name }))
    case "trait":
      return TRAIT_ENTITIES.map(t => ({ type: "trait", id: t.id, name: t.name, group: t.group }))
  }
}

type TextyCtx = {
  loaded: boolean
  meta: Map<string, TextMeta>
  roles: UnitRole[]
  genders: Record<string, string | null>
  statusOfField: (type: DocEntityType, id: string, field: string) => DocStatus
  entityStatus: (type: DocEntityType, id: string) => DocStatus
  putMeta: (rec: TextMeta | TextRecord) => void
  reload: () => Promise<void>
  setGender: (characterId: string, gender: "m" | "f" | null) => Promise<void>
  saveRole: (role: Omit<UnitRole, "id" | "sortOrder"> & { id?: number }) => Promise<string | null>
  deleteRole: (id: number) => Promise<void>
}

const Ctx = createContext<TextyCtx | null>(null)

export function TextyProvider({ children }: { children: React.ReactNode }) {
  const { addToast } = useGame()
  const [loaded, setLoaded] = useState(false)
  const [meta, setMeta] = useState<Map<string, TextMeta>>(new Map())
  const [roles, setRoles] = useState<UnitRole[]>([])
  const [genders, setGenders] = useState<Record<string, string | null>>({})

  const reload = useCallback(async () => {
    try {
      const res = await adminFetch("/api/priprava/texts")
      if (!res.ok) throw new Error(String(res.status))
      const data = await res.json() as { texts: TextMeta[]; roles: UnitRole[]; genders: Record<string, string | null> }
      setMeta(new Map(data.texts.map(t => [docKey(t.entityType, t.entityId, t.field), t])))
      setRoles(data.roles)
      setGenders(data.genders)
    } catch {
      addToast("Texty se nepodařilo načíst", "error")
    } finally {
      setLoaded(true)
    }
  }, [addToast])

  useEffect(() => { reload() }, [reload])

  const putMeta = useCallback((rec: TextMeta | TextRecord) => {
    const length = "body" in rec ? rec.body.length : rec.length
    const { body: _body, ...m } = rec as TextRecord
    setMeta(prev => new Map(prev).set(docKey(rec.entityType, rec.entityId, rec.field), { ...m, length }))
  }, [])

  const statusOfField = useCallback((type: DocEntityType, id: string, field: string) =>
    statusOf(meta.get(docKey(type, id, field))), [meta])

  const entityStatus = useCallback((type: DocEntityType, id: string) =>
    worstStatus(DOC_FIELDS[type].map(f => statusOf(meta.get(docKey(type, id, f.key))))), [meta])

  const setGender = useCallback(async (characterId: string, gender: "m" | "f" | null) => {
    const res = await adminFetch("/api/priprava/character-meta", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ characterId, gender }),
    }).catch(() => null)
    if (!res?.ok) { addToast("Gender se nepodařilo uložit", "error"); return }
    setGenders(g => ({ ...g, [characterId]: gender }))
  }, [addToast])

  const saveRole = useCallback<TextyCtx["saveRole"]>(async role => {
    const res = await adminFetch("/api/priprava/roles", {
      method: role.id ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(role),
    }).catch(() => null)
    if (!res) return "Chyba sítě"
    if (!res.ok) return await res.text()
    const saved = await res.json() as UnitRole
    setRoles(prev => role.id ? prev.map(r => r.id === saved.id ? saved : r) : [...prev, saved])
    return null
  }, [])

  const deleteRole = useCallback(async (id: number) => {
    const res = await adminFetch(`/api/priprava/roles?id=${id}`, { method: "DELETE" }).catch(() => null)
    if (!res?.ok) { addToast("Roli se nepodařilo smazat", "error"); return }
    setRoles(prev => prev.filter(r => r.id !== id))
    setMeta(prev => {
      const next = new Map(prev)
      next.delete(docKey("role", String(id), "personal"))
      return next
    })
  }, [addToast])

  const value = useMemo(() => ({
    loaded, meta, roles, genders, statusOfField, entityStatus, putMeta, reload, setGender, saveRole, deleteRole,
  }), [loaded, meta, roles, genders, statusOfField, entityStatus, putMeta, reload, setGender, saveRole, deleteRole])

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useTexty() {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error("useTexty must be inside TextyProvider")
  return ctx
}

export function StatusDot({ status, size = 10, changed }: { status: DocStatus; size?: number; changed?: boolean }) {
  return (
    <span aria-hidden style={{
      display: "inline-block", width: size, height: size, borderRadius: "50%", flexShrink: 0,
      backgroundColor: STATUS_COLORS[status],
      border: status === "empty" ? "1.5px solid var(--c-border-str)" : "none",
      boxShadow: changed ? "0 0 0 2px var(--destructive)" : undefined,
    }} />
  )
}
