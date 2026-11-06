"use client"

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  IconArrowLeft, IconCheck, IconChecks, IconArrowBackUp, IconEye, IconEyeOff, IconAlertTriangle, IconLoader2,
} from "@tabler/icons-react"
import { adminFetch, getOrganizer } from "@/lib/admin-client"
import { useGame } from "@/lib/game-context"
import { DOC_FIELDS, VISIBILITY_LABELS, type DocEntityType } from "@/lib/doc-fields"
import { statusOf, STATUS_LABELS, type StatusAction } from "@/lib/doc-status"
import type { TextRecord } from "@/lib/docs-store"
import { WikiRenderer } from "@/components/shared/wiki-renderer"
import { Segmented } from "@/components/panels/obsazeni/shared"
import { CATEGORIES, StatusDot, buildEntities, useTexty, type DocEntity } from "./texty-data"
import { RolesEditor } from "./roles-editor"

// Editor textů: vlevo strom entit, uprostřed psaní jednoho pole, vpravo náhled,
// jak to uvidí hráč. Ukládá se samo; souběžnou úpravu hlídá verze záznamu.

const AUTOSAVE_MS = 1500

type Conflict = { field: string; server: TextRecord | null }

const fmtTime = (iso: string | null) => iso
  ? new Date(iso).toLocaleString("cs-CZ", { day: "numeric", month: "numeric", hour: "2-digit", minute: "2-digit" })
  : ""

