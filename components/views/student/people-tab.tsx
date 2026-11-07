"use client"

import { TEAMS, CHARACTERS } from "@/lib/data"
import { TeamIcon } from "@/components/shared/team-icon"
import { SpecBadge, RoleBadge } from "@/components/shared/badges"
import { PersonCard } from "./person-card"

export function PeopleTab({ studentId }: { studentId: string }) {
  return (
    <div style={{ display:"flex", flexDirection:"column", gap:20 }}>
      {TEAMS.map(t => {
        const members = CHARACTERS.filter(c => c.teamId === t.id && (c.role === "student" || c.role === "ruze"))
        if (!members.length) return null
        return (
          <div key={t.id}>
            <div style={{ display:"flex", alignItems:"center", gap:7, marginBottom:8 }}>
              <TeamIcon teamId={t.id} size={16} />
              <span style={{ fontSize:"0.72rem", fontWeight:700, letterSpacing:"0.08em", color:"var(--c-text-muted)" }}>{t.name.toUpperCase()}</span>
            </div>
            <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
              {members.map(c => (
                <PersonCard key={c.id} name={c.name} isYou={c.id === studentId} badge={<SpecBadge spec={c.specialization} />} />
              ))}
            </div>
          </div>
        )
      })}
      <div>
        <div style={{ marginBottom:8 }}><span style={{ fontSize:"0.72rem", fontWeight:700, letterSpacing:"0.08em", color:"var(--c-text-muted)" }}>DOSPĚLÍ</span>        </div>
        <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
          {CHARACTERS.filter(c => c.role === "teacher" || c.role === "gm").map(c => (
            <PersonCard key={c.id} name={c.name} compact badge={<RoleBadge role={c.role} />} />
          ))}
        </div></div>
    </div>
  )
}