"use client"

import React, { useMemo } from "react"
import { DOC_FIELDS } from "@/lib/doc-fields"
import { countStatuses, STATUS_LABELS, type DocStatus, type StatusCounts } from "@/lib/doc-status"
import { CATEGORIES, STATUS_COLORS, StatusDot, buildEntities, useTexty, type Category } from "./texty-data"

// Rychlé statistiky: kolik textů je v jakém stavu, po kategoriích a polích.
// Klik na řádek přepne matici na tu kategorii.

const ORDER: DocStatus[] = ["empty", "draft", "done", "approved"]

function Bar({ c }: { c: StatusCounts }) {
  const pct = (n: number) => c.total === 0 ? 0 : (n / c.total) * 100
  return (
    <div className="progress-bar" style={{ height: 8, minWidth: 80 }} aria-hidden>
      {(["approved", "done", "draft"] as DocStatus[]).map(s => <span key={s} style={{ width: `${pct(c[s])}%`, backgroundColor: STATUS_COLORS[s] }} />)}
    </div>
  )
}

function Cells({ c }: { c: StatusCounts }) {
  return <>
    {ORDER.map(s => <td key={s} className="stats-num" style={{ color: c[s] === 0 ? "var(--c-text-faint)" : undefined }}>{c[s]}</td>)}
    <td className="stats-num">{c.total}</td>
    <td style={{ width: "28%" }}><Bar c={c} /></td>
  </>
}

export function TextStats({ onCategory }: { onCategory: (c: Category) => void }) {
  const { roles, statusOfField } = useTexty()

  const rows = useMemo(() => CATEGORIES.map(cat => {
    const entities = buildEntities(cat.value, roles)
    const fields = DOC_FIELDS[cat.value].map(f => ({
      key: f.key, label: f.label,
      counts: countStatuses(entities.map(e => statusOfField(e.type, e.id, f.key))),
    }))
    return {
      cat, entities: entities.length, fields,
      counts: countStatuses(entities.flatMap(e => DOC_FIELDS[cat.value].map(f => statusOfField(e.type, e.id, f.key)))),
    }
  }), [roles, statusOfField])

  return (
    <div className="stats-wrap">
      <table className="stats-table">
        <thead>
          <tr>
            <th style={{ textAlign: "left" }}>Text</th>
            {ORDER.map(s => <th key={s}><span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}><StatusDot status={s} /> {STATUS_LABELS[s]}</span></th>)}
            <th>Celkem</th>
            <th aria-label="Postup" />
          </tr>
        </thead>
        <tbody>
          {rows.map(r => (
            <React.Fragment key={r.cat.value}>
              <tr className="stats-cat" onClick={() => onCategory(r.cat.value)}>
                <th scope="rowgroup" style={{ textAlign: "left" }}>
                  <button className="stats-link" onClick={() => onCategory(r.cat.value)}>{r.cat.label}</button>
                  <span style={{ color: "var(--c-text-faint)", fontWeight: 400, marginLeft: 6 }}>{r.entities}×</span>
                </th>
                <Cells c={r.counts} />
              </tr>
              {r.fields.length > 1 && r.fields.map(f => (
                <tr key={f.key}>
                  <th scope="row" style={{ textAlign: "left", fontWeight: 400, paddingLeft: 22, color: "var(--c-text-muted)" }}>{f.label}</th>
                  <Cells c={f.counts} />
                </tr>
              ))}
            </React.Fragment>
          ))}
        </tbody>
      </table>
    </div>
  )
}
