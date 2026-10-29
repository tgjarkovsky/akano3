"use client"

import React, { useState, useEffect, useMemo, useRef } from "react"
import { IconBellRinging, IconVolume, IconShield } from "@tabler/icons-react"
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip as RechartsTooltip, ResponsiveContainer,
} from "recharts"
import { useGame } from "@/lib/game-context"
import { teamTimeline, formatTimeOnly } from "@/lib/team-timeline"
import { rankShifts, formatShift } from "@/lib/rank-shift"
import { TEAM_ICONS } from "@/lib/data"
import { TeamIcon } from "@/components/shared/team-icon"
import { useAlarmSound } from "@/components/shared/alarm-banner"
import type { Team } from "@/lib/types"

function EndLabel({ cx, cy, index, lastIndex, color, name, iconTeamId }: {
  cx?: number; cy?: number; index?: number; lastIndex: number; color: string; name: string; iconTeamId?: string
}) {
  if (index !== lastIndex || cx == null || cy == null) return null
  const Icon = (iconTeamId ? TEAM_ICONS[iconTeamId] : undefined) ?? IconShield
  return (
    <g transform={`translate(${cx + 10}, ${cy - 12})`}>
      <Icon size={24} color={color} strokeWidth={2} />
      <text x={30} y={12} fill={color} fontSize={20} fontWeight={700} fontFamily="Space Mono, monospace" dominantBaseline="middle">
        {name}
      </text>
    </g>
  )
}

function ClockDisplay() {
  const [time, setTime] = useState(() => new Date().toLocaleTimeString("cs-CZ"))
  useEffect(() => {
    const iv = setInterval(() => setTime(new Date().toLocaleTimeString("cs-CZ")), 1000)
    return () => clearInterval(iv)
  }, [])
  return <span style={{ color:"rgba(255,255,255,0.55)", fontSize:"0.8rem", fontFamily:"var(--font-mono)" }}>{time}</span>
}

const VIEWS = ["studentScores", "teamChart"] as const
type View = typeof VIEWS[number]
const VIEW_TITLE: Record<View, string> = {
  studentScores: "Žebříček studentů", teamChart: "Vývoj týmů v čase",
}

