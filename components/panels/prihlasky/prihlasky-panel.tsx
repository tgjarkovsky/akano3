"use client"

import React, { useEffect, useMemo, useState } from "react"
import { IconDownload, IconExternalLink, IconChevronDown, IconChevronRight, IconMail } from "@tabler/icons-react"
import { adminFetch, getOrganizer } from "@/lib/admin-client"
import { downloadText } from "@/lib/download"
import { CHARACTERS, TEAMS, UNITS, CIRCLES } from "@/lib/data"
import { SPECIALIZATION_OPTIONS, ORIGIN_OPTIONS } from "@/lib/setup-options"
import {
  buildPrihlaskyCsv, PREF_KINDS, KIND_LABELS, RUN_CHOICES, SUBSTITUTE_CHOICES, NEWSLETTER_CHOICES, GENDER_CHOICES,
  type PrefKind,
} from "@/lib/prihlaska"
import type { StoredPrihlaska } from "@/lib/prihlaska-store"
import { useGame } from "@/lib/game-context"
import { CAST_STATUSES, statusNeedsRun, getsRejection, type CastStatus } from "@/lib/cast"

/** Přihláška se stavem a během z Přípravy (GET /api/priprava/prihlasky). */
type Row = StoredPrihlaska & { status: CastStatus; runId: number | null; paidAt: string | null; paymentNote: string | null; rejectionSentAt: string | null }

