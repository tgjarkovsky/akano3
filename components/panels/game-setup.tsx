"use client"

import React, { useState, useEffect } from "react"
import { IconClock } from "@tabler/icons-react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { useGame } from "@/lib/game-context"
import { UNITS, CIRCLES } from "@/lib/data"
import { getTeamName } from "@/lib/utils"
import { summarizeLessonClaims } from "@/lib/lesson-summary"
import { TeamDot } from "@/components/shared/team-icon"
import type { Character } from "@/lib/types"
import type { PoolRefillMode } from "@/lib/peer-pool"

export function GameSetupPanel() {
  const { lessonWindowActive, lessonWindowEnd, toggleLesson, characters, refillPeerPools } = useGame()
  const [refillAmount, setRefillAmount] = useState(10)
  const [refillMode, setRefillMode] = useState<PoolRefillMode>("add")
  const poolTotal = characters.reduce((sum, c) => sum + (c.role === "student" || c.role === "ruze" ? c.peerPointPool : 0), 0)
  const [duration, setDuration] = useState(30)
  const [timeLeft, setTimeLeft] = useState("")

  useEffect(() => {
    if (!lessonWindowEnd) { setTimeLeft(""); return }
    const interval = setInterval(() => {
      const diff = lessonWindowEnd.getTime() - Date.now()
      if (diff <= 0) { setTimeLeft("Vypršelo"); clearInterval(interval); toggleLesson(false); return }
      const m = Math.floor(diff / 60000)
      const s = Math.floor((diff % 60000) / 1000)
      setTimeLeft(`${m}:${String(s).padStart(2,"0")}`)
    }, 1000)
    return () => clearInterval(interval)
  }, [lessonWindowEnd, toggleLesson])

  const summary = summarizeLessonClaims(characters)

  const nameList = (title: string, list: Character[]) => (
    <div style={{ flex:1 }}>
      <p style={{ color:"var(--c-text-muted)", fontSize:"0.75rem", marginBottom:6 }}>{title} ({list.length})</p>
      {list.map(c => (
        <div key={c.id} style={{ display:"flex", alignItems:"center", gap:6, color:"var(--c-text)", fontSize:"0.85rem", marginBottom:3 }}>
          <TeamDot color="" teamId={c.teamId} />{c.name}
        </div>
      ))}
    </div>
  )

  const section = (title: string, children: React.ReactNode) => (
    <div style={{ backgroundColor:"var(--c-bg-section)", border:"1px solid var(--c-border)",
      borderRadius:10, padding:20, marginBottom:16 }}>
      <p style={{ color:"var(--c-accent)", fontSize:"0.75rem", letterSpacing:"0.1em", marginBottom:14 }}>{title}</p>
      {children}
    </div>
  )

  return (
    <div style={{ maxWidth:600 }}>
      {section("OKNO PRO BODY ZA HODINU",
        <div>
          <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:12 }}>
            <Switch checked={lessonWindowActive} onCheckedChange={v => toggleLesson(v, duration)} />
            <span style={{ color:"var(--c-text)", fontSize:"0.9rem" }}>
              {lessonWindowActive ? "Okno je AKTIVNÍ" : "Okno je zavřeno"}
            </span>
            {lessonWindowActive && timeLeft && (
              <span style={{ backgroundColor:"color-mix(in srgb, var(--c-teal) 13%, transparent)", color:"var(--c-teal)", border:"1px solid color-mix(in srgb, var(--c-teal) 38%, transparent)",
                padding:"2px 10px", borderRadius:20, fontFamily:"monospace", fontSize:"0.85rem", fontWeight:700 }}>
                <IconClock size={12} style={{display:"inline",marginRight:4}} />{timeLeft}
              </span>
            )}
          </div>
          <div style={{ display:"flex", alignItems:"center", gap:8 }}>
            <Label style={{ color:"var(--c-text-muted)", fontSize:"0.8rem", minWidth:80 }}>Délka (min)</Label>
            <Input type="number" value={duration} onChange={e => setDuration(Number(e.target.value))}
              min={5} max={120} style={{ width:80, backgroundColor:"var(--c-input)",
                border:"1px solid var(--c-input-border)", color:"var(--c-text)" }} />
          </div>
          {lessonWindowActive && (
            <div style={{ marginTop:16 }}>
              <p style={{ color:"var(--c-text)", fontSize:"0.9rem", marginBottom:10 }}>
                Uplatnilo {summary.claimed.length} z {summary.total} hráčů
              </p>
              <div style={{ display:"flex", gap:16 }}>
                {nameList("Uplatnili", summary.claimed)}
                {nameList("Ještě ne", summary.pending)}
              </div>
            </div>
          )}
        </div>
      )}

      {section("SESTAVENÍ HRY",
        <div style={{ color:"var(--c-text-muted)", fontSize:"0.85rem", lineHeight:1.6 }}>
          <p>• Jednotky: {UNITS.map(u => `${u.name} (${u.teamIds.map(getTeamName).join(" + ")})`).join(", ")}</p>
          <p style={{marginTop:8}}>• Kruhy: {CIRCLES.map(c => c.name).join(", ")}</p>
          <p style={{marginTop:8, color:"var(--c-text-muted)", fontSize:"0.75rem"}}>
            Přiřazení jednotek a kruhů lze editovat v plné verzi.
          </p>
        </div>
      )}

      {section("POOL BODŮ PRO STUDENTY",
        <div style={{ color:"var(--c-text-muted)", fontSize:"0.85rem" }}>
          <p>Výchozí pool: <strong style={{color:"var(--c-text)"}}>20 bodů</strong> na hráče</p>
          <p style={{marginTop:6}}>Zbývá všem hráčům dohromady: <strong style={{color:"var(--c-text)"}}>{poolTotal} bodů</strong></p>
          <div style={{ display:"flex", alignItems:"center", gap:8, marginTop:12, flexWrap:"wrap" }}>
            <select value={refillMode} onChange={e => setRefillMode(e.target.value as PoolRefillMode)}
              style={{ backgroundColor:"var(--c-input)", border:"1px solid var(--c-input-border)", color:"var(--c-text)",
                borderRadius:6, padding:"6px 8px" }}>
              <option value="add">přidat</option>
              <option value="set">nastavit na</option>
            </select>
            <Input type="number" value={refillAmount} onChange={e => setRefillAmount(Number(e.target.value))}
              min={1} max={100} style={{ width:80, backgroundColor:"var(--c-input)",
                border:"1px solid var(--c-input-border)", color:"var(--c-text)" }} />
            <button onClick={() => refillPeerPools(refillAmount, refillMode)}
              disabled={!Number.isInteger(refillAmount) || refillAmount < 1 || refillAmount > 100}
              style={{ backgroundColor:"var(--c-accent)", color:"var(--c-bg)", border:"none", borderRadius:6,
                padding:"7px 14px", fontSize:"0.85rem", cursor:"pointer" }}>
              Doplnit pool všem hráčům
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
