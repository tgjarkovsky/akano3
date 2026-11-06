"use client"

import React, { useCallback, useEffect, useMemo, useState } from "react"
import { IconCopy, IconEye, IconLink, IconPrinter, IconRefresh, IconWorld, IconWorldOff, IconExternalLink } from "@tabler/icons-react"
import { useGame } from "@/lib/game-context"
import { adminFetch, getOrganizer } from "@/lib/admin-client"
import { TEAMS } from "@/lib/data"
import { DOC_PLAYERS } from "@/lib/doc-ids"
import type { SpisOverview } from "@/lib/spis-store"

// Příprava → Spisy: tajné odkazy postav pro jeden běh, zveřejnění a tisk.
// Odkaz platí jen pro svůj běh; dokud běh není zveřejněný, ukáže „Spis se připravuje“.

export type PrintJob = { runId: number; characterId: string | null }

const linkOf = (token: string) => `${window.location.origin}/spis/${token}`

export function SpisyPanel({ onPrint }: { onPrint: (job: PrintJob) => void }) {
  const { runs, activeRunId, addToast } = useGame()
  const [runId, setRunId] = useState<number | null>(activeRunId ?? null)
  const [data, setData] = useState<SpisOverview | null>(null)
  const [error, setError] = useState("")
  const [busy, setBusy] = useState(false)

  useEffect(() => { if (runId === null && activeRunId) setRunId(activeRunId) }, [activeRunId, runId])

  const load = useCallback(async (id: number) => {
    setError("")
    try {
      const res = await adminFetch(`/api/priprava/spisy?run=${id}`)
      if (!res.ok) { setError(await res.text() || `Načtení selhalo (${res.status})`); return }
      setData(await res.json())
    } catch {
      setError("Chyba sítě, spisy se nenačetly.")
    }
  }, [])

  useEffect(() => { if (runId) { setData(null); load(runId) } }, [runId, load])

  const act = async (body: Record<string, unknown>) => {
    if (!runId) return
    setBusy(true); setError("")
    try {
      const res = await adminFetch("/api/priprava/spisy", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...body, runId, by: getOrganizer() }),
      })
      if (!res.ok) { setError(await res.text() || `Akce selhala (${res.status})`); return }
      setData(await res.json())
    } catch {
      setError("Chyba sítě, akce neproběhla.")
    } finally {
      setBusy(false)
    }
  }

  const rows = useMemo(() => (data?.rows ?? []).map(r => {
    const c = DOC_PLAYERS.find(p => p.id === r.characterId)!
    const team = TEAMS.find(t => t.memberIds.includes(r.characterId))
    return { ...r, name: c.name, nickname: c.nickname, team: team?.name ?? "" }
  }), [data])

  const missing = rows.filter(r => !r.token).length
  const notApproved = rows.reduce((s, r) => s + r.notApproved, 0)
  const published = !!data?.publishedAt

  const copy = async (text: string, what: string) => {
    try { await navigator.clipboard.writeText(text); addToast(`${what} zkopírováno`, "success") }
    catch { addToast("Kopírování se nepovedlo", "error") }
  }
  const copyAll = () => copy(
    ["Postava\tTým\tOdkaz", ...rows.filter(r => r.token).map(r => `${r.name}\t${r.team}\t${linkOf(r.token!)}`)].join("\n"),
    "Odkazy",
  )

  const publish = () => {
    if (!published) {
      if (missing > 0 && !window.confirm(`${missing} postav ještě nemá odkaz. Zveřejnit i tak?`)) return
      if (notApproved > 0 && !window.confirm(`Ve spisech je ${notApproved} neschválených textů. Hráči je uvidí. Zveřejnit i tak?`)) return
    }
    act({ action: published ? "unpublish" : "publish" })
  }

  const regenerate = (id: string, name: string) => {
    if (!window.confirm(`Vytvořit pro postavu ${name} nový odkaz? Starý přestane fungovat.`)) return
    act({ action: "regenerate", characterId: id })
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, maxWidth: 1100 }}>
      <p style={{ margin: 0, color: "var(--c-text-muted)", fontSize: "0.92rem", lineHeight: 1.55, maxWidth: 760 }}>
        Každá postava má pro každý běh vlastní tajný odkaz na svůj spis. Hráči ho pošli, spis si přes něj přečte
        a vytiskne. Dokud běh nezveřejníš, odkaz ukazuje jen „Spis se připravuje“.
      </p>

      <div className="spisy-bar">
        <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: "0.75rem", color: "var(--c-text-muted)" }}>
          Běh
          <select value={runId ?? ""} onChange={e => setRunId(Number(e.target.value))} className="spisy-select">
            {runs.map(r => <option key={r.id} value={r.id}>{r.name}{r.isActive ? " (aktivní)" : ""}</option>)}
          </select>
        </label>
        {data && (
          <div className="spisy-status" data-on={published ? "true" : undefined}>
            {published ? <IconWorld size={18} /> : <IconWorldOff size={18} />}
            <span>
              <b>{published ? "Zveřejněno" : "Nezveřejněno"}</b>
              {published && data.publishedAt && (
                <span style={{ color: "var(--c-text-muted)" }}>
                  {" "}· {new Date(data.publishedAt).toLocaleString("cs-CZ", { day: "numeric", month: "numeric", hour: "2-digit", minute: "2-digit" })}
                  {data.publishedBy ? ` · ${data.publishedBy}` : ""}
                </span>
              )}
            </span>
            <button className={published ? "tool-btn" : "tool-btn tool-btn-primary"} disabled={busy} onClick={publish}>
              {published ? "Skrýt spisy" : "Zveřejnit spisy"}
            </button>
          </div>
        )}
      </div>

      {error && <p role="alert" className="conflict" style={{ margin: 0 }}>{error}</p>}

      {data && (
        <>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {missing > 0 && (
              <button className="tool-btn tool-btn-primary" disabled={busy} onClick={() => act({ action: "create-links" })}>
                <IconLink size={15} /> Vytvořit odkazy ({missing})
              </button>
            )}
            <button className="tool-btn" disabled={rows.every(r => !r.token)} onClick={copyAll}>
              <IconCopy size={15} /> Kopírovat všechny odkazy
            </button>
            <button className="tool-btn" onClick={() => runId && onPrint({ runId, characterId: null })}>
              <IconPrinter size={15} /> Tisk celého běhu
            </button>
            {notApproved > 0 && (
              <span style={{ alignSelf: "center", fontSize: "0.82rem", color: "var(--c-text-muted)" }}>
                {notApproved} textů ve spisech ještě není schválených
              </span>
            )}
          </div>

          <div className="spisy-table-wrap">
            <table className="spisy-table">
              <thead>
                <tr><th>Postava</th><th>Tým</th><th>Texty</th><th>Odkaz</th><th aria-label="Akce" /></tr>
              </thead>
              <tbody>
                {rows.map(r => (
                  <tr key={r.characterId}>
                    <td>
                      <span style={{ fontWeight: 700 }}>{r.name}</span>
                      {r.nickname && <span style={{ color: "var(--c-text-faint)", fontSize: "0.8rem", marginLeft: 6 }}>{r.nickname}</span>}
                    </td>
                    <td style={{ color: "var(--c-text-muted)" }}>{r.team}</td>
                    <td>
                      {r.blocks === 0
                        ? <span style={{ color: "var(--c-text-faint)" }}>bez textů</span>
                        : <>{r.blocks}{r.notApproved > 0 && <span style={{ color: "var(--c-text-muted)" }}> · {r.notApproved} neschv.</span>}</>}
                    </td>
                    <td>
                      {r.token ? (
                        <span style={{ display: "inline-flex", gap: 4, alignItems: "center" }}>
                          <code className="spisy-code">…{r.token.slice(-6)}</code>
                          <button className="icon-btn" title="Kopírovat odkaz" aria-label={`Kopírovat odkaz ${r.name}`} onClick={() => copy(linkOf(r.token!), "Odkaz")}><IconCopy size={15} /></button>
                          <a className="icon-btn" title="Otevřít jako hráč" aria-label={`Otevřít spis ${r.name} jako hráč`} href={`/spis/${r.token}`} target="_blank" rel="noreferrer"><IconExternalLink size={15} /></a>
                          <button className="icon-btn" title="Nový odkaz" aria-label={`Nový odkaz ${r.name}`} disabled={busy} onClick={() => regenerate(r.characterId, r.name)}><IconRefresh size={15} /></button>
                        </span>
                      ) : <span style={{ color: "var(--c-text-faint)" }}>není</span>}
                    </td>
                    <td style={{ textAlign: "right" }}>
                      <button className="tool-btn" onClick={() => runId && onPrint({ runId, characterId: r.characterId })}>
                        <IconEye size={15} /> Náhled
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
      {!data && !error && <p style={{ color: "var(--c-text-muted)" }}>Načítám…</p>}
    </div>
  )
}
