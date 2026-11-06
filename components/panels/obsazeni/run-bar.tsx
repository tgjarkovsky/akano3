"use client"

import React, { useState } from "react"
import { IconPlayerPlay, IconPlus, IconDownload, IconChevronDown } from "@tabler/icons-react"
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { useGame } from "@/lib/game-context"
import { UNITS, CIRCLES } from "@/lib/data"
import { buildStandingsCsv } from "@/lib/standings-csv"
import { downloadText } from "@/lib/download"
import type { RunSummary } from "@/lib/types"

// Hlavička obsazení: který běh se upravuje, přepnutí, nový běh, export.

export function RunBar() {
  const { runs, activeRunId, setActiveRun, createRun, characters, teams } = useGame()
  const [open, setOpen] = useState(false)
  const [newName, setNewName] = useState("")
  const [creating, setCreating] = useState(false)
  const [confirmRun, setConfirmRun] = useState<RunSummary | null>(null)
  const active = runs.find(r => r.id === activeRunId)

  const create = async () => {
    if (!newName.trim()) return
    setCreating(true)
    await createRun(newName.trim())
    setNewName("")
    setCreating(false)
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
                <span>
                  <span style={{ fontWeight: 700, color: "var(--c-text)" }}>{r.name}</span>
                  <span style={{ fontSize: "0.75rem", color: "var(--c-text-faint)", marginLeft: 8 }}>
                    #{r.id} · {r.createdAt.toLocaleDateString("cs-CZ")}
                  </span>
                </span>
                {r.isActive
                  ? <span style={{ fontSize: "0.75rem", color: "var(--c-success)", fontWeight: 700 }}>aktivní</span>
                  : <button style={btn} onClick={() => setConfirmRun(r)}><IconPlayerPlay size={13} /> Aktivovat</button>}
              </li>
            ))}
          </ul>
          <form onSubmit={e => { e.preventDefault(); create() }} style={{ display: "flex", gap: 8 }}>
            <label style={{ flex: 1 }}>
              <span className="sr-only">Název nového běhu</span>
              <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Běh 3"
                style={{
                  width: "100%", boxSizing: "border-box", minHeight: 36, padding: "0 10px",
                  backgroundColor: "var(--c-input)", border: "1px solid var(--c-input-border)", borderRadius: 6,
                  color: "var(--c-text)", fontSize: "0.85rem",
                }} />
            </label>
            <button type="submit" disabled={creating || !newName.trim()} style={{ ...btn, opacity: creating || !newName.trim() ? 0.5 : 1 }}>
              <IconPlus size={14} /> Nový běh
            </button>
          </form>
          <p style={{ fontSize: "0.75rem", color: "var(--c-text-faint)", margin: "8px 0 0", lineHeight: 1.45 }}>
            Nový běh převezme celé obsazení aktivního běhu (jednotky, specializace, původy, kruhy). Body, kaichi a alarm začínají od nuly.
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
