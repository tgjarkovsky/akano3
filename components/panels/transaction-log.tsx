"use client"

import React, { useState, useMemo } from "react"
import { IconSearch, IconX, IconDownload } from "@tabler/icons-react"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useGame } from "@/lib/game-context"
import { TEAMS, CHARACTERS } from "@/lib/data"
import { ACTION_LABELS } from "@/lib/constants"
import { formatDateTime, getCharName, getTargetName, getTeamName } from "@/lib/utils"
import { ActionBadge, RoleBadge } from "@/components/shared/badges"
import { TeamDot } from "@/components/shared/team-icon"
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { downloadText } from "@/lib/download"
import { buildReversal,isReversal, isReversed } from "@/lib/point-resolution"
import type { PointEntry } from "@/lib/types"

// Růže masquerade: her entries display a fake teacher (deterministic per entry
// id, stable across renders/devices) and occasionally glitch pink to reveal her.
const TEACHERS = CHARACTERS.filter(c => c.role === "teacher")
const hashId = (s: string) => { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return Math.abs(h) }

function SourceCell({ id, sourceCharacterId, sourceRole }: { id: string; sourceCharacterId: string; sourceRole: import("@/lib/types").Role }) {
  if (sourceRole !== "ruze") {
    return <>{getCharName(sourceCharacterId)}<RoleBadge role={sourceRole} /></>
  }
  const h = hashId(id)
  const fake = TEACHERS[h % TEACHERS.length]
  // randomized cycle per entry: 7–13s period, phase-shifted — rows blip out of sync
  const timing = { animationDuration: `${7 + (h % 7)}s`, animationDelay: `${(h >> 3) % 13}s` }
  return (
    <span style={{ position:"relative", display:"inline-flex", alignItems:"center" }}>
      <span className="mask-blip" style={timing}>{fake?.name ?? "???"}</span>
      <img src="/ruze-rose.png" alt="" className="mask-blip-rose" style={timing} />
      <RoleBadge role="teacher" />
    </span>
  )
}