export function DisplayScreen() {
  const { teams, characters, pointLog, alarmState, broadcastActive } = useGame()
  useAlarmSound(alarmState.active)
  const [view, setView] = useState<View>("studentScores")
  const [progress, setProgress] = useState(0)   // 0..1 until next auto-rotate
  const ROTATE_MS = 18000
  const cycleStart = useRef(Date.now())

  const goToView = (v: View) => { setView(v); cycleStart.current = Date.now(); setProgress(0) }

  useEffect(() => {
    const iv = setInterval(() => {
      const elapsed = Date.now() - cycleStart.current
      if (elapsed >= ROTATE_MS) {
        cycleStart.current = Date.now()
        setProgress(0)
        setView(v => VIEWS[(VIEWS.indexOf(v) + 1) % VIEWS.length])
      } else {
        setProgress(elapsed / ROTATE_MS)
      }
    }, 100)
    return () => clearInterval(iv)
  }, [])

  const sorted = useMemo(() => [...teams].sort((a,b) => b.points - a.points), [teams])
  const teamColor = (tid?: string) => teams.find(t => t.id === tid)?.color ?? "#E0B080"
  const students = useMemo(() =>
    characters.filter(c => c.role === "student" || c.role === "ruze").sort((a,b) => b.points - a.points)
  , [characters])

  const shifts = useMemo(
    () => rankShifts(students, pointLog, "students", new Date(Date.now() - 30 * 60000)),
    [students, pointLog])

  const timeData = useMemo(() => teamTimeline(teams, pointLog), [teams, pointLog])

  if (alarmState.active) {
    return (
      <div className="alarm-overlay" style={{
        position:"fixed", inset:0, zIndex:9999,
        display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center",
        backgroundColor: alarmState.color,
      }}>
        <IconBellRinging size={80} color="white" style={{ marginBottom:32 }} className="alarm-pulse" />
        <h1 className="alarm-flash-text" style={{
          fontFamily:"var(--font-display)", textTransform:"uppercase",
          color:"#fff", fontSize:"clamp(2rem,8vw,6rem)", fontWeight:700,
          textAlign:"center", padding:"0 40px", letterSpacing:"0.03em",
          textShadow:"0 0 40px rgba(0,0,0,0.5)",
        }}>
          {alarmState.message || alarmState.type.toUpperCase()}
        </h1>
        <p className="ds-overline" style={{ color:"rgba(255,255,255,0.6)", fontSize:"1.1rem", marginTop:24 }}>
          AKANO · ALARM SYSTÉM
        </p>
      </div>
    )
  }

  return (
    <div style={{
      position:"fixed", inset:0,
      backgroundColor:"#3A0808",   // DS flat oxblood ground — no gradient mush
      display:"flex", flexDirection:"column", overflow:"hidden",
    }}>
      {/* Loading bar — time until next screen */}
      <div style={{ height:8, backgroundColor:"rgba(255,255,255,0.14)", flexShrink:0 }}>
        <div style={{
          height:"100%", width:`${progress * 100}%`,
          background:"linear-gradient(90deg, #d4a017, #e8c65a)",
          boxShadow:"0 0 12px rgba(212,160,23,0.8)",
          transition:"width 0.1s linear",
        }} />
      </div>

      {broadcastActive && (
        <div style={{
          backgroundColor:"color-mix(in srgb, var(--c-teal) 20%, transparent)", borderBottom:"1px solid color-mix(in srgb, var(--c-teal) 38%, transparent)",
          padding:"6px 24px", textAlign:"right",
          color:"var(--c-teal)", fontSize:"0.8rem", fontWeight:600,
        }}>
          <IconVolume size={13} style={{display:"inline",marginRight:6}} />
          ŽIVÉ VYSÍLÁNÍ
        </div>
      )}

      <div style={{ textAlign:"center", padding:"20px 0 10px", flexShrink:0 }}>
        <h1 className="ds-label" style={{
          color:"var(--sand-400)", fontSize:"clamp(1.2rem,3.4vw,2.4rem)", fontWeight:700,
          letterSpacing:"0.15em", margin:0,
        }}>
          AKANO
        </h1>
        <p className="ds-overline" style={{
          color:"rgba(255,255,255,0.4)", fontSize:"clamp(0.6rem,1.2vw,0.8rem)", marginTop:6,
        }}>
          {VIEW_TITLE[view]}
        </p>
      </div>

      <div style={{ flex:1, overflow:"hidden", padding:"0 32px 8px", display:"flex", flexDirection:"column" }}>

        {view === "studentScores" && (
          <div style={{ flex:1, overflow:"hidden", display:"flex", alignItems:"center" }}>
            <div style={{ maxWidth:1500, width:"100%", margin:"0 auto", columnCount:2, columnGap:24 }}>
              {students.map((s, i) => {
                const accent = teamColor(s.teamId)
                return (
                  <div key={s.id} style={{
                    breakInside:"avoid", marginBottom:6,
                    display:"flex", alignItems:"center", gap:16,
                    padding:"clamp(4px,0.9vh,10px) 22px",
                    backgroundColor: `${accent}1f`,      // team tint
                    border:"1px solid rgba(255,255,255,0.12)",
                    borderLeft:`5px solid ${accent}`,
                    borderRadius:10, transition:"all 0.5s ease",
                  }}>
                    <span style={{
                      minWidth:"2.5ch", fontFamily:"var(--font-mono)", fontWeight:900,
                      fontSize:"clamp(0.85rem,1.5vw,1.5rem)",
                      color: i === 0 ? "#d4a017" : i === 1 ? "#c0c0c0" : i === 2 ? "#cd7f32" : "rgba(224,176,128,0.35)",
                    }}>{i + 1}</span>
                    <span style={{
                      minWidth:"3ch", fontFamily:"var(--font-mono)", fontWeight:700,
                      fontSize:"clamp(0.7rem,1.1vw,1.1rem)",
                      color: (shifts[s.id] ?? 0) > 0 ? "#5fd0c0" : (shifts[s.id] ?? 0) < 0 ? "#ff8a80" : "rgba(255,255,255,0.35)",
                    }}>{formatShift(shifts[s.id] ?? 0)}</span>
                    {s.teamId && <TeamIcon teamId={s.teamId} size={22} strokeWidth={1.5} />}
                    <span style={{
                      flex:1, minWidth:0, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis",
                      fontSize:"clamp(0.8rem,1.4vw,1.4rem)",
                      fontWeight:700, color:accent, letterSpacing:"0.04em",
                    }}>{s.name}</span>
                    <span style={{
                      fontFamily:"var(--font-mono)", fontWeight:900,
                      fontSize:"clamp(0.9rem,1.7vw,1.7rem)",
                      color:"rgba(255,255,255,0.92)", letterSpacing:"0.05em",
                    }}>{s.points}</span>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {view === "teamChart" && (() => {
          const data = timeData
          const lines = sorted.map(t => ({ id:t.id, name:t.name, color:t.color, iconTeamId:t.id }))
          return (
            <div style={{ flex:1, display:"flex", flexDirection:"column", maxWidth:1100, margin:"0 auto", width:"100%" }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data} margin={{ top:10, right:230, bottom:50, left:10 }}>
                  <CartesianGrid strokeDasharray="4 4" stroke="rgba(255,255,255,0.08)" />
                  <XAxis
                    dataKey="time"
                    tick={{ fill:"rgba(255,255,255,0.75)", fontSize:18, fontFamily:"var(--font-mono)" }}
                    tickLine={false} axisLine={{ stroke:"rgba(255,255,255,0.12)" }}
                    angle={-35} textAnchor="end" height={70}
                    interval={Math.max(0, Math.floor(data.length / 6))}
                    tickFormatter={formatTimeOnly}
                  />
                  <YAxis
                    tick={{ fill:"rgba(255,255,255,0.75)", fontSize:18, fontFamily:"var(--font-mono)" }}
                    tickLine={false} axisLine={{ stroke:"rgba(255,255,255,0.12)" }}
                    width={60} domain={["auto", "auto"]}
                  />
                  <RechartsTooltip
                    contentStyle={{ backgroundColor:"rgba(30,5,10,0.95)", border:"1px solid rgba(224,176,128,0.3)", color:"#F2D8B8", borderRadius:6, fontSize:16 }}
                    labelStyle={{ color:"rgba(224,176,128,0.7)", fontSize:"0.9rem" }}
                  />
                  {lines.map(ln => (
                    <Line
                      key={ln.id} type="monotone" dataKey={ln.id} name={ln.name}
                      stroke={ln.color} strokeWidth={4}
                      dot={(props: any) => <EndLabel {...props} lastIndex={data.length - 1} color={ln.color} name={ln.name} iconTeamId={ln.iconTeamId} />}
                      activeDot={{ r:7, fill:ln.color }}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
          )
        })()}
      </div>

      <div style={{
        borderTop:"1px solid rgba(255,255,255,0.08)",
        padding:"8px 24px",
        display:"flex", justifyContent:"space-between", alignItems:"center",
        flexShrink:0,
      }}>
        <span className="ds-overline" style={{ color:"rgba(255,255,255,0.3)", fontSize:"0.72rem" }}>
          AKANO · SCOREBOARD
        </span>
        <div style={{ display:"flex", gap:6, alignItems:"center" }}>
          {VIEWS.map(v => (
            <button key={v} onClick={() => goToView(v)} style={{
              width:8, height:8, borderRadius:"50%", border:"none", cursor:"pointer", padding:0,
              backgroundColor: view === v ? "rgba(255,255,255,0.7)" : "rgba(255,255,255,0.2)",
              transition:"background 0.3s",
            }} />
          ))}
        </div>
        <ClockDisplay />
      </div>
    </div>
  )
}