export function TextEditor({ entityType, entityId, field, onSelect, onBack }: {
  entityType: DocEntityType
  entityId: string
  field: string
  onSelect: (type: DocEntityType, id: string, field: string) => void
  onBack: () => void
}) {
  const { addToast } = useGame()
  const { roles, genders, setGender, putMeta, entityStatus, meta } = useTexty()
  const fields = DOC_FIELDS[entityType]
  const entities = useMemo(() => buildEntities(entityType, roles), [entityType, roles])
  const entity = entities.find(e => e.id === entityId)

  const [records, setRecords] = useState<Record<string, TextRecord | undefined>>({})
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const [dirty, setDirty] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [conflict, setConflict] = useState<Conflict | null>(null)
  const [keepStatus, setKeepStatus] = useState(false)
  const [showPreview, setShowPreview] = useState(false)
  const [acting, setActing] = useState<StatusAction | null>(null)

  // Refs drží poslední hodnoty pro ukládání z časovače a při přepnutí.
  const recordsRef = useRef(records); recordsRef.current = records
  const draftsRef = useRef(drafts); draftsRef.current = drafts
  const dirtyRef = useRef(dirty); dirtyRef.current = dirty
  const keepRef = useRef(keepStatus); keepRef.current = keepStatus
  const conflictRef = useRef(conflict); conflictRef.current = conflict

  // Načtení textů entity
  useEffect(() => {
    let cancelled = false
    setLoading(true); setRecords({}); setDrafts({}); setDirty(new Set()); setConflict(null)
    adminFetch(`/api/priprava/texts?entityType=${entityType}&entityId=${encodeURIComponent(entityId)}`)
      .then(r => r.ok ? r.json() : Promise.reject(r.status))
      .then((rows: TextRecord[]) => {
        if (cancelled) return
        const recs: Record<string, TextRecord> = {}
        const d: Record<string, string> = {}
        for (const r of rows) { recs[r.field] = r; d[r.field] = r.body }
        setRecords(recs); setDrafts(d)
      })
      .catch(() => { if (!cancelled) addToast("Texty se nepodařilo načíst", "error") })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [entityType, entityId, addToast])

  useEffect(() => { setKeepStatus(false) }, [field, entityId])
  // Nová entita začíná nahoře (z dolní části editoru rolí by jinak zůstal posun).
  useEffect(() => { window.scrollTo({ top: 0 }) }, [entityType, entityId])

  // Vrací uložený záznam, „unchanged“ když nebylo co ukládat, nebo null při chybě/konfliktu.
  const save = useCallback(async (f: string): Promise<TextRecord | "unchanged" | null> => {
    if (!dirtyRef.current.has(f)) return "unchanged"
    if (conflictRef.current?.field === f) return null
    const rec = recordsRef.current[f]
    const body = draftsRef.current[f] ?? ""
    setSaving(true)
    try {
      const res = await adminFetch("/api/priprava/texts", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entityType, entityId, field: f, body,
          expectedVersion: rec?.version ?? null, keepStatus: keepRef.current, by: getOrganizer(),
        }),
      })
      if (res.status === 409) {
        const { conflict: server } = await res.json() as { conflict: TextRecord | null }
        setConflict({ field: f, server })
        return null
      }
      if (!res.ok) { addToast(`Text se nepodařilo uložit (${res.status})`, "error"); return null }
      const saved = await res.json() as TextRecord
      setRecords(r => ({ ...r, [f]: saved }))
      putMeta(saved)
      // Psalo se i během ukládání? Pak zůstává neuložené.
      if (draftsRef.current[f] === body) setDirty(d => { const n = new Set(d); n.delete(f); return n })
      return saved
    } catch {
      addToast("Chyba sítě, text není uložený", "error")
      return null
    } finally {
      setSaving(false)
    }
  }, [entityType, entityId, addToast, putMeta])

  const flushAll = useCallback(async () => {
    for (const f of [...dirtyRef.current]) if ((await save(f)) === null) return false
    return true
  }, [save])

  // Automatické ukládání po chvíli bez psaní
  useEffect(() => {
    if (!dirty.has(field)) return
    const t = setTimeout(() => { save(field) }, AUTOSAVE_MS)
    return () => clearTimeout(t)
  }, [drafts, dirty, field, save])

  // Zavření stránky s neuloženým textem
  useEffect(() => {
    const onUnload = (e: BeforeUnloadEvent) => { if (dirtyRef.current.size > 0) e.preventDefault() }
    window.addEventListener("beforeunload", onUnload)
    return () => window.removeEventListener("beforeunload", onUnload)
  }, [])

  const go = async (type: DocEntityType, id: string, f: string) => {
    if (!(await flushAll())) { addToast("Nejdřív vyřeš neuložený text", "error"); return }
    onSelect(type, id, f)
  }

  const act = async (action: StatusAction) => {
    const saved = await save(field)
    if (saved === null) return
    const rec = saved === "unchanged" ? recordsRef.current[field] : saved
    if (!rec) return
    setActing(action)
    try {
      const res = await adminFetch("/api/priprava/texts/status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entityType, entityId, field, action, expectedVersion: rec.version, by: getOrganizer() }),
      })
      if (res.status === 409) {
        const { conflict: server } = await res.json() as { conflict: TextRecord | null }
        setConflict({ field, server }); return
      }
      if (!res.ok) { addToast(await res.text(), "error"); return }
      const saved = await res.json() as TextRecord
      setRecords(r => ({ ...r, [field]: saved }))
      putMeta(saved)
    } catch {
      addToast("Chyba sítě", "error")
    } finally {
      setActing(null)
    }
  }

  const resolveConflict = (useTheirs: boolean) => {
    if (!conflict) return
    const { field: f, server } = conflict
    setRecords(r => ({ ...r, [f]: server ?? undefined }))
    if (server) putMeta(server)
    if (useTheirs) {
      setDrafts(d => ({ ...d, [f]: server?.body ?? "" }))
      setDirty(d => { const n = new Set(d); n.delete(f); return n })
      setConflict(null)
    } else {
      setConflict(null)
      // Verze je teď ta serverová, další uložení přepíše jejich text mým.
      setTimeout(() => save(f), 0)
    }
  }

  const fieldDef = fields.find(f => f.key === field) ?? fields[0]
  const rec = records[field]
  const draft = drafts[field] ?? ""
  const isDirty = dirty.has(field)
  const status = statusOf(rec ? { length: draft.length, status: isDirty && !keepStatus && rec.status ? null : rec.status } : { length: draft.length, status: null })
  const savedStatus = statusOf(rec ? { length: rec.body.length, status: rec.status } : undefined)
  const me = getOrganizer()

  const role = entityType === "role" ? roles.find(r => String(r.id) === entityId) : undefined

  const categoryLabel = CATEGORIES.find(c => c.value === entityType)?.label

  return (
    <div className="editor-layout" data-preview={showPreview ? "true" : undefined}>
      <aside className="editor-tree" aria-label={`Seznam: ${categoryLabel}`}>
        <button className="editor-back" onClick={async () => { if (await flushAll()) onBack() }}>
          <IconArrowLeft size={15} /> Přehled textů
        </button>
        <p className="tree-title">{categoryLabel}</p>
        <TreeList entities={entities} currentId={entityId} entityStatus={entityStatus}
          onPick={e => go(e.type, e.id, field && DOC_FIELDS[e.type].some(f => f.key === field) ? field : DOC_FIELDS[e.type][0].key)} />
      </aside>

      <section className="editor-main" aria-label="Editor">
        <div className="editor-narrow-nav">
          <button className="editor-back" onClick={async () => { if (await flushAll()) onBack() }}><IconArrowLeft size={15} /> Přehled</button>
          <select value={entityId} aria-label="Vybrat" className="move-select" style={{ flex: 1 }}
            onChange={e => go(entityType, e.target.value, field)}>
            {entities.map(e => <option key={e.id} value={e.id}>{e.group ? `${e.group} · ` : ""}{e.name}</option>)}
          </select>
        </div>

        <header style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 12 }}>
          <div style={{ minWidth: 0 }}>
            {entity?.group && <p style={{ margin: 0, fontSize: "0.78rem", color: "var(--c-text-faint)" }}>{entity.group}</p>}
            <h2 style={{ margin: 0, fontSize: "1.5rem", fontWeight: 800, color: "var(--c-text)", lineHeight: 1.2 }}>
              {entity?.name ?? entityId}
              {entity?.sub && <span style={{ fontWeight: 400, fontStyle: "italic", color: "var(--c-text-muted)", fontSize: "1rem" }}> „{entity.sub}“</span>}
            </h2>
            {role && (
              <p style={{ margin: "4px 0 0", fontSize: "0.85rem", color: "var(--c-text-muted)" }}>
                Role ve tvarech <b>{role.nameM}</b> / <b>{role.nameF}</b>, klíč <code>{role.key}</code> ·{" "}
                <button className="link-btn" onClick={() => go("unit", role.unitId, "public")}>upravit v jednotce</button>
              </p>
            )}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            {entityType === "character" && (
              <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: "0.8rem", color: "var(--c-text-muted)" }}>Rod</span>
                <span style={{ width: 150 }}>
                  <Segmented label="Rod postavy" value={(genders[entityId] ?? undefined) as "m" | "f" | undefined}
                    options={[{ value: "m", label: "muž" }, { value: "f", label: "žena" }]}
                    onChange={g => setGender(entityId, g)} />
                </span>
              </span>
            )}
            <button className="tool-btn editor-preview-toggle" onClick={() => setShowPreview(p => !p)} aria-pressed={showPreview}>
              {showPreview ? <IconEyeOff size={15} /> : <IconEye size={15} />} {showPreview ? "Skrýt náhled" : "Náhled"}
            </button>
          </div>
        </header>

        <div role="tablist" aria-label="Pole" className="field-tabs">
          {fields.map(f => {
            const r = records[f.key]
            const s = statusOf(r ? { length: (drafts[f.key] ?? r.body).length, status: r.status } : { length: (drafts[f.key] ?? "").length, status: null })
            const active = f.key === field
            return (
              <button key={f.key} role="tab" aria-selected={active} className={active ? "field-tab field-tab-on" : "field-tab"}
                onClick={() => { if (!active) go(entityType, entityId, f.key) }}>
                <StatusDot status={s} changed={r?.changedAfterApproval} /> {f.label}
                {dirty.has(f.key) && <span aria-label="neuloženo" style={{ color: "var(--c-accent)" }}>•</span>}
              </button>
            )
          })}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", margin: "12px 0 8px" }}>
          <span className={`vis-badge vis-${fieldDef.visibility}`}>{VISIBILITY_LABELS[fieldDef.visibility]}</span>
          <span style={{ fontSize: "0.85rem", color: "var(--c-text-muted)" }}>{fieldDef.hint}</span>
        </div>

        {conflict && conflict.field === field && (
          <div className="conflict" role="alert">
            <p style={{ margin: "0 0 8px", display: "flex", gap: 8, alignItems: "flex-start" }}>
              <IconAlertTriangle size={18} style={{ flexShrink: 0, marginTop: 2 }} />
              <span>
                Text mezitím změnil{conflict.server?.updatedBy ? `(a) ${conflict.server.updatedBy}` : " někdo jiný"}
                {conflict.server ? ` (${fmtTime(conflict.server.updatedAt)})` : ""}. Tvoje poslední úprava není uložená.
              </span>
            </p>
            {conflict.server && (
              <details style={{ margin: "0 0 10px" }}>
                <summary style={{ cursor: "pointer", fontSize: "0.85rem" }}>Ukázat jejich verzi</summary>
                <pre className="conflict-text">{conflict.server.body}</pre>
              </details>
            )}
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button className="tool-btn" onClick={() => resolveConflict(true)}>Vzít jejich verzi</button>
              <button className="tool-btn" onClick={() => resolveConflict(false)}>Přepsat mojí verzí</button>
            </div>
          </div>
        )}

        {loading ? (
          <p style={{ color: "var(--c-text-muted)", display: "flex", alignItems: "center", gap: 6 }}><IconLoader2 size={16} className="spin" /> Načítám…</p>
        ) : (
          <textarea
            key={`${entityType}:${entityId}:${field}`}
            className="doc-textarea"
            aria-label={`${entity?.name ?? ""}, ${fieldDef.label}`}
            value={draft}
            placeholder="Piš sem. Funguje markdown: # nadpis, **tučně**, *kurzíva*, - odrážky."
            onChange={e => {
              const v = e.target.value
              setDrafts(d => ({ ...d, [field]: v }))
              setDirty(d => d.has(field) ? d : new Set(d).add(field))
            }}
            onBlur={() => save(field)}
            onKeyDown={e => { if ((e.metaKey || e.ctrlKey) && e.key === "s") { e.preventDefault(); save(field) } }}
          />
        )}

        <div className="editor-footer">
          <span style={{ fontSize: "0.8rem", color: "var(--c-text-muted)", display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
            {saving ? <>Ukládám…</>
              : isDirty ? <span style={{ color: "var(--c-accent)" }}>Neuloženo</span>
              : rec ? <>Uloženo {fmtTime(rec.updatedAt)}{rec.updatedBy ? ` · ${rec.updatedBy}` : ""}</>
              : draft.length === 0 ? <>Zatím nic</> : null}
            <span style={{ color: "var(--c-text-faint)" }}>· {draft.length.toLocaleString("cs-CZ")} znaků</span>
          </span>

          <span style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: "0.82rem", color: "var(--c-text-muted)" }}>
              <StatusDot status={savedStatus} changed={rec?.changedAfterApproval} /> {STATUS_LABELS[savedStatus]}
              {rec?.changedAfterApproval && <span style={{ color: "var(--destructive)" }}>· změněno po schválení</span>}
            </span>
            {(savedStatus === "done" || savedStatus === "approved") && (
              <label style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: "0.8rem", color: "var(--c-text-muted)", cursor: "pointer" }}
                title="Oprava překlepu: úprava nevrátí text do rozepsaného">
                <input type="checkbox" checked={keepStatus} onChange={e => setKeepStatus(e.target.checked)} /> Drobná oprava
              </label>
            )}
            {status === "draft" && (
              <button className="tool-btn tool-btn-primary" disabled={acting !== null} onClick={() => act("done")}>
                <IconCheck size={15} /> Hotovo
              </button>
            )}
            {savedStatus === "done" && !isDirty && (
              <button className="tool-btn tool-btn-primary" disabled={acting !== null} onClick={() => act("approve")}
                title={rec?.doneBy && rec.doneBy === me ? "Schvaluješ text, který jsi sám označil jako hotový" : undefined}>
                <IconChecks size={15} /> Schválit{rec?.doneBy && rec.doneBy === me ? " (vlastní)" : ""}
              </button>
            )}
            {(savedStatus === "done" || savedStatus === "approved") && !isDirty && (
              <button className="tool-btn" disabled={acting !== null} onClick={() => act("reopen")}>
                <IconArrowBackUp size={15} /> Vrátit k úpravám
              </button>
            )}
          </span>
        </div>
        {rec && (rec.doneBy || rec.approvedBy) && (
          <p style={{ margin: "6px 0 0", fontSize: "0.78rem", color: "var(--c-text-faint)", textAlign: "right" }}>
            {rec.doneBy && <>Hotovo: {rec.doneBy}, {fmtTime(rec.doneAt)}</>}
            {rec.doneBy && rec.approvedBy && " · "}
            {rec.approvedBy && <>Schválil(a): {rec.approvedBy}, {fmtTime(rec.approvedAt)}</>}
          </p>
        )}

        {entityType === "unit" && (
          <RolesEditor unitId={entityId} onOpenRole={id => go("role", String(id), "personal")} metaStatus={(id) => statusOf(meta.get(`role:${id}:personal`))} />
        )}
      </section>

      <aside className="editor-preview theme-paper" aria-label="Náhled pro hráče">
        <p className="tree-title" style={{ color: "var(--c-text-muted)" }}>Jak to uvidí hráč</p>
        {fields.map(f => {
          const body = drafts[f.key] ?? records[f.key]?.body ?? ""
          return (
            <div key={f.key} className={f.key === field ? "preview-block preview-current" : "preview-block"}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 6 }}>
                <span style={{ fontWeight: 800, fontSize: "0.95rem" }}>{f.label}</span>
                <span className={`vis-badge vis-${f.visibility}`}>{VISIBILITY_LABELS[f.visibility]}</span>
              </div>
              {body.trim()
                ? <WikiRenderer content={body} kaichiLevel={8} />
                : <p style={{ margin: 0, color: "var(--c-text-faint)", fontStyle: "italic", fontSize: "0.9rem" }}>Zatím prázdné</p>}
            </div>
          )
        })}
      </aside>
    </div>
  )
}

function TreeList({ entities, currentId, entityStatus, onPick }: {
  entities: DocEntity[]
  currentId: string
  entityStatus: (type: DocEntityType, id: string) => import("@/lib/doc-status").DocStatus
  onPick: (e: DocEntity) => void
}) {
  return (
    <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
      {entities.map((e, i) => {
        const newGroup = e.group && e.group !== entities[i - 1]?.group
        const active = e.id === currentId
        return (
          <li key={e.id}>
            {newGroup && <p className="tree-group" style={{ borderLeftColor: e.color ?? "transparent" }}>{e.group}</p>}
            <button className={active ? "tree-item tree-item-on" : "tree-item"} aria-current={active ? "true" : undefined} onClick={() => onPick(e)}>
              <StatusDot status={entityStatus(e.type, e.id)} />
              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{e.name}</span>
            </button>
          </li>
        )
      })}
      {entities.length === 0 && <li style={{ color: "var(--c-text-faint)", fontSize: "0.85rem", padding: "6px 8px" }}>Nic tu není.</li>}
    </ul>
  )
}

