"use client"

import React, { useMemo, useState } from "react"
import { IconFileImport } from "@tabler/icons-react"
import { DOC_FIELDS, docKey } from "@/lib/doc-fields"
import { countStatuses, STATUS_LABELS, type DocStatus } from "@/lib/doc-status"
import { getOrganizer } from "@/lib/admin-client"
import { CATEGORIES, STATUS_COLORS, StatusDot, buildEntities, useTexty, type Category, type DocEntity } from "./texty-data"

// Přehled postupu: řádek = entita, sloupec = pole, buňka = stav. Klik otevře editor.

type Filter = "all" | "mine" | "review" | "changed" | "todo"

const FILTERS: { value: Filter; label: string }[] = [
  { value: "all", label: "Vše" },
  { value: "todo", label: "Nedopsané" },
  { value: "review", label: "Čeká na schválení" },
  { value: "changed", label: "Změněno po schválení" },
  { value: "mine", label: "Moje" },
]

export function TextMatrix({ category, onCategory, onOpen, onImport }: {
  category: Category
  onCategory: (c: Category) => void
  onOpen: (e: DocEntity, field: string) => void
  onImport: () => void
}) {
  const { loaded, meta, roles, statusOfField } = useTexty()
  const [filter, setFilter] = useState<Filter>("all")
  const me = getOrganizer()

  const fields = DOC_FIELDS[category]
  const entities = useMemo(() => buildEntities(category, roles), [category, roles])

  // Postup za kategorie (pro záložky) a celkem.
  const perCategory = useMemo(() => Object.fromEntries(CATEGORIES.map(c => {
    const list = buildEntities(c.value, roles).flatMap(e => DOC_FIELDS[c.value].map(f => statusOfField(e.type, e.id, f.key)))
    return [c.value, countStatuses(list)]
  })), [roles, statusOfField])
  const all = useMemo(() => {
    const totals = { empty: 0, draft: 0, done: 0, approved: 0, total: 0 }
    for (const c of Object.values(perCategory)) for (const k of Object.keys(totals) as (keyof typeof totals)[]) totals[k] += c[k]
    return totals
  }, [perCategory])

  const cellMatches = (e: DocEntity, field: string): boolean => {
    const m = meta.get(docKey(e.type, e.id, field))
    const s = statusOfField(e.type, e.id, field)
    switch (filter) {
      case "all": return true
      case "todo": return s === "empty" || s === "draft"
      case "review": return s === "done"
      case "changed": return !!m?.changedAfterApproval
      case "mine": return !!me && (m?.updatedBy === me || m?.doneBy === me)
    }
  }
  const visibleEntities = entities.filter(e => fields.some(f => cellMatches(e, f.key)))

  const pct = (n: number, d: number) => d === 0 ? 0 : Math.round((n / d) * 100)

  return (
    <div>
      <div className="texty-progress">
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 8 }}>
          <span style={{ fontWeight: 800, fontSize: "1.05rem", color: "var(--c-text)", display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            Schváleno {all.approved} z {all.total} textů
            <button className="tool-btn" onClick={onImport} style={{ fontWeight: 400 }}><IconFileImport size={15} /> Import</button>
          </span>
          <span style={{ display: "flex", gap: 14, flexWrap: "wrap", fontSize: "0.8rem", color: "var(--c-text-muted)" }}>
            {(["empty", "draft", "done", "approved"] as DocStatus[]).map(s => (
              <span key={s} style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
                <StatusDot status={s} /> {STATUS_LABELS[s]} {all[s]}
              </span>
            ))}
          </span>
        </div>
        <div className="progress-bar" role="img" aria-label={`Schváleno ${pct(all.approved, all.total)} %`}>
          {(["approved", "done", "draft"] as DocStatus[]).map(s => (
            <span key={s} style={{ width: `${pct(all[s], all.total)}%`, backgroundColor: STATUS_COLORS[s] }} />
          ))}
        </div>
      </div>

      <div role="tablist" aria-label="Kategorie textů" className="texty-tabs">
        {CATEGORIES.map(c => {
          const n = perCategory[c.value]
          const active = c.value === category
          return (
            <button key={c.value} role="tab" aria-selected={active} onClick={() => onCategory(c.value)}
              className={active ? "texty-tab texty-tab-on" : "texty-tab"}>
              {c.label}
              <span style={{ fontSize: "0.75rem", color: n.approved === n.total && n.total > 0 ? "var(--c-success)" : "var(--c-text-faint)" }}>
                {n.approved}/{n.total}
              </span>
            </button>
          )
        })}
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, margin: "12px 0 14px" }}>
        {FILTERS.map(f => (
          <button key={f.value} onClick={() => setFilter(f.value)} className={filter === f.value ? "filter-chip filter-chip-on" : "filter-chip"}>
            {f.label}
          </button>
        ))}
      </div>

      {!loaded ? <p style={{ color: "var(--c-text-muted)" }}>Načítám texty…</p>
        : category === "role" && entities.length === 0 ? (
          <p style={{ color: "var(--c-text-muted)", lineHeight: 1.5, maxWidth: 560 }}>
            Zatím žádné role. Role se zakládají u jednotky: přepni na Jednotky, otevři jednotku a dole přidej role do trojic A a B.
          </p>
        ) : visibleEntities.length === 0 ? (
          <p style={{ color: "var(--c-text-muted)" }}>Nic neodpovídá filtru.</p>
        ) : (
          <div className="matrix-wrap">
            <table className="matrix">
              <thead>
                <tr>
                  <th scope="col" style={{ textAlign: "left" }}>{CATEGORIES.find(c => c.value === category)?.label}</th>
                  {fields.map(f => <th key={f.key} scope="col">{f.label}</th>)}
                </tr>
              </thead>
              <tbody>
                {visibleEntities.map((e, i) => {
                  const newGroup = e.group && e.group !== visibleEntities[i - 1]?.group
                  return (
                    <React.Fragment key={e.id}>
                      {newGroup && (
                        <tr className="matrix-group"><th colSpan={fields.length + 1} scope="colgroup" style={{ borderLeftColor: e.color ?? "transparent" }}>{e.group}</th></tr>
                      )}
                      <tr>
                        <th scope="row" style={{ textAlign: "left" }}>
                          <button className="matrix-name" onClick={() => onOpen(e, fields[0].key)}>
                            <span style={{ fontWeight: 700 }}>{e.name}</span>
                            {e.sub && <span style={{ color: "var(--c-text-faint)", fontStyle: "italic", fontWeight: 400 }}> {e.sub}</span>}
                          </button>
                        </th>
                        {fields.map(f => {
                          const s = statusOfField(e.type, e.id, f.key)
                          const m = meta.get(docKey(e.type, e.id, f.key))
                          const dim = !cellMatches(e, f.key)
                          const who = s === "approved" ? m?.approvedBy : s === "done" ? m?.doneBy : m?.updatedBy
                          return (
                            <td key={f.key}>
                              <button className="matrix-cell" onClick={() => onOpen(e, f.key)}
                                style={{ opacity: dim ? 0.3 : 1 }}
                                aria-label={`${e.name}, ${f.label}: ${STATUS_LABELS[s]}${who ? `, ${who}` : ""}`}
                                title={`${f.label}: ${STATUS_LABELS[s]}${who ? ` · ${who}` : ""}${m?.changedAfterApproval ? " · změněno po schválení" : ""}`}>
                                <StatusDot status={s} size={14} changed={m?.changedAfterApproval} />
                              </button>
                            </td>
                          )
                        })}
                      </tr>
                    </React.Fragment>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
    </div>
  )
}
