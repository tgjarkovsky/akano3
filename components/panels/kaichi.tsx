"use client"

import React, { useState, useMemo } from "react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useGame } from "@/lib/game-context"
import { TEAMS } from "@/lib/data"
import { romanNumeral, getTeamName } from "@/lib/utils"
import { KaichiBadge } from "@/components/shared/badges"
import { TeamDot } from "@/components/shared/team-icon"

const LEVELS = [0,1,2,3,4,5,6,7,8]

export function KaichiPanel({ canEdit = false }: { canEdit?: boolean }) {
  const { characters, updateKaichi } = useGame()
  const [filterTeam, setFilterTeam]   = useState("")
  const [pending,    setPending]       = useState<{ id: string; level: number } | null>(null)

  const students = useMemo(() =>
    characters
      .filter(c => c.role === "student")
      .filter(c => !filterTeam || c.teamId === filterTeam)
      .sort((a,b) => b.kaichiLevel - a.kaichiLevel)
  , [characters, filterTeam])

  const pendingChar = characters.find(c => c.id === pending?.id)
  const isPromotion = pending && pendingChar ? pending.level > pendingChar.kaichiLevel : false

  function requestChange(characterId: string, level: number) {
    const current = characters.find(c => c.id === characterId)?.kaichiLevel ?? 0
    if (level === current) return
    setPending({ id: characterId, level })
  }

  function confirm() {
    if (!pending) return
    updateKaichi(pending.id, pending.level)
    setPending(null)
  }

  return (
    <div>
      <div style={{ display:"flex", gap:8, marginBottom:16, alignItems:"center" }}>
        <Select value={filterTeam} onValueChange={(v) => setFilterTeam(v ?? "")}>
          <SelectTrigger style={{ backgroundColor:"var(--c-input)", border:"1px solid var(--c-input-border)", maxWidth:180, height:32 }}>
            <SelectValue placeholder="Filtr — Tým" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">Všechny týmy</SelectItem>
            {TEAMS.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div style={{ overflowX:"auto" }}>
        <Table>
          <TableHeader>
            <TableRow style={{ borderColor:"var(--c-border-mid)" }}>
              {["Jméno","Tým","Úroveň Kaichi", ...(canEdit ? ["Změnit"] : [])].map(h => (
                <TableHead key={h} style={{ color:"var(--c-text-muted)", fontSize:"0.75rem", letterSpacing:"0.05em" }}>{h}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {students.map(c => (
              <TableRow key={c.id} style={{ borderColor:"var(--c-border)" }}>
                <TableCell style={{ color:"var(--c-text)", fontWeight:600 }}>{c.name}</TableCell>
                <TableCell>
                  <span style={{ display:"flex", alignItems:"center", gap:6 }}>
                    <TeamDot color={TEAMS.find(t=>t.id===c.teamId)?.color??"#888"} teamId={c.teamId} />
                    {getTeamName(c.teamId ?? "")}
                  </span>
                </TableCell>
                <TableCell><KaichiBadge level={c.kaichiLevel} /></TableCell>
                {canEdit && (
                  <TableCell>
                    <Select
                      value={String(c.kaichiLevel)}
                      onValueChange={v => requestChange(c.id, Number(v))}
                    >
                      <SelectTrigger style={{
                        height:30, fontSize:"0.8rem", width:100,
                        backgroundColor: "var(--c-bg-section)",
                        border:"1px solid var(--c-border-mid)",
                        color:"var(--c-text)",
                      }}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {LEVELS.map(l => (
                          <SelectItem key={l} value={String(l)}>
                            {l === 0 ? "0 — žádný" : `${l} — ${romanNumeral(l)}`}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <AlertDialog open={!!pending} onOpenChange={v => !v && setPending(null)}>
        <AlertDialogContent style={{ backgroundColor:"var(--c-bg-card)", border:"1px solid var(--c-border-mid)" }}>
          <AlertDialogHeader>
            <AlertDialogTitle style={{ color:"var(--c-text)" }}>
              {isPromotion ? "Povýšit Kaichi" : "Snížit Kaichi"}
            </AlertDialogTitle>
            <AlertDialogDescription style={{ color:"var(--c-accent)", fontSize:"0.9rem", lineHeight:1.6 }}>
              Změnit <strong>{pendingChar?.name}</strong>:{" "}
              Kaichi <strong style={{ color:"#d4a017" }}>
                {pendingChar?.kaichiLevel === 0 ? "0" : romanNumeral(pendingChar?.kaichiLevel ?? 0)}
              </strong>
              {" → "}
              <strong style={{ color: isPromotion ? "var(--c-teal)" : "var(--destructive)" }}>
                {pending?.level === 0 ? "0" : romanNumeral(pending?.level ?? 0)}
              </strong>
              {!isPromotion && (
                <><br /><span style={{ fontSize:"0.8rem", color:"var(--c-text-muted)" }}>
                  Snížení kaichi odebere přístup k utajeným informacím.
                </span></>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel style={{ borderColor:"var(--c-border-mid)", color:"var(--c-accent)" }}>Zrušit</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirm}
              style={{
                backgroundColor: isPromotion ? "color-mix(in srgb, var(--c-teal) 13%, transparent)" : "color-mix(in srgb, var(--destructive) 13%, transparent)",
                color: isPromotion ? "var(--c-teal)" : "var(--destructive)",
                border: `1px solid ${isPromotion ? "color-mix(in srgb, var(--c-teal) 38%, transparent)" : "color-mix(in srgb, var(--destructive) 38%, transparent)"}`,
              }}>
              Potvrdit
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
