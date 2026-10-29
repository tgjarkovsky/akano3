"use client"

import React, { useState, useMemo } from "react"
import {
  IconPlus, IconDashboard, IconList, IconChartLine, IconStar,
  IconQrcode, IconBell, IconSettings, IconTrophy, IconRepeat, IconBook,
} from "@tabler/icons-react"
import { Tabs, TabsContent } from "@/components/ui/tabs"
import { useGame } from "@/lib/game-context"
import { ScoreboardComponent, type ScoreMode } from "@/components/panels/scoreboard"
import { PointAssignmentForm } from "@/components/panels/point-assignment"
import { PointAssignmentSheet, DashboardTabsList, SectionCard, type DashboardTab } from "@/components/shared/dashboard-parts"
import { TransactionLog } from "@/components/panels/transaction-log"
import { ChartsPanel } from "@/components/panels/charts"
import { KaichiPanel } from "@/components/panels/kaichi"
import { AlarmPanel } from "@/components/panels/alarm"
import { QRPanel } from "@/components/panels/qr"
import { GameSetupPanel } from "@/components/panels/game-setup"
import { RunSetupPanel } from "@/components/panels/run-setup"
import { WikiAdminPanel } from "@/components/panels/wiki-admin"

const tabs: DashboardTab[] = [
  { value:"overview", label:"Přehled",       Icon:IconDashboard },
  { value:"points",   label:"Zadávání bodů", Icon:IconPlus },
  { value:"log",      label:"Log",           Icon:IconList },
  { value:"charts",   label:"Grafy",         Icon:IconChartLine },
  { value:"kaichi",   label:"Kaichi",        Icon:IconStar },
  { value:"qr",       label:"QR kódy",       Icon:IconQrcode },
  { value:"alarm",    label:"Alarm",         Icon:IconBell },
  { value:"runs",     label:"Běhy",          Icon:IconRepeat },
  { value:"wiki",     label:"Wiki",          Icon:IconBook },
  { value:"settings", label:"Nastavení",     Icon:IconSettings },
]

export function GMDashboard() {
  const { teams, alarmState, qrCodes, runs, activeRunId, setActiveRun } = useGame()
  const [sbMode,    setSbMode]    = useState<ScoreMode>("teams")

  const sorted    = useMemo(() => [...teams].sort((a,b) => b.points - a.points), [teams])
  const leader    = sorted[0]
  const activeQRs = useMemo(() => qrCodes.filter(q => q.status === "active").length, [qrCodes])
  const activeRun = useMemo(() => runs.find(r => r.id === activeRunId), [runs, activeRunId])

  const statCard = (icon: React.ElementType, label: string, value: string | number, accent?: string) => {
    const Icon = icon
    const color = accent ?? "#E0B080"
    return (
      <div style={{
        backgroundColor:"var(--c-bg-card)", borderRadius:10, padding:"16px 20px",
        display:"flex", alignItems:"center", gap:14,
        border:"1px solid var(--c-border)",
        boxShadow:"0 1px 4px rgba(0,0,0,0.08)",
      }}>
        <div style={{ backgroundColor: color + "18", padding:10, borderRadius:8, color }}>
          <Icon size={22} />
        </div>
        <div>
          <p style={{ color:"var(--c-text-muted)", fontSize:"0.72rem", letterSpacing:"0.08em", marginBottom:2 }}>{label}</p>
          <p style={{ color:"var(--c-text)", fontWeight:900, fontSize:"1.3rem", fontFamily:"monospace", lineHeight:1 }}>{value}</p>
        </div>
      </div>
    )
  }

  return (
    <div>
      {/* Růže leaves traces in the system — rare faint rose blip */}
      <img src="/ruze-rose.png" alt="" className="rose-ambient" />
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:20 }}>
        <div style={{ display:"flex", alignItems:"center", gap:12 }}>
          <h1 style={{ color:"var(--c-text)", fontSize:"1.5rem", fontWeight:700 }}>
            Velitelský přehled
          </h1>
          {runs.length > 0 && (
            <div style={{ display:"flex", alignItems:"center", gap:6 }}>
              <select
                value={activeRunId ?? ""}
                onChange={e => setActiveRun(Number(e.target.value))}
                style={{
                  backgroundColor:"var(--c-bg-card)", border:"1px solid var(--c-border)",
                  borderRadius:6, color:"var(--c-text)", fontSize:"0.85rem",
                  padding:"5px 10px", cursor:"pointer",
                }}
              >
                {runs.map(r => (
                  <option key={r.id} value={r.id}>{r.name}</option>
                ))}
              </select>
              {activeRun && (
                <span style={{
                  backgroundColor:"rgba(47,125,79,0.15)", color:"var(--c-success)",
                  border:"1px solid rgba(47,125,79,0.3)", fontSize:"0.72rem",
                  padding:"3px 10px", borderRadius:20, fontWeight:700,
                }}>
                  AKTIVNÍ
                </span>
              )}
            </div>
          )}
        </div>
        <PointAssignmentSheet canCorrect />
      </div>

      <Tabs defaultValue="overview">
        <DashboardTabsList tabs={tabs} wrap />

        <TabsContent value="overview">
          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(200px,1fr))", gap:12, marginBottom:24 }}>
            {statCard(IconTrophy, "Vedoucí tým",  leader?.name ?? "—")}
            {statCard(IconQrcode, "Aktivní QR",    activeQRs, "#d4a017")}
            {statCard(IconBell,   "Alarm",         alarmState.active ? "AKTIVNÍ" : "Klid", alarmState.active ? "#D96A5C" : "#5BBF87")}
          </div>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:20 }}>
            <SectionCard title="ŽEBŘÍČEK TÝMŮ">
              <ScoreboardComponent mode={sbMode} compact showModeToggle onModeChange={setSbMode} />
            </SectionCard>
            <SectionCard title="POSLEDNÍCH 5 AKCÍ">
              <TransactionLog maxRows={5} />
            </SectionCard>
          </div>
        </TabsContent>

        <TabsContent value="points">
          <div style={{ maxWidth:520 }}><PointAssignmentForm canCorrect /></div>
        </TabsContent>
        <TabsContent value="log"><TransactionLog canExport /></TabsContent>
        <TabsContent value="charts"><ChartsPanel /></TabsContent>
        <TabsContent value="kaichi"><KaichiPanel canEdit /></TabsContent>
        <TabsContent value="qr"><QRPanel /></TabsContent>
        <TabsContent value="alarm"><AlarmPanel /></TabsContent>
        <TabsContent value="runs"><RunSetupPanel /></TabsContent>
        <TabsContent value="wiki"><WikiAdminPanel /></TabsContent>
        <TabsContent value="settings"><GameSetupPanel /></TabsContent>
      </Tabs>
    </div>
  )
}
