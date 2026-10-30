"use client"

import React, { useState } from "react"
import { IconPlayerPlay, IconPlus, IconDownload } from "@tabler/icons-react"
import { Input } from "@/components/ui/input"
import { useGame } from "@/lib/game-context"
import { TEAMS, UNITS, CIRCLES, CHARACTERS } from "@/lib/data"
import { getTeamName } from "@/lib/utils"
import { buildStandingsCsv } from "@/lib/standings-csv"
import { downloadText } from "@/lib/download"

const SPECIALIZATIONS = [
  { value: "", label: "—" },
  { value: "combat",   label: "Bojová" },
  { value: "tactical", label: "Taktická" },
  { value: "support",  label: "Podpora" },
]

const selectStyle: React.CSSProperties = {
  backgroundColor: "var(--c-input)",
  border: "1px solid var(--c-input-border)",
  borderRadius: 6,
  color: "var(--c-text)",
  fontSize: "0.82rem",
  padding: "4px 8px",
  cursor: "pointer",
}

function section(title: string, children: React.ReactNode) {
  return (
    <div style={{
      backgroundColor: "var(--c-bg-section)",
      border: "1px solid var(--c-border)",
      borderRadius: 10,
      padding: 20,
      marginBottom: 16,
    }}>
      <p style={{ color: "var(--c-accent)", fontSize: "0.75rem", letterSpacing: "0.1em", marginBottom: 14 }}>{title}</p>
      {children}
    </div>
  )
}

