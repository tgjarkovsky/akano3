"use client"

import React, { useMemo, useState } from "react"
import { IconSearch } from "@tabler/icons-react"
import { TEAMS, CIRCLES } from "@/lib/data"
import { TeamIcon } from "@/components/shared/team-icon"
import { getUnitName } from "@/lib/utils"
import { SPECIALIZATION_OPTIONS, ORIGIN_OPTIONS } from "@/lib/setup-options"
import type { UnitSlots } from "@/lib/unit-slots"
import type { Character, Specialization, Origin } from "@/lib/types"
import { allowedValues } from "@/lib/assignment-rules"
import { fixedRole, roleLabel, type RuleRole } from "@/lib/role-rules"
import { IconLock, IconWand } from "@tabler/icons-react"
import { SectionTitle, Segmented } from "./shared"

type Filter = { kind: "all" } | { kind: "issues" } | { kind: "circle"; id: string }

type Props = {
  slots: UnitSlots[]
  unplacedTeamIds: string[]
  players: Character[]
  withIssues: Set<string>
  pending: string | null
  onSpec: (characterId: string, v: Specialization) => void
  onOrigin: (characterId: string, v: Origin) => void
  onCircle: (characterId: string, circleId: string) => void
  rules: Map<string, string[]>
  roles: RuleRole[]
  /** kolik pevných hodnot z pravidel postavám ještě chybí */
  fixedPending: number
  applyingFixed: boolean
  onApplyFixed: () => void
}

