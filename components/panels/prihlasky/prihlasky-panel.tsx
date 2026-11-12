"use client"

import React, { useEffect, useMemo, useState } from "react"
import { IconDownload, IconExternalLink, IconChevronDown, IconChevronRight } from "@tabler/icons-react"
import { adminFetch } from "@/lib/admin-client"
import { downloadText } from "@/lib/download"
import { CHARACTERS, TEAMS, UNITS, CIRCLES } from "@/lib/data"
import { SPECIALIZATION_OPTIONS, ORIGIN_OPTIONS } from "@/lib/setup-options"
import {
  buildPrihlaskyCsv, PREF_KINDS, KIND_LABELS, RUN_CHOICES, SUBSTITUTE_CHOICES, NEWSLETTER_CHOICES, GENDER_CHOICES,
  type PrefKind,
} from "@/lib/prihlaska"
import type { StoredPrihlaska } from "@/lib/prihlaska-store"

// Přihlášky z veřejného formuláře /prihlaska: přehled, detail a export do CSV.
// Obsahují osobní údaje, čte je jen Příprava.

const NAMES: Record<PrefKind | "team", Map<string, string>> = {
  adult: new Map(CHARACTERS.filter(c => c.role === "teacher").map(c => [c.id, c.name])),
  character: new Map(CHARACTERS.map(c => [c.id, c.name])),
  team: new Map(TEAMS.map(t => [t.id, t.name])),
  unit: new Map(UNITS.map(u => [u.id, u.name])),
  circle: new Map(CIRCLES.map(c => [c.id, c.name])),
  specialization: new Map(SPECIALIZATION_OPTIONS.map(o => [o.value, o.label])),
  origin: new Map(ORIGIN_OPTIONS.map(o => [o.value, o.label])),
}
const nameOf = (kind: PrefKind | "team", id: string) => NAMES[kind].get(id) ?? id
const label = (list: readonly { value: string; label: string }[], v: string) => list.find(o => o.value === v)?.label ?? v
const date = (iso: string) => new Date(iso).toLocaleString("cs-CZ", { day: "numeric", month: "numeric", hour: "2-digit", minute: "2-digit" })

