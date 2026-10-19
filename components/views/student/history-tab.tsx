"use client"

import { useMemo } from "react"
import { useGame } from "@/lib/game-context"
import { formatDateTime } from "@/lib/utils"
import { ACTION_LABELS } from "@/lib/constants"
import { characterHistory } from "@/lib/character-history"

export function HistoryTab({ studentId }: { studentId: string }) {
  const { pointLog, characters } = useGame()
  const points = characters.find(c => c.id === studentId)?.points ?? 0
  const history = useMemo(() => characterHistory(pointLog, studentId, points), [pointLog, studentId, points])

  return (
    <>
      <p style={{ fontSize:"0.72rem", letterSpacing:"0.09em", color:"var(--c-text-muted)", marginBottom:10 }}>MOJE BODY</p>
      {history.length === 0 && <p style={{ color:"var(--c-text-muted)", fontSize:"0.85rem", textAlign:"center", padding:"20px 0" }}>Žádné záznamy</p>}
      <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
        {history.map(({ entry: e, amount, runningTotal, reversed, isReversal }) => (
          <div key={e.id} style={{ display:"flex", alignItems:"center", gap:12, backgroundColor:"var(--c-bg-card)", borderRadius:6, padding:"10px 14px", border:"2px solid var(--c-border-mid)", boxShadow:"var(--shadow-print-sm)", opacity: reversed ? 0.55 : 1, }}>
            <span style={{ minWidth:44, textAlign:"center", fontFamily:"monospace", fontWeight:900, fontSize:"1rem", color: amount > 0 ? "var(--c-success)" : "var(--destructive)", textDecoration: reversed ? "line-through" : "none", }}>
              {amount > 0 ? "+" : ""}{amount}
            </span>
            <div style={{ flex:1, minWidth:0 }}>
              <p style={{ margin:0, fontSize:"0.85rem", fontWeight:600, color:"var(--c-text)" }}>
                {ACTION_LABELS[e.actionType]}
                {reversed && <span style={{ color:"var(--destructive)", fontWeight:700 }}> · stornováno</span>}
                {isReversal && <span style={{ color:"var(--c-text-muted)", fontWeight:700 }}> · protizáznam</span>}
              </p>
              {e.note && <p style={{ margin:"2px 0 0", fontSize:"0.72rem", color:"var(--c-text-muted)" }}>{e.note}</p>}
            </div>
            <div style={{ textAlign:"right", flexShrink:0 }}>
              <p style={{ margin:0, fontSize:"0.8rem", fontFamily:"monospace", fontWeight:700, color:"var(--c-text)" }}>Σ {runningTotal}</p>
              <p style={{ margin:"2px 0 0", fontSize:"0.68rem", color:"var(--c-text-muted)", fontFamily:"monospace" }}>{formatDateTime(e.timestamp)}</p>
            </div>
          </div>
        ))}
      </div>
    </>
  )
}