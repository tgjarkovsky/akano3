"use client"

import React from "react"
import { IconAlertTriangle, IconAlertCircle, IconCircleCheck, IconChevronRight } from "@tabler/icons-react"
import type { AssignmentIssue } from "@/lib/assignment-checks"
import { focusElement } from "./shared"

const targetElementId = (i: AssignmentIssue) =>
  i.target.type === "unit" ? `unit-${i.target.id}` :
  i.target.type === "team" ? `team-${i.target.id}` :
  `postava-${i.target.id}`

export function ChecksPanel({ issues, compact }: { issues: AssignmentIssue[]; compact?: boolean }) {
  const errors = issues.filter(i => i.level === "error")
  const warnings = issues.filter(i => i.level === "warning")

  const summary = issues.length === 0
    ? <span style={{ display: "flex", alignItems: "center", gap: 6, color: "var(--c-success)", fontWeight: 700 }}>
        <IconCircleCheck size={18} /> Obsazení je kompletní
      </span>
    : <span style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        {errors.length > 0 && <span style={{ color: "var(--destructive)", fontWeight: 700 }}>{errors.length} {plural(errors.length, "chyba", "chyby", "chyb")}</span>}
        {warnings.length > 0 && <span style={{ color: "var(--c-accent)", fontWeight: 700 }}>{warnings.length} {plural(warnings.length, "varování", "varování", "varování")}</span>}
      </span>

  const list = (
    <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 4 }}>
      {[...errors, ...warnings].map((i, n) => (
        <li key={n}>
          <button type="button" className="check-item" onClick={() => focusElement(targetElementId(i))}>
            {i.level === "error"
              ? <IconAlertCircle size={15} color="var(--destructive)" style={{ flexShrink: 0 }} aria-label="Chyba" />
              : <IconAlertTriangle size={15} color="var(--c-accent)" style={{ flexShrink: 0 }} aria-label="Varování" />}
            <span style={{ flex: 1 }}>{i.message}</span>
            <IconChevronRight size={14} color="var(--c-text-faint)" style={{ flexShrink: 0 }} aria-hidden />
          </button>
        </li>
      ))}
    </ul>
  )

  if (compact) {
    return (
      <details className="checks-box">
        <summary style={{ cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
          <span style={{ fontSize: "0.8rem", color: "var(--c-text-muted)" }}>Kontroly</span>
          {summary}
        </summary>
        {issues.length > 0 && <div style={{ marginTop: 10 }}>{list}</div>}
      </details>
    )
  }

  return (
    <div className="checks-box">
      <p style={{ fontSize: "0.75rem", letterSpacing: "0.08em", color: "var(--c-text-muted)", margin: "0 0 8px" }}>KONTROLY</p>
      <div style={{ marginBottom: issues.length ? 12 : 0 }}>{summary}</div>
      {list}
      {issues.length > 0 && (
        <p style={{ fontSize: "0.75rem", color: "var(--c-text-faint)", margin: "12px 0 0", lineHeight: 1.4 }}>
          Klikni na položku a ukážu, kde to je.
        </p>
      )}
    </div>
  )
}

function plural(n: number, one: string, few: string, many: string) {
  return n === 1 ? one : n >= 2 && n <= 4 ? few : many
}
