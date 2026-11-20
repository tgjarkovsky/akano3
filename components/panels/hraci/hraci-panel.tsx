"use client"

import React, { useCallback, useEffect, useMemo, useState } from "react"
import { IconDownload, IconMail, IconWorld, IconWorldOff, IconPhoto } from "@tabler/icons-react"
import { useGame } from "@/lib/game-context"
import { adminFetch, getOrganizer } from "@/lib/admin-client"
import { downloadText } from "@/lib/download"
import { CHARACTERS } from "@/lib/data"
import { MAIL_TEMPLATES } from "@/lib/mail-templates"
import { missingText, playerName, statusLabel } from "@/lib/cast"
import type { Roster, RosterRow } from "@/lib/cast-store"

// Příprava → Hráči: soupiska jednoho běhu (přijatí a náhradníci z Přihlášek),
// kdo hraje kterou postavu (obsazuje se v Obsazení), platba, fotka a maily
// „oznámení o přijetí“ a „upomínka“ rozesílané ručně vybraným hráčům.

type Filter = "all" | "unpaid" | "nophoto" | "uncast"
const FILTERS: { value: Filter; label: string; test: (r: RosterRow) => boolean }[] = [
  { value: "all", label: "Všichni", test: () => true },
  { value: "unpaid", label: "Nezaplaceno", test: r => r.status === "accepted" && !r.paidAt },
  { value: "nophoto", label: "Bez fotky", test: r => r.status === "accepted" && !r.photoAt },
  { value: "uncast", label: "Bez postavy", test: r => r.status === "accepted" && !r.characterId },
]

const MAILS = [
  { id: "obsazeni-prijeti", short: "přijetí", action: "Poslat oznámení o přijetí" },
  { id: "upominka", short: "upomínka", action: "Poslat upomínku" },
] as const

const characterName = (id: string | null) => id ? CHARACTERS.find(c => c.id === id)?.name ?? id : ""
const day = (iso: string) => new Date(iso).toLocaleDateString("cs-CZ", { day: "numeric", month: "numeric" })
const today = () => new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Prague" })