export function CharacterTable({ slots, unplacedTeamIds, players, withIssues, pending, onSpec, onOrigin, onCircle, rules, roles, fixedPending, applyingFixed, onApplyFixed }: Props) {
  const [filter, setFilter] = useState<Filter>({ kind: "all" })
  const [query, setQuery] = useState("")

  // Pořadí skupin kopíruje nástěnku: jednotka → trojice A, B → navíc → bez jednotky.
  const groups = useMemo(() => {
    const out: { teamId: string; label: string }[] = []
    for (const s of slots) {
      for (const t of ["A", "B"] as const) if (s[t]) out.push({ teamId: s[t]!, label: `${getUnitName(s.unitId)} · ${t}` })
      for (const id of s.overflow) out.push({ teamId: id, label: `${getUnitName(s.unitId)} · navíc` })
    }
    for (const id of unplacedTeamIds) out.push({ teamId: id, label: "Bez jednotky" })
    return out
  }, [slots, unplacedTeamIds])

  const circleCounts = useMemo(() => {
    const m: Record<string, number> = {}
    for (const c of players) for (const id of c.circleIds) m[id] = (m[id] ?? 0) + 1
    return m
  }, [players])

  const q = query.trim().toLowerCase()
  const visible = (c: Character) => {
    if (q && !c.name.toLowerCase().includes(q)) return false
    if (filter.kind === "issues") return withIssues.has(c.id)
    if (filter.kind === "circle") return c.circleIds.includes(filter.id)
    return true
  }

  const chip = (active: boolean): React.CSSProperties => ({
    minHeight: 32, padding: "0 12px", borderRadius: 16, cursor: "pointer", fontSize: "0.8rem",
    border: `1px solid ${active ? "var(--c-accent)" : "var(--c-border-mid)"}`,
    backgroundColor: active ? "color-mix(in srgb, var(--c-accent) 18%, transparent)" : "transparent",
    color: active ? "var(--c-text)" : "var(--c-text-muted)", fontWeight: active ? 700 : 400, whiteSpace: "nowrap",
  })

  return (
    <section>
      <SectionTitle note="Specializace, původ a kruh pro každou postavu">Postavy</SectionTitle>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center", marginBottom: 12 }}>
        <label style={{ position: "relative", flex: "1 1 200px", maxWidth: 260 }}>
          <span className="sr-only">Hledat postavu</span>
          <IconSearch size={14} color="var(--c-text-faint)" style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)" }} />
          <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Hledat postavu"
            style={{
              width: "100%", boxSizing: "border-box", minHeight: 34, padding: "0 10px 0 30px",
              backgroundColor: "var(--c-input)", border: "1px solid var(--c-input-border)", borderRadius: 6,
              color: "var(--c-text)", fontSize: "0.85rem",
            }} />
        </label>
        <button style={chip(filter.kind === "all")} onClick={() => setFilter({ kind: "all" })}>Všechny ({players.length})</button>
        <button style={chip(filter.kind === "issues")} onClick={() => setFilter({ kind: "issues" })}>
          Chybí něco ({players.filter(p => withIssues.has(p.id)).length})
        </button>
        {fixedPending > 0 && (
          <button onClick={onApplyFixed} disabled={applyingFixed} title="Nastaví hodnoty, které pravidla určují napevno"
            style={{ ...chip(true), display: "inline-flex", alignItems: "center", gap: 6, marginLeft: "auto", opacity: applyingFixed ? 0.6 : 1 }}>
            <IconWand size={14} /> {applyingFixed ? "Doplňuji…" : `Doplnit pevné hodnoty (${fixedPending})`}
          </button>
        )}
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 14 }}>
        <span style={{ fontSize: "0.78rem", color: "var(--c-text-faint)", alignSelf: "center", marginRight: 2 }}>Kruhy:</span>
        {CIRCLES.map(c => {
          const on = filter.kind === "circle" && filter.id === c.id
          return (
            <button key={c.id} style={chip(on)} onClick={() => setFilter(on ? { kind: "all" } : { kind: "circle", id: c.id })}>
              {c.name} <span style={{ opacity: 0.7 }}>{circleCounts[c.id] ?? 0}</span>
            </button>
          )
        })}
      </div>

      <div className="char-table" role="table" aria-label="Obsazení postav">
        <div className="char-row char-head" role="row">
          <span role="columnheader">Postava</span>
          <span role="columnheader">Specializace</span>
          <span role="columnheader">Původ</span>
          <span role="columnheader">Kruh</span>
        </div>
        {groups.map(g => {
          const team = TEAMS.find(t => t.id === g.teamId)
          const rows = players.filter(c => c.teamId === g.teamId && visible(c))
          if (rows.length === 0) return null
          return (
            <div key={g.teamId} role="rowgroup">
              <div className="char-group" role="row" style={{ borderLeftColor: team?.color }}>
                <TeamIcon teamId={g.teamId} size={14} />
                <span style={{ fontWeight: 700 }}>{team?.name}</span>
                <span style={{ color: "var(--c-text-faint)" }}>{g.label}</span>
              </div>
              {rows.map(c => {
                const issue = withIssues.has(c.id)
                const circleBusy = pending === `circle:${c.id}`
                const specAllowed = allowedValues(rules, "character", c.id, "specialization")
                const originAllowed = allowedValues(rules, "character", c.id, "origin")
                const circleAllowed = allowedValues(rules, "character", c.id, "circle")
                const lock = (a: string[] | null) => a?.length === 1
                  ? <IconLock size={11} aria-label="napevno podle pravidla" style={{ marginLeft: 4, verticalAlign: "-1px" }} />
                  : null
                return (
                  <div key={c.id} id={`postava-${c.id}`} className="char-row" role="row" data-issue={issue ? "true" : undefined}>
                    <span role="cell" style={{ minWidth: 0 }}>
                      <span style={{ fontWeight: 700, color: "var(--c-text)" }}>{c.name}</span>
                      {(() => {
                        const r = fixedRole(rules, roles, c.id)
                        return r && (
                          <span style={{ display: "block", fontSize: "0.76rem", color: "var(--c-accent)" }}
                            title={`Pevná role v jednotce ${getUnitName(r.unitId)}, trojice ${r.triplet}`}>
                            <IconLock size={11} aria-hidden style={{ verticalAlign: "-1px" }} /> {roleLabel(r)}
                          </span>
                        )
                      })()}
                    </span>
                    <span role="cell">
                      <span className="cell-label">Specializace{lock(specAllowed)}</span>
                      <Segmented label={`Specializace ${c.name}`} options={SPECIALIZATION_OPTIONS}
                        value={c.specialization} busy={pending === `spec:${c.id}`} allowed={specAllowed}
                        onChange={v => onSpec(c.id, v)} />
                    </span>
                    <span role="cell">
                      <span className="cell-label">Původ{lock(originAllowed)}</span>
                      <Segmented label={`Původ ${c.name}`} options={ORIGIN_OPTIONS}
                        value={c.origin} busy={pending === `origin:${c.id}`} allowed={originAllowed}
                        onChange={v => onOrigin(c.id, v)} />
                    </span>
                    <span role="cell">
                      <span className="cell-label">Kruh{lock(circleAllowed)}</span>
                      <select value={c.circleIds.length === 1 ? c.circleIds[0] : ""}
                        disabled={circleBusy} aria-label={`Kruh ${c.name}`} className="circle-select"
                        data-empty={c.circleIds.length !== 1 ? "true" : undefined}
                        onChange={e => { if (e.target.value) onCircle(c.id, e.target.value) }}>
                        <option value="" disabled>
                          {c.circleIds.length > 1 ? `${c.circleIds.length} kruhy, vyber jeden` : "Vybrat kruh…"}
                        </option>
                        {CIRCLES.map(x => {
                          const blocked = !!circleAllowed && !circleAllowed.includes(x.id)
                          return <option key={x.id} value={x.id} disabled={blocked}>{x.name}{blocked ? " (zakázáno)" : ""}</option>
                        })}
                      </select>
                    </span>
                  </div>
                )
              })}
            </div>
          )
        })}
        {groups.every(g => players.filter(c => c.teamId === g.teamId && visible(c)).length === 0) && (
          <p style={{ padding: 16, color: "var(--c-text-muted)", fontSize: "0.9rem", margin: 0 }}>Žádná postava neodpovídá filtru.</p>
        )}
      </div>
    </section>
  )
}
