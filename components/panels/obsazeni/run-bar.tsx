"use client"

import React, { useState } from "react"
import { IconPlayerPlay, IconPlus, IconDownload, IconChevronDown, IconCalendar, IconCheck, IconX } from "@tabler/icons-react"
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { useGame } from "@/lib/game-context"
import { UNITS, CIRCLES } from "@/lib/data"
import { buildStandingsCsv } from "@/lib/standings-csv"
import { downloadText } from "@/lib/download"
import { formatRunDate } from "@/lib/character-doc"
import type { RunSummary } from "@/lib/types"

// Hlavička obsazení: který běh se upravuje, přepnutí, nový běh, export.

export function RunBar() {
  const { runs, activeRunId, setActiveRun, createRun, setRunDates, characters, teams } = useGame()
  const [open, setOpen] = useState(false)
  const [newName, setNewName] = useState("")
  const [newStart, setNewStart] = useState("")
  const [newEnd, setNewEnd] = useState("")
  const [editing, setEditing] = useState<{ id: number; start: string; end: string } | null>(null)
  const [creating, setCreating] = useState(false)
  const [confirmRun, setConfirmRun] = useState<RunSummary | null>(null)
  const active = runs.find(r => r.id === activeRunId)

  const validRange = (start: string, end: string) => !!start && !!end && end > start
  const canCreate = !!newName.trim() && validRange(newStart, newEnd)
  const create = async () => {
    if (!canCreate) return
    setCreating(true)
    if (await createRun(newName.trim(), newStart, newEnd)) { setNewName(""); setNewStart(""); setNewEnd("") }
    setCreating(false)
  }
  const saveDates = async () => {
    if (!editing || !validRange(editing.start, editing.end)) return
    if (await setRunDates(editing.id, editing.start, editing.end)) setEditing(null)
  }

  const exportCsv = () => {
    const csv = buildStandingsCsv({ characters, teams, units: UNITS, circles: CIRCLES })
    downloadText(`akano3-vysledky-${(active?.name ?? "beh").replace(/[^\p{L}\p{N}]+/gu, "-")}.csv`, "﻿" + csv)
  }

  const btn: React.CSSProperties = {
    display: "flex", alignItems: "center", gap: 6, minHeight: 36, padding: "0 12px",
    backgroundColor: "transparent", border: "1px solid var(--c-border-mid)", borderRadius: 6,
    color: "var(--c-text)", fontSize: "0.82rem", cursor: "pointer", whiteSpace: "nowrap",
  }

  return (
    <div style={{
      backgroundColor: "var(--c-bg-card)", border: "1px solid var(--c-border-mid)", borderRadius: 10,
      padding: "14px 16px", marginBottom: 20,
    }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div style={{ minWidth: 0 }}>
          <p style={{ fontSize: "0.75rem", color: "var(--c-text-muted)", margin: "0 0 2px" }}>Upravuješ obsazení aktivního běhu</p>
          <p style={{ margin: 0, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <span style={{ fontSize: "1.2rem", fontWeight: 800, color: "var(--c-text)" }}>{active?.name ?? "Žádný aktivní běh"}</span>
            {active && <span style={{
              fontSize: "0.7rem", fontWeight: 700, padding: "2px 8px", borderRadius: 10,
              color: "var(--c-success)", border: "1px solid color-mix(in srgb, var(--c-success) 45%, transparent)",
            }}>AKTIVNÍ · hraje se ve Velínu</span>}
          </p>
          {active && (
            <p style={{ margin: "2px 0 0", fontSize: "0.82rem", color: active.startsOn ? "var(--c-text-muted)" : "var(--c-accent)" }}>
              {formatRunDate(active.startsOn, active.endsOn) ?? "Běh nemá termín, doplň ho ve „Všechny běhy“"}
            </p>
          )}
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button style={btn} onClick={exportCsv}><IconDownload size={14} /> Export výsledků</button>
          <button style={btn} onClick={() => setOpen(o => !o)} aria-expanded={open}>
            Všechny běhy ({runs.length})
            <IconChevronDown size={14} style={{ transform: open ? "rotate(180deg)" : undefined, transition: "transform 0.15s" }} />
          </button>
        </div>
      </div>

      {open && (
        <div style={{ marginTop: 14, paddingTop: 14, borderTop: "1px solid var(--c-border)" }}>
          <ul style={{ listStyle: "none", margin: "0 0 12px", padding: 0, display: "flex", flexDirection: "column", gap: 6 }}>
            {runs.map(r => (
              <li key={r.id} style={{
                display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8,
                padding: "8px 12px", borderRadius: 8, border: "1px solid var(--c-border)",
                backgroundColor: r.isActive ? "color-mix(in srgb, var(--c-success) 10%, transparent)" : "transparent",
              }}>
                <span style={{ minWidth: 0 }}>
                  <span style={{ fontWeight: 700, color: "var(--c-text)" }}>{r.name}</span>
                  <span style={{ fontSize: "0.75rem", color: r.startsOn ? "var(--c-text-muted)" : "var(--c-accent)", marginLeft: 8 }}>
                    {formatRunDate(r.startsOn, r.endsOn) ?? "bez termínu"}
                  </span>
                  <span style={{ fontSize: "0.75rem", color: "var(--c-text-faint)", marginLeft: 8 }}>#{r.id}</span>
                </span>
                <span style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap", justifyContent: "flex-end" }}>
                  {editing?.id === r.id ? (
                    <form onSubmit={e => { e.preventDefault(); saveDates() }} style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
                      <DateInput label="Od" value={editing.start} onChange={v => setEditing({ ...editing, start: v })} required />
                      <DateInput label="Do" value={editing.end} min={nextDay(editing.start)} onChange={v => setEditing({ ...editing, end: v })} required />
                      <button type="submit" style={btn} disabled={!validRange(editing.start, editing.end)} aria-label="Uložit termín"><IconCheck size={14} /></button>
                      <button type="button" style={btn} onClick={() => setEditing(null)} aria-label="Zrušit úpravu termínu"><IconX size={14} /></button>
                    </form>
                  ) : (
                    <button style={btn} onClick={() => setEditing({ id: r.id, start: r.startsOn ?? "", end: r.endsOn ?? "" })}>
                      <IconCalendar size={13} /> Termín
                    </button>
                  )}
                  {r.isActive
                    ? <span style={{ fontSize: "0.75rem", color: "var(--c-success)", fontWeight: 700 }}>aktivní</span>
                    : <button style={btn} onClick={() => setConfirmRun(r)}><IconPlayerPlay size={13} /> Aktivovat</button>}
                </span>
              </li>
            ))}
          </ul>
          <form onSubmit={e => { e.preventDefault(); create() }} style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <label style={{ flex: "1 1 160px" }}>
              <span className="sr-only">Název nového běhu</span>
              <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Běh 3"
                style={{
                  width: "100%", boxSizing: "border-box", minHeight: 36, padding: "0 10px",
                  backgroundColor: "var(--c-input)", border: "1px solid var(--c-input-border)", borderRadius: 6,
                  color: "var(--c-text)", fontSize: "0.85rem",
                }} />
            </label>
            <DateInput label="Od" value={newStart} onChange={setNewStart} required />
            <DateInput label="Do" value={newEnd} min={nextDay(newStart)} onChange={setNewEnd} required />
            <button type="submit" disabled={creating || !canCreate} style={{ ...btn, opacity: creating || !canCreate ? 0.5 : 1 }}>
              <IconPlus size={14} /> Nový běh
            </button>
          </form>
          <p style={{ fontSize: "0.75rem", color: "var(--c-text-faint)", margin: "8px 0 0", lineHeight: 1.45 }}>
            Termín od–do je povinný (běh je vždy vícedenní), píše se hráčům do spisu. Nový běh převezme celé obsazení aktivního běhu (jednotky, specializace, původy, kruhy). Body, kaichi a alarm začínají od nuly.
          </p>
        </div>
      )}

      <AlertDialog open={confirmRun !== null} onOpenChange={o => { if (!o) setConfirmRun(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Aktivovat {confirmRun?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              Velín, hráči i projekce se okamžitě přepnou na tento běh: jiné body, alarm i obsazení.
              {active ? ` Běh ${active.name} zůstane uložený a jde se k němu vrátit.` : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Zrušit</AlertDialogCancel>
            <AlertDialogAction onClick={() => { if (confirmRun) setActiveRun(confirmRun.id); setConfirmRun(null) }}>
              Aktivovat
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

/** Den po zadaném datu (YYYY-MM-DD), aby konec nešel vybrat stejný jako začátek. */
function nextDay(iso: string): string | undefined {
  if (!iso) return undefined
  const d = new Date(`${iso}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + 1)
  return d.toISOString().slice(0, 10)
}

function DateInput({ label, value, onChange, min, required }: {
  label: string; value: string; onChange: (v: string) => void; min?: string; required?: boolean
}) {
  return (
    <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "0.78rem", color: "var(--c-text-muted)" }}>
      {label}
      <input type="date" value={value} min={min || undefined} required={required} onChange={e => onChange(e.target.value)}
        style={{
          minHeight: 36, padding: "0 8px", backgroundColor: "var(--c-input)", border: "1px solid var(--c-input-border)",
          borderRadius: 6, color: "var(--c-text)", fontSize: "0.85rem", colorScheme: "light dark",
        }} />
    </label>
  )
}
