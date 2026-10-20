"use client"

import React, { useMemo } from "react"
import { IconChevronUp, IconChevronDown } from "@tabler/icons-react"
import { useGame } from "@/lib/game-context"
import { UNITS, CIRCLES } from "@/lib/data"
import { resolvedCharsOf, charTeam } from "@/lib/utils"
import { unitPoints, circlePoints } from "@/lib/score-aggregation"
import { rankShifts, formatShift } from "@/lib/rank-shift"
import { TeamDot } from "@/components/shared/team-icon"

type ScoreMode = "students" | "teams" | "units" | "circles"

export function ScoreboardComponent({
  mode = "teams",
  compact = false,
  highlightId,
  onModeChange,
  showModeToggle = false,
}: {
  mode?: ScoreMode
  compact?: boolean
  highlightId?: string
  onModeChange?: (m: ScoreMode) => void
  showModeToggle?: boolean
}) {
  const { teams, characters, pointLog } = useGame()

  const rows = useMemo(() => {
    if (mode === "students") {
      const teamColor = (tid?: string) => teams.find(t => t.id === tid)?.color ?? "#888"
      return characters
        .filter(c => c.role === "student" || c.role === "ruze")
        .sort((a,b) => b.points - a.points)
        .map((c,i) => ({ id: c.id, name: c.name, points: c.points, color: teamColor(c.teamId), rank: i+1, iconTeamId: c.teamId }))
    }
    if (mode === "teams") {
      return [...teams].sort((a,b) => b.points - a.points).map((t,i) => ({
        id: t.id, name: t.name, points: t.points, color: t.color, rank: i+1, iconTeamId: t.id,
      }))
    }
    if (mode === "units") {
      return UNITS.map(u => {
        const pts = unitPoints(u.id, teams, characters)
        return { id:u.id, name:u.name, points:pts, color:"var(--c-teal)", rank:0, iconTeamId: undefined as string | undefined }
      }).sort((a,b)=>b.points-a.points).map((r,i)=>({...r, rank:i+1}))
    }
    return CIRCLES.map(c => {
      const pts = circlePoints(c.id, characters)
      return { id:c.id, name:c.name, points:pts, color:"#a052e0", rank:0, iconTeamId: undefined as string | undefined }
    }).sort((a,b)=>b.points-a.points).map((r,i)=>({...r, rank:i+1}))
  }, [mode, teams, characters])

  // Recent deltas keyed by both team and character, so any mode can show them
  const recentChanges = useMemo(() => {
    const cutoff = new Date(Date.now() - 120000)
    const team: Record<string, number> = {}, char: Record<string, number> = {}
    pointLog.filter(e => e.timestamp > cutoff).forEach(e => {
      resolvedCharsOf(e).forEach(cid => {
        char[cid] = (char[cid] ?? 0) + e.amount
        const tid = charTeam(cid)
        if (tid) team[tid] = (team[tid] ?? 0) + e.amount
      })
    })
    return { team, char }
  }, [pointLog])

  const shifts = useMemo(() => {
    if (mode !== "students" && mode !== "teams") return {}
    return rankShifts(rows, pointLog, mode, new Date(Date.now() - 30 * 60000), charTeam)
  }, [mode, rows, pointLog])

  const fontSize = compact ? "0.9rem" : "1.1rem"
  const ptSize   = compact ? "1.1rem" : "1.7rem"

  return (
    <div>
      {showModeToggle && (
        <div style={{ display:"flex", gap:8, marginBottom:12 }}>
          {(["students","teams","units","circles"] as const).map(m => (
            <button key={m} onClick={() => onModeChange?.(m)} style={{
              padding:"4px 12px", borderRadius:6, fontSize:"0.8rem", cursor:"pointer",
              backgroundColor: mode===m ? "var(--teal-700)" : "var(--c-bg-section)",
              color: mode===m ? "#F4ECDF" : "var(--c-accent)",
              border: `1px solid ${mode===m ? "var(--teal-700)" : "var(--c-border-str)"}`,
              fontWeight: mode===m ? 700 : 400,
            }}>
              {m==="students" ? "Studenti" : m==="teams" ? "Týmy" : m==="units" ? "Jednotky" : "Kruhy"}
            </button>
          ))}
        </div>
      )}

      <div style={{ display:"flex", flexDirection:"column", gap:compact ? 4 : 6 }}>
        {rows.map(row => {
          const change = (mode === "students" ? recentChanges.char : recentChanges.team)[row.id] ?? 0
          const isHL   = row.id === highlightId
          const isLeader = row.rank === 1
          return (
            <div key={row.id} style={{
              display:"flex", alignItems:"center", gap:12,
              padding: compact ? "8px 12px" : "16px 20px",
              borderRadius:6,
              backgroundColor: isHL ? "rgba(16,128,128,0.12)"
                : isLeader ? "rgba(224,176,128,0.16)" : "var(--c-bg-section)",
              border: `2px solid ${isHL ? "rgba(16,128,128,0.45)"
                : isLeader ? "rgba(224,176,128,0.5)" : "var(--c-border)"}`,
              boxShadow: isLeader ? "var(--shadow-print-sm)" : "none",
              transition:"all 0.3s",
            }}>
              <span style={{
                minWidth: compact ? 24 : 32, fontWeight:900,
                color: row.rank <= 3 ? "var(--sand-600)" : "var(--c-text-faint)",
                fontSize: compact ? "0.85rem" : "1.1rem",
                fontFamily:"var(--font-mono)",
              }}>
                {row.rank}
              </span>
              <TeamDot color={row.color} teamId={row.iconTeamId ?? row.id} />
              <span style={{ flex:1, fontWeight:600, color:"var(--c-text)", fontSize }}>
                {row.name}
              </span>
              {(mode === "students" || mode === "teams") && (
                <span style={{
                  fontFamily:"var(--font-mono)", fontSize:"0.78rem", fontWeight:700,
                  color: (shifts[row.id] ?? 0) > 0 ? "var(--teal-700)" : (shifts[row.id] ?? 0) < 0 ? "var(--oxblood-500)" : "var(--c-text-faint)",
                  minWidth:32, textAlign:"right",
                }}>{formatShift(shifts[row.id] ?? 0)}</span>
              )}
              {change !== 0 && (
                <span style={{
                  fontFamily:"var(--font-mono)", fontSize:"0.78rem", fontWeight:700,
                  color: change > 0 ? "var(--teal-700)" : "var(--oxblood-500)",
                  minWidth:50, textAlign:"right",
                }}>
                  {change > 0
                    ? <IconChevronUp size={12} style={{display:"inline"}} />
                    : <IconChevronDown size={12} style={{display:"inline"}} />}
                  {change > 0 ? "+" : ""}{change}
                </span>
              )}
              <span style={{
                fontFamily:"var(--font-mono)", fontWeight:900,
                color:"var(--c-accent)", fontSize: ptSize,
                minWidth:60, textAlign:"right",
              }}>
                {row.points}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
