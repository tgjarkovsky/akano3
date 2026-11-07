"use client"

import React, { useState, useMemo } from "react"
import { IconSearch } from "@tabler/icons-react"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useGame } from "@/lib/game-context"
import { CIRCLES, TEAMS, UNITS } from "@/lib/data"
import { RoleBadge, KaichiBadge, SpecBadge } from "@/components/shared/badges"
import { TeamDot } from "@/components/shared/team-icon"

export function PeoplePanel() {
  const { characters } = useGame()
  const [search, setSearch] = useState("")

  const term = search.toLowerCase()

  const students = useMemo(() =>
    characters
      .filter(c => c.role === "student" || c.role === "ruze")
      .filter(c => !term || c.name.toLowerCase().includes(term))
      .sort((a, b) => {
        if (a.teamId !== b.teamId) return (a.teamId ?? "").localeCompare(b.teamId ?? "")
        return a.name.localeCompare(b.name, "cs")
      })
  , [characters, term])

  const adults = useMemo(() =>
    characters
      .filter(c => c.role === "teacher" || c.role === "gm")
      .filter(c => !term || c.name.toLowerCase().includes(term))
      .sort((a, b) => {
        const order = { gm:0, teacher:1, ruze:2, student:3, display:4, library:5 }
        const ro = order[a.role] - order[b.role]
        return ro !== 0 ? ro : a.name.localeCompare(b.name, "cs")
      })
  , [characters, term])

  const sectionLabel = (label: string, count: number) => (
    <p style={{ color:"var(--c-accent)", fontSize:"0.8rem", letterSpacing:"0.08em", marginBottom:10, marginTop:24 }}>
      {label} <span style={{ color:"var(--c-text-muted)", fontWeight:400 }}>({count})</span>
    </p>
  )

  return (
    <div>
      <div style={{ position:"relative", maxWidth:320, marginBottom:4 }}>
        <IconSearch size={13} style={{ position:"absolute", left:8, top:"50%", transform:"translateY(-50%)", color:"var(--c-text-muted)" }} />
        <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Hledat…"
          style={{ backgroundColor:"var(--c-input)", border:"1px solid var(--c-input-border)", fontSize:"0.8rem", height:32, paddingLeft:28 }} />
      </div>

      {sectionLabel("STUDENTI", students.length)}
      <div style={{ overflowX:"auto" }}>
        <Table>
          <TableHeader>
            <TableRow style={{ borderColor:"var(--c-border-mid)" }}>
              {["Jméno","Role","Tým","Jednotka","Kruhy","Specializace","Kaichi"].map(h => (
                <TableHead key={h} style={{ color:"var(--c-text-muted)", fontSize:"0.75rem", letterSpacing:"0.05em", whiteSpace:"nowrap" }}>{h}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {students.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} style={{ textAlign:"center", color:"var(--c-text-muted)", padding:"24px 0" }}>Nikdo nenalezen</TableCell>
              </TableRow>
            )}
            {students.map(c => {
              const team    = TEAMS.find(t => t.id === c.teamId)
              const unit    = UNITS.find(u => u.id === c.unitId)
              const circles = CIRCLES.filter(ci => c.circleIds.includes(ci.id))
              return (
                <TableRow key={c.id} style={{ borderColor:"var(--c-border)" }}>
                  <TableCell style={{ fontWeight:600, color:"var(--c-text)", fontSize:"0.85rem", whiteSpace:"nowrap" }}>{c.name}</TableCell>
                  <TableCell><RoleBadge role={c.role} /></TableCell>
                  <TableCell>
                    {team ? (
                      <span style={{ display:"flex", alignItems:"center", gap:6, whiteSpace:"nowrap" }}>
                        <TeamDot color={team.color} teamId={team.id} />
                        {team.name}
                      </span>
                    ) : "—"}
                  </TableCell>
                  <TableCell style={{ color:"var(--c-text)", fontSize:"0.82rem", whiteSpace:"nowrap" }}>{unit?.name ?? "—"}</TableCell>
                  <TableCell style={{ fontSize:"0.78rem", color:"var(--c-text-muted)" }}>
                    {circles.length > 0 ? circles.map(ci => ci.name).join(", ") : "—"}
                  </TableCell>
                  <TableCell><SpecBadge spec={c.specialization} />{!c.specialization && "—"}</TableCell>
                  <TableCell>{c.kaichiLevel > 0 ? <KaichiBadge level={c.kaichiLevel} /> : "—"}</TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>

      {sectionLabel("DOSPĚLÍ", adults.length)}
      <div style={{ overflowX:"auto" }}>
        <Table>
          <TableHeader>
            <TableRow style={{ borderColor:"var(--c-border-mid)" }}>
              {["Jméno","Role"].map(h => (
                <TableHead key={h} style={{ color:"var(--c-text-muted)", fontSize:"0.75rem", letterSpacing:"0.05em" }}>{h}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {adults.length === 0 && (
              <TableRow>
                <TableCell colSpan={2} style={{ textAlign:"center", color:"var(--c-text-muted)", padding:"24px 0" }}>Nikdo nenalezen</TableCell>
              </TableRow>
            )}
            {adults.map(c => (
              <TableRow key={c.id} style={{ borderColor:"var(--c-border)" }}>
                <TableCell style={{ fontWeight:600, color:"var(--c-text)", fontSize:"0.85rem" }}>{c.name}</TableCell>
                <TableCell><RoleBadge role={c.role} /></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
