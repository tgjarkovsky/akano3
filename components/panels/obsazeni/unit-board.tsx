"use client"

import React, { useState } from "react"
import { IconGripVertical, IconAlertTriangle, IconCircleCheck } from "@tabler/icons-react"
import { UNITS, TEAMS } from "@/lib/data"
import { TeamIcon } from "@/components/shared/team-icon"
import { getUnitName } from "@/lib/utils"
import { SPECIALIZATION_OPTIONS, ORIGIN_OPTIONS } from "@/lib/setup-options"
import { planTeamMove, type UnitSlots } from "@/lib/unit-slots"
import { isAllowed } from "@/lib/assignment-rules"
import { slotBlockedByRoles, type RuleRole } from "@/lib/role-rules"
import type { Character, Triplet } from "@/lib/types"
import { SectionTitle } from "./shared"

const specLabel = (v?: string) => SPECIALIZATION_OPTIONS.find(o => o.value === v)?.label
const originLabel = (v?: string) => ORIGIN_OPTIONS.find(o => o.value === v)?.label

type Props = {
  slots: UnitSlots[]
  unplacedTeamIds: string[]
  characters: Character[]
  /** jednotky s chybou (prázdný slot, tým navíc) */
  unitsWithIssues: Set<string>
  pendingTeamId: string | null
  onMove: (teamId: string, unitId: string, triplet: Triplet) => void
  rules: Map<string, string[]>
  roles: RuleRole[]
}

export function UnitBoard({ slots, unplacedTeamIds, characters, unitsWithIssues, pendingTeamId, onMove, rules, roles }: Props) {
  const [dragTeam, setDragTeam] = useState<string | null>(null)
  const [overSlot, setOverSlot] = useState<string | null>(null)

  const slotProps = (unitId: string, triplet: Triplet) => {
    const key = `${unitId}:${triplet}`
    return {
      onDragOver: (e: React.DragEvent) => { if (dragTeam) { e.preventDefault(); setOverSlot(key) } },
      onDragLeave: () => setOverSlot(s => s === key ? null : s),
      onDrop: (e: React.DragEvent) => {
        e.preventDefault()
        const teamId = e.dataTransfer.getData("text/plain") || dragTeam
        setOverSlot(null); setDragTeam(null)
        if (teamId) onMove(teamId, unitId, triplet)
      },
      "data-over": overSlot === key && dragTeam ? "true" : undefined,
    }
  }

  const card = (teamId: string, warn = false) => (
    <TeamCard key={teamId} teamId={teamId} warn={warn} characters={characters}
      slots={slots} busy={pendingTeamId === teamId} rules={rules} roles={roles}
      onDragStart={() => setDragTeam(teamId)} onDragEnd={() => { setDragTeam(null); setOverSlot(null) }}
      onMove={onMove} />
  )

  return (
    <section>
      <SectionTitle note="Přetáhni tým do jiné trojice, nebo použij „Přesunout do…“. Obsazené místo se vymění.">
        Jednotky
      </SectionTitle>
      <div className="unit-board">
        {slots.map(s => {
          const bad = unitsWithIssues.has(s.unitId)
          return (
            <div key={s.unitId} id={`unit-${s.unitId}`} className="unit-col" data-bad={bad ? "true" : undefined}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 8 }}>
                <h3 style={{ margin: 0, fontSize: "1rem", fontWeight: 800, color: "var(--c-text)" }}>{getUnitName(s.unitId)}</h3>
                {bad
                  ? <IconAlertTriangle size={16} color="var(--destructive)" aria-label="Jednotka má problém" />
                  : <IconCircleCheck size={16} color="var(--c-success)" aria-label="Jednotka je obsazená" />}
              </div>
              {(["A", "B"] as const).map(t => {
                const teamId = s[t]
                return (
                  <div key={t} className="slot" {...slotProps(s.unitId, t)}>
                    <p className="slot-label">Trojice {t}</p>
                    {teamId ? card(teamId) : <p className="slot-empty">Přetáhni sem tým</p>}
                  </div>
                )
              })}
              {s.overflow.length > 0 && (
                <div style={{ marginTop: 8 }}>
                  <p className="slot-label" style={{ color: "var(--destructive)" }}>Navíc, přesuň jinam</p>
                  {s.overflow.map(id => card(id, true))}
                </div>
              )}
            </div>
          )
        })}
        {unplacedTeamIds.length > 0 && (
          <div className="unit-col" data-bad="true">
            <h3 style={{ margin: "0 0 8px", fontSize: "1rem", fontWeight: 800, color: "var(--c-text)" }}>Bez jednotky</h3>
            {unplacedTeamIds.map(id => card(id, true))}
          </div>
        )}
      </div>
    </section>
  )
}