export function HraciPanel() {
  const { runs, activeRunId, addToast } = useGame()
  const [runId, setRunId] = useState<number | null>(activeRunId ?? null)
  const [data, setData] = useState<Roster | null>(null)
  const [error, setError] = useState("")
  const [filter, setFilter] = useState<Filter>("all")
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [busy, setBusy] = useState<string | null>(null)

  useEffect(() => { if (runId === null && activeRunId) setRunId(activeRunId) }, [activeRunId, runId])

  const load = useCallback(async (id: number) => {
    setError("")
    try {
      const res = await adminFetch(`/api/priprava/hraci?run=${id}`)
      if (!res.ok) { setError(await res.text() || `Načtení selhalo (${res.status})`); return }
      setData(await res.json())
    } catch {
      setError("Chyba sítě, soupiska se nenačetla.")
    }
  }, [])
  useEffect(() => { if (runId) { setData(null); setSelected(new Set()); load(runId) } }, [runId, load])

  const rows = useMemo(() => data?.rows ?? [], [data])
  const shown = rows.filter(FILTERS.find(f => f.value === filter)!.test)
  const accepted = rows.filter(r => r.status === "accepted")

  const patch = (id: number, change: Partial<RosterRow>) =>
    setData(d => d && { ...d, rows: d.rows.map(r => r.id === id ? { ...r, ...change } : r) })

  const savePayment = async (r: RosterRow, paidAt: string | null, paymentNote: string | null) => {
    const before = { paidAt: r.paidAt, paymentNote: r.paymentNote }
    patch(r.id, { paidAt, paymentNote })
    try {
      const res = await adminFetch(`/api/priprava/prihlasky/${r.id}`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ paidAt, paymentNote }),
      })
      if (!res.ok) throw new Error(await res.text())
    } catch (e) {
      patch(r.id, before)
      addToast((e as Error).message || "Platba se neuložila", "error")
    }
  }

  const toggle = (id: number) => setSelected(s => {
    const n = new Set(s)
    if (n.has(id)) n.delete(id); else n.add(id)
    return n
  })
  const allShownSelected = shown.length > 0 && shown.every(r => selected.has(r.id))
  const toggleAll = () => setSelected(allShownSelected ? new Set() : new Set(shown.map(r => r.id)))
  const chosen = rows.filter(r => selected.has(r.id))

  const sendMail = async (templateId: string, label: string) => {
    if (!runId || chosen.length === 0) return
    const targets = templateId === "upominka" ? chosen.filter(r => missingText({ paid: !!r.paidAt, photo: !!r.photoAt })) : chosen
    const skipped = chosen.length - targets.length
    if (targets.length === 0) { addToast("Vybraným hráčům nic nechybí, upomínka se neposílá.", "info"); return }
    const notCast = targets.filter(r => r.status !== "accepted" || (templateId === "obsazeni-prijeti" && !r.characterId)).length
    const lines = [
      `${label}: ${targets.length} ${targets.length === 1 ? "hráči" : "hráčům"}.`,
      skipped ? `${skipped} vybraných nic nedluží, těm nepůjde.` : "",
      notCast ? `${notCast} z nich ${templateId === "upominka" ? "není přijatých" : "nemá postavu nebo není přijatých"}, těm mail nepůjde.` : "",
      !data?.publishedAt ? "Obsazení běhu ještě není zveřejněné, hráči na odkazu postavu neuvidí." : "",
    ].filter(Boolean)
    if (!window.confirm(lines.join("\n"))) return
    setBusy(templateId)
    try {
      const res = await adminFetch("/api/priprava/hraci/mail", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ templateId, prihlaskaIds: targets.map(r => r.id), by: getOrganizer() }),
      })
      if (!res.ok) throw new Error(await res.text())
      const out = await res.json() as { sent: number; skipped: number; failed: number }
      addToast(`Odesláno ${out.sent}${out.skipped ? `, vynecháno ${out.skipped}` : ""}${out.failed ? `, selhalo ${out.failed}` : ""}`, out.failed ? "error" : "success")
      setSelected(new Set())
      await load(runId)
    } catch (e) {
      addToast((e as Error).message || "Maily se nepodařilo odeslat", "error")
    } finally {
      setBusy(null)
    }
  }

  const exportCsv = () => {
    const esc = (v: string) => /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v
    const lines = [
      ["Jméno", "Přezdívka", "E-mail", "Telefon", "Stav", "Postava", "Zaplaceno", "Poznámka k platbě", "Fotka"],
      ...rows.map(r => [
        `${r.data.firstName} ${r.data.lastName}`, r.data.nickname, r.data.email, r.data.phone, statusLabel(r.status),
        characterName(r.characterId), r.paidAt ?? "", r.paymentNote ?? "", r.photoAt ? "ano" : "ne",
      ]),
    ]
    downloadText(`hraci-${(data?.runName ?? "beh").replace(/[^\p{L}\p{N}]+/gu, "-")}.csv`, "﻿" + lines.map(l => l.map(esc).join(",")).join("\n"))
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, maxWidth: 1200 }}>
      <p style={{ margin: 0, color: "var(--c-text-muted)", fontSize: "0.92rem", lineHeight: 1.55, maxWidth: 780 }}>
        Hráči běhu: přijatí a náhradníci z Přihlášek. Postavy se jim přidělují v Obsazení. Tady se hlídá platba a fotka
        a posílají se maily. Hráč svou postavu a stav platby uvidí a fotku nahraje na odkazu své přihlášky, až se obsazení
        běhu zveřejní.
      </p>

      <div className="spisy-bar">
        <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: "0.75rem", color: "var(--c-text-muted)" }}>
          Běh
          <select value={runId ?? ""} onChange={e => setRunId(Number(e.target.value))} className="spisy-select">
            {runs.map(r => <option key={r.id} value={r.id}>{r.name}{r.isActive ? " (aktivní)" : ""}</option>)}
          </select>
        </label>
        {data && (
          <div className="spisy-status" data-on={data.publishedAt ? "true" : undefined}>
            {data.publishedAt ? <IconWorld size={18} /> : <IconWorldOff size={18} />}
            <span>
              <b>{data.publishedAt ? "Obsazení zveřejněno" : "Obsazení nezveřejněno"}</b>
              <span style={{ color: "var(--c-text-muted)" }}> · {data.publishedAt ? day(data.publishedAt) : "zveřejňuje se v Obsazení"}</span>
            </span>
          </div>
        )}
      </div>

      {error && <p role="alert" className="conflict" style={{ margin: 0 }}>{error}</p>}
      {!data && !error && <p style={{ color: "var(--c-text-muted)" }}>Načítám…</p>}

      {data && (
        <>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }} role="group" aria-label="Filtr">
            {FILTERS.map(f => (
              <button key={f.value} className={filter === f.value ? "filter-chip filter-chip-on" : "filter-chip"} aria-pressed={filter === f.value}
                onClick={() => setFilter(f.value)}>
                {f.label} <span style={{ opacity: 0.7 }}>{rows.filter(f.test).length}</span>
              </button>
            ))}
            <span style={{ fontSize: "0.82rem", color: "var(--c-text-muted)", marginLeft: 4 }}>
              {accepted.length} přijatých · zaplaceno {accepted.filter(r => r.paidAt).length} · s fotkou {accepted.filter(r => r.photoAt).length}
            </span>
          </div>

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            {MAILS.map(m => (
              <button key={m.id} className="tool-btn" disabled={chosen.length === 0 || busy !== null} onClick={() => sendMail(m.id, m.action)}>
                <IconMail size={15} /> {busy === m.id ? "Posílám…" : `${m.action}${chosen.length ? ` (${chosen.length})` : ""}`}
              </button>
            ))}
            <button className="tool-btn" disabled={rows.length === 0} onClick={exportCsv}><IconDownload size={15} /> Stáhnout CSV</button>
            <span style={{ fontSize: "0.78rem", color: "var(--c-text-faint)" }}>Texty mailů se upravují v E-mailech.</span>
          </div>

          {rows.length === 0
            ? <p style={{ color: "var(--c-text-muted)" }}>Na tenhle běh zatím nikdo není přijatý. Stav a běh se nastavuje v Přihláškách.</p>
            : (
              <div className="spisy-table-wrap">
                <table className="spisy-table hraci-table">
                  <thead>
                    <tr>
                      <th><input type="checkbox" checked={allShownSelected} onChange={toggleAll} aria-label="Vybrat všechny zobrazené" /></th>
                      <th>Hráč</th><th>Postava</th><th>Fotka</th><th>Platba</th><th>Maily</th>
                    </tr>
                  </thead>
                  <tbody>
                    {shown.map(r => (
                      <tr key={r.id} data-muted={r.status !== "accepted" ? "true" : undefined}>
                        <td><input type="checkbox" checked={selected.has(r.id)} onChange={() => toggle(r.id)} aria-label={`Vybrat ${playerName(r.data)}`} /></td>
                        <td>
                          <span style={{ fontWeight: 700 }}>{playerName(r.data)}</span>
                          {r.status !== "accepted" && <span className="hraci-badge">{statusLabel(r.status)}{r.status === "substitute" && r.substituteRank !== null ? ` č. ${r.substituteRank}` : ""}</span>}
                          <span style={{ display: "block", fontSize: "0.78rem", color: "var(--c-text-muted)" }}>{r.data.email}</span>
                        </td>
                        <td>{r.characterId ? characterName(r.characterId) : <span style={{ color: "var(--c-text-faint)" }}>—</span>}</td>
                        <td>{r.photoAt ? <AdminPhoto id={r.id} version={r.photoAt} name={playerName(r.data)} /> : <span style={{ color: "var(--c-text-faint)" }}>—</span>}</td>
                        <td><Payment row={r} onSave={(paidAt, note) => savePayment(r, paidAt, note)} /></td>
                        <td style={{ fontSize: "0.78rem", color: "var(--c-text-muted)" }}>
                          {r.mails.length === 0 ? "—" : r.mails.map((m, i) => (
                            <span key={i} style={{ display: "block" }} title={MAIL_TEMPLATES.find(t => t.id === m.templateId)?.label}>
                              {MAILS.find(x => x.id === m.templateId)?.short ?? (m.templateId === "neprijeti" ? "nepřijetí" : m.templateId)} {day(m.sentAt)}
                            </span>
                          ))}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          {rows.length > 0 && shown.length === 0 && <p style={{ color: "var(--c-text-muted)", margin: 0 }}>Filtru nikdo neodpovídá.</p>}
        </>
      )}
    </div>
  )
}

function Payment({ row, onSave }: { row: RosterRow; onSave: (paidAt: string | null, note: string | null) => void }) {
  const [note, setNote] = useState(row.paymentNote ?? "")
  useEffect(() => setNote(row.paymentNote ?? ""), [row.paymentNote])
  const paid = !!row.paidAt
  const saveNote = () => { if ((note.trim() || null) !== row.paymentNote) onSave(row.paidAt, note.trim() || null) }
  return (
    <span style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
      <label style={{ display: "inline-flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
        <input type="checkbox" checked={paid} onChange={() => onSave(paid ? null : today(), row.paymentNote)} />
        <span style={{ color: paid ? "var(--c-success)" : "var(--c-text-muted)", fontWeight: paid ? 700 : 400 }}>{paid ? "Zaplaceno" : "Nezaplaceno"}</span>
      </label>
      {paid && (
        <input type="date" value={row.paidAt ?? ""} aria-label="Datum platby" className="hraci-input" style={{ width: 140 }}
          onChange={e => { if (e.target.value) onSave(e.target.value, row.paymentNote) }} />
      )}
      <input value={note} onChange={e => setNote(e.target.value)} onBlur={saveNote} onKeyDown={e => { if (e.key === "Enter") (e.target as HTMLInputElement).blur() }}
        placeholder="Poznámka" aria-label="Poznámka k platbě" className="hraci-input" style={{ width: 150 }} maxLength={500} />
    </span>
  )
}

/** Náhled fotky: obrázek jde přes adminFetch (heslo v hlavičce), proto přes blob. */
function AdminPhoto({ id, version, name }: { id: number; version: string; name: string }) {
  const [url, setUrl] = useState<string | null>(null)
  useEffect(() => {
    let revoked = false, made: string | null = null
    adminFetch(`/api/priprava/foto/${id}?v=${encodeURIComponent(version)}`)
      .then(r => r.ok ? r.blob() : null)
      .then(b => { if (b && !revoked) { made = URL.createObjectURL(b); setUrl(made) } })
      .catch(() => {})
    return () => { revoked = true; if (made) URL.revokeObjectURL(made) }
  }, [id, version])
  if (!url) return <IconPhoto size={18} color="var(--c-text-faint)" aria-label="Fotka se načítá" />
  return (
    <a href={url} target="_blank" rel="noreferrer" title={`Fotka: ${name}`}>
      {/* eslint-disable-next-line @next/next/no-img-element -- blob z adminFetch, next/image ho neumí */}
      <img src={url} alt={`Fotka: ${name}`} className="hraci-photo" />
    </a>
  )
}