export function TransactionLog({
  maxRows, canExport = false, hideFilters = false,
}: {
  maxRows?: number; canExport?: boolean; hideFilters?: boolean
}) {
  const { pointLog, currentUser, assignPoints } = useGame()
  const isGM = currentUser?.role === "gm"
  const [reversing, setReversing] = useState<PointEntry | null>(null)
  const [filterRole,   setFilterRole]   = useState("")
  const [filterAction, setFilterAction] = useState("")
  const [filterTeam,   setFilterTeam]   = useState("")
  const [search,       setSearch]       = useState("")

  const filtered = useMemo(() => {
    let rows = [...pointLog]
    if (filterRole)   rows = rows.filter(e => e.sourceRole === filterRole)
    if (filterAction) rows = rows.filter(e => e.actionType === filterAction)
    if (filterTeam)   rows = rows.filter(e => e.resolvedTeamIds.includes(filterTeam))
    if (search)       rows = rows.filter(e =>
      (e.note ?? "").toLowerCase().includes(search.toLowerCase()) ||
      getCharName(e.sourceCharacterId).toLowerCase().includes(search.toLowerCase())
    )
    if (maxRows) rows = rows.slice(0, maxRows)
    return rows
  }, [pointLog, filterRole, filterAction, filterTeam, search, maxRows])

  const handleExport = () => {
    const header = "Čas,Kdo,Role,Typ,Cíl,Týmy,Body,Poznámka"
    const rows = filtered.map(e =>
      [formatDateTime(e.timestamp), getCharName(e.sourceCharacterId), e.sourceRole,
       ACTION_LABELS[e.actionType], getTargetName(e.targetType, e.targetId),
       e.resolvedTeamIds.map(getTeamName).join("|"), e.amount, e.note ?? ""].join(",")
    )
    downloadText("akano3-log.csv", [header, ...rows].join("\n"))
  }

  const confirmReversal = () => {
    if (!reversing || !currentUser) return
    assignPoints({ sourceRole: currentUser.role, sourceCharacterId: currentUser.id, ...buildReversal(reversing) })
    setReversing(null)
  }

  const filterStyle = { backgroundColor:"var(--c-input)", border:"1px solid var(--c-input-border)", fontSize:"0.8rem", height:32, color:"var(--c-text)" }

  return (
    <div>
      {!hideFilters && (
        <div style={{ display:"flex", flexWrap:"wrap", gap:8, marginBottom:16, alignItems:"center" }}>
          <div style={{ position:"relative", flex:"1 1 160px" }}>
            <IconSearch size={13} style={{ position:"absolute", left:8, top:"50%", transform:"translateY(-50%)", color:"var(--c-text-muted)" }} />
            <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Hledat…"
              style={{ ...filterStyle, paddingLeft:28 }} />
          </div>
          <Select value={filterRole} onValueChange={(v) => setFilterRole(v ?? "")}>
            <SelectTrigger style={{ ...filterStyle, minWidth:120 }}><SelectValue placeholder="Role" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="">Všechny role</SelectItem>
              {["gm","teacher","ruze","student"].map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filterAction} onValueChange={(v) => setFilterAction(v ?? "")}>
            <SelectTrigger style={{ ...filterStyle, minWidth:160 }}><SelectValue placeholder="Typ akce" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="">Všechny typy</SelectItem>
              {Object.entries(ACTION_LABELS).map(([k,v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filterTeam} onValueChange={(v) => setFilterTeam(v ?? "")}>
            <SelectTrigger style={{ ...filterStyle, minWidth:120 }}><SelectValue placeholder="Tým" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="">Všechny týmy</SelectItem>
              {TEAMS.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
            </SelectContent>
          </Select>
          {(filterRole || filterAction || filterTeam || search) && (
            <button onClick={() => { setFilterRole(""); setFilterAction(""); setFilterTeam(""); setSearch("") }}
              style={{ background:"transparent", border:"1px solid var(--c-border-str)", color:"var(--c-text-muted)",
                padding:"4px 10px", borderRadius:6, cursor:"pointer", fontSize:"0.75rem" }}>
              <IconX size={11} style={{display:"inline",marginRight:4}} />Smazat filtry
            </button>
          )}
          {canExport && (
            <button onClick={handleExport} style={{
              marginLeft:"auto", background:"color-mix(in srgb, var(--c-teal) 13%, transparent)", border:"1px solid color-mix(in srgb, var(--c-teal) 38%, transparent)",
              color:"var(--c-teal)", padding:"4px 12px", borderRadius:6, cursor:"pointer", fontSize:"0.8rem",
              display:"flex", alignItems:"center", gap:6,
            }}>
              <IconDownload size={13} /> Export CSV
            </button>
          )}
        </div>
      )}

      <div style={{ overflowX:"auto" }}>
        <Table>
          <TableHeader>
            <TableRow style={{ borderColor:"var(--c-border)" }}>
              {["Čas","Kdo","Typ akce","Cíl","Týmy","Body","Poznámka", ...(isGM ? ["Akce"] : [])].map(h => (
                <TableHead key={h} style={{ color:"var(--c-text-muted)", fontSize:"0.75rem", letterSpacing:"0.05em" }}>{h}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={isGM ? 8 : 7} style={{ textAlign:"center", color:"var(--c-text-faint)", padding:"32px 0" }}>
                  Žádné záznamy
                </TableCell>
              </TableRow>
            )}
            {filtered.map(e => (
              <TableRow key={e.id} style={{ borderColor:"var(--c-border)" }}>
                <TableCell style={{ color:"var(--c-text-muted)", fontSize:"0.78rem", whiteSpace:"nowrap", fontFamily:"monospace" }}>
                  {formatDateTime(e.timestamp)}
                </TableCell>
                <TableCell style={{ color:"var(--c-text)", fontSize:"0.82rem" }}>
                  <SourceCell id={e.id} sourceCharacterId={e.sourceCharacterId} sourceRole={e.sourceRole} />
                </TableCell>
                <TableCell><ActionBadge type={e.actionType} /></TableCell>
                <TableCell style={{ color:"var(--c-text)", fontSize:"0.82rem" }}>
                  {getTargetName(e.targetType, e.targetId)}
                </TableCell>
                <TableCell style={{ color:"var(--c-accent)", fontSize:"0.8rem" }}>
                  {e.resolvedTeamIds.map(t => (
                    <span key={t} style={{ display:"inline-flex", alignItems:"center", marginRight:4 }}>
                      <TeamDot color={TEAMS.find(tm=>tm.id===t)?.color??"#888"} teamId={t} />
                      {getTeamName(t)}
                    </span>
                  ))}
                </TableCell>
                <TableCell style={{ fontWeight:700, fontFamily:"monospace", color: e.amount > 0 ? "var(--c-success)" : "var(--destructive)" }}>
                  {e.amount > 0 ? "+" : ""}{e.amount}
                </TableCell>
                <TableCell style={{ color:"var(--c-text-muted)", fontSize:"0.78rem", maxWidth:200 }}>
                  {e.note ?? "—"}
                </TableCell>
                {isGM && (
                  <TableCell>
                    {!isReversal(e) && !isReversed(e, pointLog) && (
                      <button onClick={() => setReversing(e)}
                        style={{ background:"transparent", border:"1px solid var(--c-border-str)", color:"var(--c-text-muted)",
                          padding:"2px 8px", borderRadius:6, cursor:"pointer", fontSize:"0.72rem" }}>
                        Stornovat
                      </button>
                    )}
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <p style={{ color:"var(--c-text-faint)", fontSize:"0.72rem", marginTop:8 }}>
        {filtered.length} záznamů
      </p>
      <AlertDialog open={!!reversing} onOpenChange={(open) => { if (!open) setReversing(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Stornovat záznam?</AlertDialogTitle>
            <AlertDialogDescription>
              {reversing && `Vytvoří se protizáznam ${-reversing.amount > 0 ? "+" : ""}${-reversing.amount} pro ${getTargetName(reversing.targetType, reversing.targetId)}.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Zrušit</AlertDialogCancel>
            <AlertDialogAction onClick={confirmReversal}>Stornovat</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