// Přihlášky z veřejného formuláře /prihlaska: přehled, detail a export do CSV.
// Obsahují osobní údaje, čte je jen Příprava. Tady se přihlášce nastavuje stav
// (Přijat / Náhradník / Nejede) a běh; obsazení na postavy je v Obsazení.

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
  const { runs, activeRunId, addToast } = useGame()
  const [rows, setRows] = useState<Row[] | null>(null)
  const [error, setError] = useState("")
  const [open, setOpen] = useState<number | null>(null)
  const [filter, setFilter] = useState<CastStatus | "all">("all")
  const [busy, setBusy] = useState<number | null>(null)
  const [sending, setSending] = useState(false)

  const setStatus = async (r: Row, status: CastStatus, runId: number | null) => {
    const next = { status, runId: statusNeedsRun(status) ? runId ?? activeRunId : null }
    if (statusNeedsRun(status) && next.runId === null) { addToast("Nejdřív založ běh.", "error"); return }
    setBusy(r.id)
    try {
      const res = await adminFetch(`/api/priprava/prihlasky/${r.id}`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(next),
      })
      if (!res.ok) throw new Error(await res.text())
      setRows(rs => rs && rs.map(x => x.id === r.id ? { ...x, ...next } : x))
    } catch (e) {
      addToast((e as Error).message || "Stav se neuložil.", "error")
    } finally {
      setBusy(null)
    }
  }

  // Mail o nepřijetí jde náhradníkům a odmítnutým, kteří ho ještě nedostali.
  const toReject = rows?.filter(r => getsRejection(r.status) && !r.rejectionSentAt) ?? []
  const sendRejections = async () => {
    const subs = toReject.filter(r => r.status === "substitute").length
    const msg = `Poslat mail o nepřijetí ${toReject.length} ${toReject.length === 1 ? "přihlášce" : "přihláškám"}`
      + ` (náhradníci ${subs}, nejede ${toReject.length - subs})?\nKaždý se dozví, jestli a do kdy ho držíme na náhradnickém seznamu podle své přihlášky.`
    if (!window.confirm(msg)) return
    setSending(true)
    try {
      const res = await adminFetch("/api/priprava/hraci/mail", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ templateId: "neprijeti", prihlaskaIds: toReject.map(r => r.id), by: getOrganizer() }),
      })
      if (!res.ok) throw new Error(await res.text())
      const out = await res.json() as { sent: number; skipped: number; failed: number }
      addToast(`Odesláno ${out.sent}${out.skipped ? `, vynecháno ${out.skipped}` : ""}${out.failed ? `, selhalo ${out.failed}` : ""}`, out.failed ? "error" : "success")
      const fresh = await adminFetch("/api/priprava/prihlasky")
      if (fresh.ok) setRows(await fresh.json())
    } catch (e) {
      addToast((e as Error).message || "Maily se nepodařilo odeslat", "error")
    } finally {
      setSending(false)
    }
  }

  useEffect(() => {
    let cancelled = false
    adminFetch("/api/priprava/prihlasky")
      .then(async r => r.ok ? r.json() : Promise.reject(new Error(await r.text())))
      .then(d => { if (!cancelled) setRows(d) })
      .catch(e => { if (!cancelled) setError(e?.message || "Přihlášky se nenačetly.") })
    return () => { cancelled = true }
  }, [])

  const statusCounts = useMemo(() => {
    const m: Record<string, number> = {}
    for (const r of rows ?? []) m[r.status] = (m[r.status] ?? 0) + 1
    return m
  }, [rows])
  const shown = rows?.filter(r => filter === "all" || r.status === filter) ?? []

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
        <button className="tool-btn" disabled={sending || toReject.length === 0} onClick={sendRejections}
          title="Náhradníkům a přihláškám ve stavu Nejede, které mail ještě nedostaly. Text se upravuje v E-mailech.">
          <IconMail size={15} /> {sending ? "Posílám…" : `Poslat mail o nepřijetí (${toReject.length})`}
        </button>
        {rows && counts && (
          <span style={{ fontSize: "0.82rem", color: "var(--c-text-muted)" }}>
            {rows.length} přihlášek · dospělí {counts.adult} · týmy {counts.team} · studenti {counts.student}
          </span>
        )}
      </div>
      {rows && rows.length > 0 && (
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }} role="group" aria-label="Filtr podle stavu">
          {([{ value: "all", label: "Všechny" }, ...CAST_STATUSES] as const).map(o => (
            <button key={o.value} className={filter === o.value ? "filter-chip filter-chip-on" : "filter-chip"} aria-pressed={filter === o.value} onClick={() => setFilter(o.value)}>
              {o.label} <span style={{ opacity: 0.7 }}>{o.value === "all" ? rows.length : statusCounts[o.value] ?? 0}</span>
            </button>
          ))}
        </div>
      )}
      {error && <p role="alert" className="conflict" style={{ margin: 0 }}>{error}</p>}
      {rows && rows.length === 0 && <p style={{ color: "var(--c-text-muted)" }}>Zatím žádná přihláška.</p>}
      {rows && rows.length > 0 && shown.length === 0 && <p style={{ color: "var(--c-text-muted)" }}>V tomhle stavu žádná přihláška není.</p>}
      {rows && rows.length > 0 && (
        <div className="spisy-table-wrap">
          <table className="spisy-table">
            <thead><tr><th aria-label="Detail" /><th>Hráč</th><th>Stav</th><th>Chce běh</th><th>Hlásí se za</th><th>★ Chci moc</th><th>Odesláno</th></tr></thead>
            <tbody>
              {shown.map(r => {
                const d = r.data
                const wants = (["adult", "character"] as const).flatMap(k => Object.entries(d.prefs[k]).filter(([, v]) => v === "yes").map(([id]) => nameOf(k, id)))
                const isOpen = open === r.id
                return (
                  <React.Fragment key={r.id}>
                    <tr>
                      <td><button className="icon-btn" aria-expanded={isOpen} aria-label={`Detail ${d.firstName} ${d.lastName}`} onClick={() => setOpen(isOpen ? null : r.id)}>
                        {isOpen ? <IconChevronDown size={15} /> : <IconChevronRight size={15} />}</button></td>
                      <td><span style={{ fontWeight: 700 }}>{d.firstName} {d.lastName}</span>{d.nickname && <span style={{ color: "var(--c-text-muted)" }}> · {d.nickname}</span>}</td>
                      <td>
                        <span style={{ display: "inline-flex", gap: 6, whiteSpace: "nowrap" }}>
                          <select className="circle-select" style={{ width: "auto" }} value={r.status} disabled={busy === r.id} aria-label={`Stav ${d.firstName} ${d.lastName}`}
                            onChange={e => setStatus(r, e.target.value as CastStatus, r.runId)}>
                            {CAST_STATUSES.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                          </select>
                          {statusNeedsRun(r.status) && (
                            <select className="circle-select" style={{ width: "auto" }} value={r.runId ?? ""} disabled={busy === r.id} aria-label={`Běh ${d.firstName} ${d.lastName}`}
                              onChange={e => setStatus(r, r.status, Number(e.target.value))}>
                              {r.runId === null && <option value="" disabled>Vybrat běh…</option>}
                              {runs.map(x => <option key={x.id} value={x.id}>{x.name}</option>)}
                            </select>
                          )}
                        </span>
                        {r.rejectionSentAt && getsRejection(r.status) && (
                          <span style={{ display: "block", fontSize: "0.76rem", color: "var(--c-text-muted)", marginTop: 2 }}>
                            mail o nepřijetí {new Date(r.rejectionSentAt).toLocaleDateString("cs-CZ")}
                          </span>
                        )}
                      </td>
                      <td style={{ color: "var(--c-text-muted)" }}>{label(RUN_CHOICES, d.run).split(",")[0]}</td>
                      <td>{[d.paths.adult && "dospělý", d.paths.team && `tým (${Object.keys(d.team.picks).map(t => nameOf("team", t).replace("Tým ", "")).join(", ")})`, d.paths.student && "student"].filter(Boolean).join(", ")}</td>
                      <td>{wants.join(", ") || <span style={{ color: "var(--c-text-faint)" }}>—</span>}</td>
                      <td style={{ color: "var(--c-text-muted)", whiteSpace: "nowrap" }}>{date(r.createdAt)}{r.edits > 0 && ` · upr. ${r.edits}×`}</td>
                    </tr>
                    {isOpen && <tr><td /><td colSpan={6}><Detail p={r} /></td></tr>}
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
