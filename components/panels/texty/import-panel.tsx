"use client"

import React, { useCallback, useEffect, useMemo, useState } from "react"
import { IconArrowLeft, IconUpload, IconFileImport, IconChevronDown, IconCheck, IconSparkles, IconTrash } from "@tabler/icons-react"
import { adminFetch, getOrganizer } from "@/lib/admin-client"
import { DOC_FIELDS, docKey, type DocEntityType } from "@/lib/doc-fields"
import { parseImport, type ImportPayload, type ImportRole } from "@/lib/doc-validation"
import { UNITS } from "@/lib/data"
import { DOC_IDS } from "@/lib/doc-ids"
import { WikiRenderer } from "@/components/shared/wiki-renderer"
import { buildEntities, useTexty } from "./texty-data"

// Import textů ze souboru (převod Google dokumentu „Jádra + Týmy“) nebo z návrhu,
// který poslal Claude přes token importu (scripts/akano-mcp.mjs, lib/import-drafts.ts).
// Ukáže, co se vyplní a co přepíše, a nechá vybrat entity, které se mají importovat.

type Result = { created: number; updated: number; unchanged: number; genders: number; roles: number }

type Draft = {
  id: number; title: string; source: string | null; notes: string | null
  payload: unknown; status: "pending" | "applied" | "discarded"
  createdBy: string | null; createdAt: string; resolvedBy: string | null
}

/** Návrhy importu ze serveru; pending = čekající na schválení. */
export function useDrafts() {
  const [drafts, setDrafts] = useState<Draft[]>([])
  const reload = useCallback(async () => {
    try {
      const res = await adminFetch("/api/priprava/drafts")
      if (res.ok) setDrafts(await res.json())
    } catch { /* bez sítě se návrhy jen neukážou */ }
  }, [])
  useEffect(() => { reload() }, [reload])
  return { drafts, pending: drafts.filter(d => d.status === "pending"), reload }
}

const when = (iso: string) => new Date(iso).toLocaleString("cs-CZ", { day: "numeric", month: "numeric", hour: "2-digit", minute: "2-digit" })