export function RunSetupPanel() {
  const { runs, activeRunId, setActiveRun, createRun, teams, characters } = useGame()
  const [newRunName, setNewRunName] = useState("")
  const [creating, setCreating] = useState(false)
  const [saving, setSaving] = useState<string | null>(null)

  const students = CHARACTERS.filter(c => c.role === "student" || c.role === "ruze")

  const handleExportResults = () => {
    const runName = runs.find(r => r.id === activeRunId)?.name ?? "beh"
    const csv = buildStandingsCsv({ characters, teams, units: UNITS, circles: CIRCLES })
    downloadText(`akano3-vysledky-${runName.replace(/[^\p{L}\p{N}]+/gu, "-")}.csv`, "﻿" + csv)
  }

  const handleCreateRun = async () => {
    if (!newRunName.trim()) return
    setCreating(true)
    await createRun(newRunName.trim())
    setNewRunName("")
    setCreating(false)
  }

  const saveConfig = async (key: string, payload: Record<string, unknown>) => {
    setSaving(key)
    await fetch("/api/config", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })
    setSaving(null)
  }

  const handleSetTeamUnit = (teamId: string, unitId: string) =>
    saveConfig(`team:${teamId}`, { action: "setTeamUnit", teamId, unitId })

  const handleSetCircle = (circleId: string, memberIds: string[]) =>
    saveConfig(`circle:${circleId}`, { action: "setCircleMembers", circleId, memberIds })

  const handleSetSpec = (characterId: string, specialization: string) =>
    saveConfig(`spec:${characterId}`, { action: "setSpecialization", characterId, specialization: specialization || null })

  return (
    <div style={{ maxWidth: 640 }}>

      {section("SPRÁVA BĚHŮ",
        <div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
            {runs.map(run => (
              <div key={run.id} style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                padding: "10px 14px", borderRadius: 8,
                backgroundColor: run.isActive ? "rgba(47,125,79,0.1)" : "var(--c-bg-section)",
                border: `1px solid ${run.isActive ? "rgba(47,125,79,0.4)" : "var(--c-border)"}`,
              }}>
                <div>
                  <span style={{ fontWeight: 700, color: "var(--c-text)", fontSize: "0.9rem" }}>{run.name}</span>
                  {run.isActive && (
                    <span style={{
                      marginLeft: 10, backgroundColor: "var(--c-success)", color: "#F4ECDF",
                      fontSize: "0.7rem", padding: "2px 8px", borderRadius: 20, fontWeight: 700,
                    }}>AKTIVNÍ</span>
                  )}
                  <p style={{ color: "var(--c-text-muted)", fontSize: "0.72rem", marginTop: 2 }}>
                    #{run.id} · {run.createdAt.toLocaleDateString("cs-CZ")}
                  </p>
                </div>
                {!run.isActive && (
                  <button
                    onClick={() => setActiveRun(run.id)}
                    style={{
                      display: "flex", alignItems: "center", gap: 5,
                      backgroundColor: "var(--c-teal)", color: "#F4ECDF", border: "none",
                      borderRadius: 6, padding: "6px 12px", cursor: "pointer", fontSize: "0.8rem", fontWeight: 700,
                    }}
                  >
                    <IconPlayerPlay size={13} /> Aktivovat
                  </button>
                )}
              </div>
            ))}
          </div>

          <button
            onClick={handleExportResults}
            style={{
              display: "flex", alignItems: "center", gap: 5, marginBottom: 16,
              backgroundColor: "var(--c-teal)", color: "#F4ECDF", border: "none",
              borderRadius: 6, padding: "6px 12px", cursor: "pointer", fontSize: "0.8rem", fontWeight: 700,
            }}
          >
            <IconDownload size={13} /> Export výsledků
          </button>

          <div style={{ display: "flex", gap: 8 }}>
            <Input
              placeholder="Název nového běhu…"
              value={newRunName}
              onChange={e => setNewRunName(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleCreateRun()}
              style={{ flex: 1, backgroundColor: "var(--c-input)", border: "1px solid var(--c-input-border)", color: "var(--c-text)" }}
            />
            <button
              onClick={handleCreateRun}
              disabled={creating || !newRunName.trim()}
              style={{
                display: "flex", alignItems: "center", gap: 5,
                backgroundColor: "var(--c-accent)", color: "#F4ECDF", border: "none",
                borderRadius: 6, padding: "0 16px", cursor: "pointer", fontSize: "0.85rem", fontWeight: 700,
                opacity: creating || !newRunName.trim() ? 0.5 : 1,
              }}
            >
              <IconPlus size={14} /> Vytvořit
            </button>
          </div>
        </div>
      )}

      {section("PŘIŘAZENÍ JEDNOTEK",
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {TEAMS.map(staticTeam => {
            const liveTeam = teams.find(t => t.id === staticTeam.id)
            const currentUnitId = liveTeam?.unitId ?? staticTeam.unitId
            return (
              <div key={staticTeam.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ color: "var(--c-text)", fontSize: "0.85rem", minWidth: 120 }}>
                  {getTeamName(staticTeam.id)}
                  {saving === `team:${staticTeam.id}` &&<span style={{ color: "var(--c-text-muted)", fontSize: "0.75rem", marginLeft: 6 }}>ukládám…</span>}
                </span>
                <select
                  value={currentUnitId}
                  onChange={e => handleSetTeamUnit(staticTeam.id, e.target.value)}
                  disabled={saving === `team:${staticTeam.id}`}
                  style={selectStyle}
                >
                  {UNITS.map(u => (
                    <option key={u.id} value={u.id}>{u.name}</option>
                  ))}
                </select>
              </div>
            )
          })}
        </div>
      )}

      {section("ČLENOVÉ KRUHŮ",
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {CIRCLES.map(circle => {
            const memberIds = characters
              .filter(c => c.circleIds.includes(circle.id))
              .map(c => c.id)
            return (
              <div key={circle.id}>
                <p style={{ color: "var(--c-accent)", fontSize: "0.8rem", marginBottom: 6, fontWeight: 600 }}>
                  {circle.name}
                  {saving === `circle:${circle.id}` &&<span style={{ color: "var(--c-text-muted)", fontSize: "0.72rem", marginLeft: 6 }}>ukládám…</span>}
                </p>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {students.map(student => {
                    const checked = memberIds.includes(student.id)
                    return (
                      <button
                        key={student.id}
                        onClick={() => {
                          const next = checked
                            ? memberIds.filter(id => id !== student.id)
                            : [...memberIds, student.id]
                          handleSetCircle(circle.id, next)
                        }}
                        style={{
                          padding: "3px 10px", borderRadius: 20, fontSize: "0.78rem", cursor: "pointer",
                          border: `1px solid ${checked ? "var(--c-accent)" : "var(--c-border-mid)"}`,
                          backgroundColor: checked ? "var(--c-accent)" : "transparent",
                          color: checked ? "#F4ECDF" : "var(--c-text-muted)",
                          fontWeight: checked ? 700 : 400,
                        }}
                      >
                        {student.name}
                      </button>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {section("SPECIALIZACE POSTAV",
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {students.map(student => {
            const liveChar = characters.find(c => c.id === student.id)
            const currentSpec = liveChar?.specialization ?? ""
            return (
              <div key={student.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ color: "var(--c-text)", fontSize: "0.85rem", minWidth: 160 }}>
                  {student.name}
                  {saving === `spec:${student.id}` &&<span style={{ color: "var(--c-text-muted)", fontSize: "0.75rem", marginLeft: 6 }}>ukládám…</span>}
                </span>
                <select
                  value={currentSpec ?? ""}
                  onChange={e => handleSetSpec(student.id, e.target.value)}
                  disabled={saving === `spec:${student.id}`}
                  style={selectStyle}
                >
                  {SPECIALIZATIONS.map(s => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </select>
              </div>
            )
          })}
        </div>
      )}

    </div>
  )
}