export function PrihlaskyPanel() {
  const [rows, setRows] = useState<StoredPrihlaska[] | null>(null)
  const [error, setError] = useState("")
  const [open, setOpen] = useState<number | null>(null)

  useEffect(() => {
    let cancelled = false
    adminFetch("/api/priprava/prihlasky")
      .then(async r => r.ok ? r.json() : Promise.reject(new Error(await r.text())))
      .then(d => { if (!cancelled) setRows(d) })
      .catch(e => { if (!cancelled) setError(e?.message || "Přihlášky se nenačetly.") })
    return () => { cancelled = true }
  }, [])

  const counts = useMemo(() => rows && {
    adult: rows.filter(r => r.data.paths.adult).length,
    team: rows.filter(r => r.data.paths.team).length,
    student: rows.filter(r => r.data.paths.student).length,
  }, [rows])

  const exportCsv = () => {
    if (!rows) return
    const csv = buildPrihlaskyCsv([...rows].reverse().map(r => ({ createdAt: date(r.createdAt), updatedAt: date(r.updatedAt), data: r.data })), nameOf)
    downloadText(`prihlasky-${new Date().toISOString().slice(0, 10)}.csv`, "﻿" + csv)
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, maxWidth: 1100 }}>
      <p style={{ margin: 0, color: "var(--c-text-muted)", fontSize: "0.92rem", lineHeight: 1.55, maxWidth: 760 }}>
        Přihlášky z veřejného formuláře. Hráč po odeslání dostane tajný odkaz a může přihlášku upravovat do konce přihlašování.
        Medailonky ve formuláři se berou z Textů (pole Medailonek a Citlivá témata).
      </p>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <a className="tool-btn" href="/prihlaska" target="_blank" rel="noreferrer"><IconExternalLink size={15} /> Otevřít formulář</a>
        <button className="tool-btn tool-btn-primary" disabled={!rows?.length} onClick={exportCsv}><IconDownload size={15} /> Stáhnout CSV</button>
        {rows && counts && (
          <span style={{ fontSize: "0.82rem", color: "var(--c-text-muted)" }}>
            {rows.length} přihlášek · dospělí {counts.adult} · týmy {counts.team} · studenti {counts.student}
          </span>
        )}
      </div>
      {error && <p role="alert" className="conflict" style={{ margin: 0 }}>{error}</p>}
      {rows && rows.length === 0 && <p style={{ color: "var(--c-text-muted)" }}>Zatím žádná přihláška.</p>}
      {rows && rows.length > 0 && (
        <div className="spisy-table-wrap">
          <table className="spisy-table">
            <thead><tr><th aria-label="Detail" /><th>Hráč</th><th>Běh</th><th>Hlásí se za</th><th>★ Chci moc</th><th>Odesláno</th></tr></thead>
            <tbody>
              {rows.map(r => {
                const d = r.data
                const wants = (["adult", "character"] as const).flatMap(k => Object.entries(d.prefs[k]).filter(([, v]) => v === "yes").map(([id]) => nameOf(k, id)))
                const isOpen = open === r.id
                return (
                  <React.Fragment key={r.id}>
                    <tr>
                      <td><button className="icon-btn" aria-expanded={isOpen} aria-label={`Detail ${d.firstName} ${d.lastName}`} onClick={() => setOpen(isOpen ? null : r.id)}>
                        {isOpen ? <IconChevronDown size={15} /> : <IconChevronRight size={15} />}</button></td>
                      <td><span style={{ fontWeight: 700 }}>{d.firstName} {d.lastName}</span>{d.nickname && <span style={{ color: "var(--c-text-muted)" }}> · {d.nickname}</span>}</td>
                      <td style={{ color: "var(--c-text-muted)" }}>{label(RUN_CHOICES, d.run).split(",")[0]}</td>
                      <td>{[d.paths.adult && "dospělý", d.paths.team && `tým (${Object.keys(d.team.picks).map(t => nameOf("team", t).replace("Tým ", "")).join(", ")})`, d.paths.student && "student"].filter(Boolean).join(", ")}</td>
                      <td>{wants.join(", ") || <span style={{ color: "var(--c-text-faint)" }}>—</span>}</td>
                      <td style={{ color: "var(--c-text-muted)", whiteSpace: "nowrap" }}>{date(r.createdAt)}{r.edits > 0 && ` · upr. ${r.edits}×`}</td>
                    </tr>
                    {isOpen && <tr><td /><td colSpan={5}><Detail p={r} /></td></tr>}
                  </React.Fragment>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
      {!rows && !error && <p style={{ color: "var(--c-text-muted)" }}>Načítám…</p>}
    </div>
  )
}

function Detail({ p: { data: d, updatedAt } }: { p: StoredPrihlaska }) {
  const row = (k: string, v: React.ReactNode) => <div style={{ display: "grid", gridTemplateColumns: "160px 1fr", gap: 12, padding: "4px 0" }}><span style={{ color: "var(--c-text-muted)" }}>{k}</span><span>{v}</span></div>
  return (
    <div style={{ fontSize: "0.88rem", lineHeight: 1.5, padding: "4px 0 10px" }}>
      {row("Kontakt", `${d.email} · ${d.phone}`)}
      {row("Hraje", d.genderPref ? label(GENDER_CHOICES, d.genderPref) : "—")}
      {row("Náhradník", label(SUBSTITUTE_CHOICES, d.substitute))}
      {row("Newsletter", label(NEWSLETTER_CHOICES, d.newsletter))}
      {d.paths.team && row("Tým", <>s: {d.team.mates} · {Object.entries(d.team.picks).map(([t, c]) => `${nameOf("team", t)}: ${nameOf("character", c)}`).join(", ")} · {d.team.solo ? "pojede i bez nich" : "bez nich nejede"}</>)}
      {d.visionImpaired && row("Zrak", "má zrakové postižení (Nakamura)")}
      {PREF_KINDS.map(k => {
        const yes = Object.entries(d.prefs[k]).filter(([, v]) => v === "yes").map(([id]) => nameOf(k, id))
        const no = Object.entries(d.prefs[k]).filter(([, v]) => v === "no").map(([id]) => nameOf(k, id))
        if (!yes.length && !no.length) return null
        return <React.Fragment key={k}>{row(KIND_LABELS[k], <>{yes.length > 0 && <b>★ {yes.join(", ")}</b>}{yes.length > 0 && no.length > 0 && " · "}{no.length > 0 && <s style={{ color: "var(--c-text-muted)" }}>{no.join(", ")}</s>}</>)}</React.Fragment>
      })}
      {d.noteCasting && row("K výběru postavy", d.noteCasting)}
      {d.noteOrg && row("Vzkaz", d.noteOrg)}
      {row("Naposledy upraveno", date(updatedAt))}
    </div>
  )
}