function TeamCard({ teamId, warn, characters, slots, busy, onDragStart, onDragEnd, onMove, rules, roles }: {
  rules: Map<string, string[]>
  roles: RuleRole[]
  teamId: string
  warn: boolean
  characters: Character[]
  slots: UnitSlots[]
  busy: boolean
  onDragStart: () => void
  onDragEnd: () => void
  onMove: Props["onMove"]
}) {
  const team = TEAMS.find(t => t.id === teamId)
  const members = characters.filter(c => c.teamId === teamId)

  return (
    <div id={`team-${teamId}`} className="team-card" draggable={!busy}
      data-warn={warn ? "true" : undefined}
      style={{ borderLeftColor: team?.color ?? "var(--c-border-str)", opacity: busy ? 0.55 : 1 }}
      onDragStart={e => { e.dataTransfer.setData("text/plain", teamId); e.dataTransfer.effectAllowed = "move"; onDragStart() }}
      onDragEnd={onDragEnd}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
        <IconGripVertical size={14} color="var(--c-text-faint)" aria-hidden style={{ cursor: "grab", flexShrink: 0 }} />
        <TeamIcon teamId={teamId} size={15} />
        <span style={{ fontWeight: 700, fontSize: "0.9rem", color: "var(--c-text)" }}>{team?.name ?? teamId}</span>
        {busy && <span style={{ fontSize: "0.72rem", color: "var(--c-text-faint)", marginLeft: "auto" }}>ukládám…</span>}
      </div>
      <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 3 }}>
        {members.map(m => {
          const spec = specLabel(m.specialization), origin = originLabel(m.origin)
          return (
            <li key={m.id} style={{ display: "flex", justifyContent: "space-between", gap: 6, fontSize: "0.8rem" }}>
              <span style={{ color: "var(--c-text)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{m.name}</span>
              <span style={{ whiteSpace: "nowrap", color: "var(--c-text-faint)" }}>
                <span style={spec ? undefined : { color: "var(--destructive)" }}>{spec ?? "spec. ?"}</span>
                {" · "}
                <span style={origin ? undefined : { color: "var(--destructive)" }}>{origin ?? "původ ?"}</span>
              </span>
            </li>
          )
        })}
      </ul>
      <label style={{ display: "block", marginTop: 8 }}>
        <span className="sr-only">Přesunout {team?.name} do</span>
        <select value="" disabled={busy} className="move-select"
          onChange={e => {
            const [unitId, triplet] = e.target.value.split(":")
            if (unitId && (triplet === "A" || triplet === "B")) onMove(teamId, unitId, triplet)
          }}>
          <option value="">Přesunout do…</option>
          {UNITS.map(u => {
            const s = slots.find(x => x.unitId === u.id)
            return (["A", "B"] as const).map(t => {
              const occupant = s?.[t]
              if (occupant === teamId) return null
              const occName = occupant ? TEAMS.find(x => x.id === occupant)?.name : null
              // Zakázané, když by přesun (včetně výměny) porušil pravidlo jednotky nebo pevnou roli.
              const blocked = planTeamMove(slots, teamId, { unitId: u.id, triplet: t })
                .some(w => (w.unitId !== null && !isAllowed(rules, "team", w.teamId, "unit", w.unitId)) ||
                  slotBlockedByRoles(rules, roles, TEAMS.find(x => x.id === w.teamId)?.memberIds ?? [],
                    w.unitId !== null && w.triplet !== null ? { unitId: w.unitId, triplet: w.triplet } : { unitId: "", triplet: "A" }))
              return (
                <option key={`${u.id}:${t}`} value={`${u.id}:${t}`} disabled={blocked}>
                  {u.name} · {t}{blocked ? " (zakázáno pravidlem)" : occName ? ` (vyměnit s ${occName})` : " (volné)"}
                </option>
              )
            })
          })}
        </select>
      </label>
    </div>
  )
}