export function ImportPanel({ onBack }: { onBack: () => void }) {
  const { meta, roles, genders: currentGenders, reload } = useTexty()
  const [fileName, setFileName] = useState("")
  const [payload, setPayload] = useState<ImportPayload | null>(null)
  const [source, setSource] = useState<string>("")
  const [error, setError] = useState("")
  const [excluded, setExcluded] = useState<Set<string>>(new Set())
  const [open, setOpen] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<Result | null>(null)
  const { pending, reload: reloadDrafts } = useDrafts()
  const [draft, setDraft] = useState<Draft | null>(null)

  const openDraft = (d: Draft) => {
    setError(""); setResult(null); setPayload(null); setExcluded(new Set()); setFileName(""); setDraft(null)
    const parsed = parseImport(d.payload, DOC_IDS)
    if (!parsed.ok) { setError(`Návrh „${d.title}“ nejde načíst: ${parsed.error}`); return }
    setDraft(d); setPayload(parsed.value); setSource(d.source ?? "")
  }

  const discardDraft = async (d: Draft) => {
    if (!window.confirm(`Zahodit návrh „${d.title}“? Nic z něj se neuloží.`)) return
    const res = await adminFetch("/api/priprava/drafts", {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: d.id, status: "discarded", by: getOrganizer() }),
    }).catch(() => null)
    if (!res?.ok) { setError("Návrh se nepodařilo zahodit."); return }
    if (draft?.id === d.id) { setDraft(null); setPayload(null) }
    await reloadDrafts()
  }

  const readFile = async (file: File) => {
    setError(""); setResult(null); setPayload(null); setExcluded(new Set()); setFileName(file.name); setDraft(null)
    try {
      const raw = JSON.parse(await file.text())
      const parsed = parseImport(raw, DOC_IDS)
      if (!parsed.ok) { setError(parsed.error); return }
      setPayload(parsed.value)
      setSource(typeof raw.source === "string" ? raw.source : "")
    } catch {
      setError("Soubor není platný JSON.")
    }
  }

  // Seskupení podle entit v pořadí jako v matici.
  const groups = useMemo(() => {
    if (!payload) return []
    const types: DocEntityType[] = ["character", "team", "unit", "circle", "trait"]
    const base = types.flatMap(type => buildEntities(type, roles).map(e => {
      const items = payload.texts.filter(t => t.entityType === type && t.entityId === e.id)
      const gender = type === "character" ? payload.genders.find(g => g.characterId === e.id)?.gender : undefined
      return { key: `${type}:${e.id}`, entity: e, items, gender, role: undefined as ImportRole | undefined }
    })).filter(g => g.items.length > 0 || g.gender)
    // Role se poznají podle jednotky a klíče; nová role ještě nemá id.
    const roleGroups = payload.roles.map(r => {
      const existing = roles.find(x => x.unitId === r.unitId && x.key === r.key)
      const unit = UNITS.find(u => u.id === r.unitId)?.name ?? r.unitId
      return {
        key: `role:${r.unitId}:${r.key}`,
        entity: { type: "role" as const, id: existing ? String(existing.id) : "", name: r.nameM === r.nameF ? r.nameM : `${r.nameM} / ${r.nameF}`,
          group: `${unit} · role · trojice ${existing?.triplet ?? r.triplet}${existing ? "" : " · nová role"}` },
        items: [{ entityType: "role" as const, entityId: existing ? String(existing.id) : "", field: "personal", body: r.body }],
        gender: undefined, role: r,
      }
    })
    return [...base, ...roleGroups]
  }, [payload, roles])

  const kind = (t: { entityType: DocEntityType; entityId: string; field: string }) => {
    if (!t.entityId) return "new"
    const m = meta.get(docKey(t.entityType, t.entityId, t.field))
    return !m || m.length === 0 ? "new" : "overwrite"
  }

  const selected = groups.filter(g => !excluded.has(g.key))
  const selTexts = selected.flatMap(g => g.items)
  const selRoles = selected.flatMap(g => (g.role ? [g.role] : []))
  const overwrites = selTexts.filter(t => kind(t) === "overwrite").length
  const selGenders = selected.filter(g => g.gender).map(g => ({ characterId: g.entity.id, gender: g.gender! }))

  const run = async () => {
    if (!payload) return
    if (overwrites > 0 && !window.confirm(`Import přepíše ${overwrites} existujících textů. Pokračovat?`)) return
    setBusy(true); setError("")
    try {
      const res = await adminFetch("/api/priprava/texts/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ texts: selTexts.filter(t => t.entityType !== "role"), genders: selGenders, roles: selRoles, by: getOrganizer() }),
      })
      if (!res.ok) { setError(await res.text() || `Import selhal (${res.status})`); return }
      setResult(await res.json())
      if (draft) {
        await adminFetch("/api/priprava/drafts", {
          method: "PATCH", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: draft.id, status: "applied", by: getOrganizer() }),
        }).catch(() => null)
        await reloadDrafts()
      }
      await reload()
    } catch {
      setError("Chyba sítě, import neproběhl.")
    } finally {
      setBusy(false)
    }
  }

  const toggle = (key: string) => setExcluded(s => { const n = new Set(s); if (n.has(key)) n.delete(key); else n.add(key); return n })
  const fieldLabel = (type: DocEntityType, field: string) => DOC_FIELDS[type].find(f => f.key === field)?.label ?? field

  return (
    <div style={{ maxWidth: 980 }}>
      <button className="editor-back" onClick={onBack}><IconArrowLeft size={15} /> Přehled textů</button>
      <h2 style={{ fontSize: "1.3rem", fontWeight: 800, color: "var(--c-text)", margin: "4px 0 6px" }}>Import textů</h2>
      <p style={{ color: "var(--c-text-muted)", fontSize: "0.92rem", lineHeight: 1.55, margin: "0 0 16px", maxWidth: 720 }}>
        Nahraj soubor s převedenými texty (JSON). Než se cokoli uloží, uvidíš, co se vyplní a co přepíše, a můžeš jednotlivé
        postavy nebo týmy vynechat. Naimportované texty budou ve stavu <b>rozepsané</b>.
      </p>

      <label className="import-drop">
        <IconUpload size={20} />
        <span>{fileName ? `Soubor: ${fileName}` : "Vybrat soubor .json"}</span>
        <input type="file" accept="application/json,.json" style={{ display: "none" }}
          onChange={e => { const f = e.target.files?.[0]; if (f) readFile(f); e.target.value = "" }} />
      </label>

      {pending.length > 0 && (
        <section className="import-drafts" aria-labelledby="import-drafts-h">
          <h3 id="import-drafts-h"><IconSparkles size={16} /> Návrhy ke schválení</h3>
          <ul>
            {pending.map(d => (
              <li key={d.id} data-active={draft?.id === d.id ? "true" : undefined}>
                <button className="import-draft-open" onClick={() => openDraft(d)}>
                  <span style={{ fontWeight: 700 }}>{d.title}</span>
                  <span className="import-draft-meta">{[d.createdBy, when(d.createdAt), d.source].filter(Boolean).join(" · ")}</span>
                  {d.notes && <span className="import-draft-notes">{d.notes}</span>}
                </button>
                <button className="tool-btn" onClick={() => discardDraft(d)} aria-label={`Zahodit návrh ${d.title}`}><IconTrash size={15} /></button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {error && <p role="alert" className="conflict" style={{ marginTop: 12 }}>{error}</p>}

      {result && (
        <div className="import-result" role="status">
          <IconCheck size={18} /> Hotovo: {result.created} nových, {result.updated} přepsaných, {result.unchanged} beze změny, {result.genders} rodů{result.roles > 0 ? `, ${result.roles} nových rolí` : ""}.
        </div>
      )}

      {payload && !result && (
        <>
          <div className="texty-progress" style={{ marginTop: 16 }}>
            <p style={{ margin: 0, fontWeight: 700, color: "var(--c-text)" }}>
              {draft && <span style={{ fontWeight: 400, color: "var(--c-text-muted)" }}>Návrh „{draft.title}“ · </span>}
              {source && <span style={{ fontWeight: 400, color: "var(--c-text-muted)" }}>{source} · </span>}
              Vybráno {selected.length} z {groups.length} · {selTexts.length} textů
              {overwrites > 0 && <span style={{ color: "var(--destructive)" }}> · přepíše {overwrites}</span>}
              {selGenders.length > 0 && <> · {selGenders.length} rodů</>}
            </p>
            <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
              <button className="tool-btn tool-btn-primary" disabled={busy || selTexts.length + selGenders.length === 0} onClick={run}>
                <IconFileImport size={15} /> {busy ? "Importuji…" : `Importovat ${selTexts.length} textů`}
              </button>
              <button className="tool-btn" onClick={() => setExcluded(new Set())}>Vybrat vše</button>
              <button className="tool-btn" onClick={() => setExcluded(new Set(groups.map(g => g.key)))}>Zrušit výběr</button>
            </div>
          </div>

          <ul className="import-list">
            {groups.map(g => {
              const on = !excluded.has(g.key)
              const isOpen = open === g.key
              const gender = g.gender ? (g.gender === "m" ? "muž" : "žena") : null
              const genderChange = g.gender && currentGenders[g.entity.id] && currentGenders[g.entity.id] !== g.gender
              return (
                <li key={g.key} className="import-item" data-off={on ? undefined : "true"}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <input type="checkbox" checked={on} onChange={() => toggle(g.key)} aria-label={`Importovat ${g.entity.name}`} />
                    <button className="import-name" onClick={() => setOpen(isOpen ? null : g.key)} aria-expanded={isOpen}>
                      <span style={{ fontWeight: 700 }}>{g.entity.name}</span>
                      {g.entity.group && <span style={{ color: "var(--c-text-faint)", fontSize: "0.8rem", marginLeft: 6 }}>{g.entity.group}</span>}
                      <IconChevronDown size={14} style={{ transform: isOpen ? "rotate(180deg)" : undefined, marginLeft: 4 }} />
                    </button>
                  </div>
                  <div className="import-chips">
                    {gender && <span className="import-chip">rod: {gender}{genderChange ? " (změna)" : ""}</span>}
                    {g.items.map(t => (
                      <span key={t.field} className={kind(t) === "overwrite" ? "import-chip import-chip-over" : "import-chip"}
                        title={kind(t) === "overwrite" ? "Přepíše existující text" : "Nové"}>
                        {fieldLabel(t.entityType, t.field)} · {t.body.length.toLocaleString("cs-CZ")} zn.{kind(t) === "overwrite" ? " · přepíše" : ""}
                      </span>
                    ))}
                  </div>
                  {isOpen && (
                    <div className="import-preview theme-paper">
                      {g.items.map(t => (
                        <div key={t.field} className="preview-block">
                          <p style={{ margin: "0 0 6px", fontWeight: 800 }}>{fieldLabel(t.entityType, t.field)}</p>
                          {t.body.trim() ? <WikiRenderer content={t.body} kaichiLevel={8} /> : <p style={{ color: "var(--c-text-faint)", fontStyle: "italic" }}>prázdné</p>}
                        </div>
                      ))}
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        </>
      )}
    </div>
  )
}
