"use client"

import { romanNumeral } from "@/lib/utils"
import { TeamIcon } from "@/components/shared/team-icon"
import type { Standing } from "@/lib/standing"
import type { Character, Team } from "@/lib/types"

const specColors: Record<string, string> = { combat:"#e05252", tactical:"#5268e0", support:"#52d4b4" }

export function StudentHeader({ student, team, teamRank, playerStanding, teamStanding }: {
  student: Character; team?: Team; teamRank: number; playerStanding: Standing | null; teamStanding: Standing | null
}) {
  const specColor = student.specialization ? specColors[student.specialization] : null
  return (
    <div style={{ position:"sticky", top:0, zIndex:20, backgroundColor:"var(--c-topbar)", borderBottom:"1px solid var(--c-border)", padding:"14px 28px 12px", }}>
      <div style={{ display:"flex", alignItems:"center", gap:14 }}>
        {specColor && <div style={{ width:5, alignSelf:"stretch", borderRadius:3, backgroundColor:specColor, flexShrink:0 }} />}
        <div style={{ flex:1, minWidth:0 }}>
          <h1 style={{ fontSize:"1.7rem", fontWeight:900, color:"var(--c-text)", lineHeight:1.1, margin:0 }}>{student.name}</h1>
          {team && (
            <div style={{ display:"flex", alignItems:"center", gap:6, marginTop:4 }}>
              <TeamIcon teamId={team.id} size={15} />
              <span style={{ fontSize:"0.88rem", fontWeight:600, color:"var(--c-text-muted)" }}>{team.name}</span>
              <span style={{ fontSize:"0.78rem", color:"var(--c-text-faint)" }}>#{teamRank}</span>
              {(student.kaichiLevel ?? 0) > 0 && (
                <span style={{ marginLeft:4, width:22, height:22, borderRadius:"50%", border:"1.5px solid #d4a017", backgroundColor:"#1a0a00", display:"inline-flex", alignItems:"center", justifyContent:"center", fontSize:"0.65rem", color:"#d4a017", fontFamily:"monospace", fontWeight:700, }}>
                  {romanNumeral(student.kaichiLevel)}
                </span>
              )}
            </div>
          )}
        </div>
        <div style={{ textAlign:"right", flexShrink:0 }}>
          <p style={{ fontSize:"0.6rem", color:"var(--c-text-muted)", letterSpacing:"0.1em", marginBottom:1 }}>TVÉ BODY</p>
          <p style={{ fontSize:"2.8rem", fontWeight:900, fontFamily:"monospace", color:"var(--c-accent)", lineHeight:1 }}>{student.points ?? 0}</p>
          {playerStanding && <p style={{ fontSize:"0.68rem", color:"var(--c-text-muted)", marginTop:2 }}>{playerStanding.rank}. z {playerStanding.total}</p>}
          <p style={{ fontSize:"0.68rem", color:"var(--c-text-muted)", marginTop:2 }}>tým {team?.points ?? 0} b.{teamStanding && ` · tým ${teamStanding.rank}. z ${teamStanding.total}`}</p>
        </div></div>
    </div>
  )
}