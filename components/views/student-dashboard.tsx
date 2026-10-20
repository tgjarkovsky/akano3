"use client"

import React, { useState, useMemo } from "react"
import { IconUsers, IconTrophy, IconList, IconChartLine, IconBooks } from "@tabler/icons-react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useGame } from "@/lib/game-context"
import { standingOf } from "@/lib/standing"
import { ScoreboardComponent } from "@/components/panels/scoreboard"
import { ChartsPanel } from "@/components/panels/charts"
import { WikiPanel } from "@/components/panels/wiki"
import { StudentHeader } from "./student/student-header"
import { PeopleTab } from "./student/people-tab"
import { HistoryTab } from "./student/history-tab"
import { StudentActionsTab } from "./student/student-actions-tab"

const TABS: [string, string, React.ElementType][] = [
  ["scoreboard","Žebříček", IconTrophy],
  ["people",    "Lidé",     IconUsers],
  ["history",   "Moje body", IconList],
  ["wiki",      "Informace", IconBooks],
]

export function StudentDashboard() {
  const { currentUser, characters, teams } = useGame()
  const student  = characters.find(c => c.id === currentUser?.id)
  const team     = teams.find(t => t.id === student?.teamId)
  const teamRank = useMemo(() => [...teams].sort((a,b)=>b.points-a.points).findIndex(t=>t.id===student?.teamId) + 1, [teams, student?.teamId])

  const playerStanding = useMemo(
    () => standingOf(student?.id ?? "", characters.filter(c => c.role === "student" || c.role === "ruze")),
    [characters, student?.id],
  )
  const teamStanding = useMemo(() => standingOf(student?.teamId ?? "", teams), [teams, student?.teamId])

  const [sbView, setSbView] = useState<"table" | "chart">("table")
  const [sbMode, setSbMode] = useState<"students" | "teams" | "units" | "circles">("teams")

  if (!student) return null

  return (
    <div style={{ maxWidth: 860, margin: "0 auto", display: "flex", flexDirection: "column", minHeight: "100dvh" }}>
      <StudentHeader student={student} team={team} teamRank={teamRank} playerStanding={playerStanding} teamStanding={teamStanding} />

      <Tabs defaultValue="scoreboard" style={{ flex:1, display:"flex", flexDirection:"column" }}>
        <TabsList style={{
          display:"grid", gridTemplateColumns:"repeat(4,1fr)",
          backgroundColor:"var(--c-topbar)",
          borderBottom:"2px solid var(--c-border)",
          borderRadius:0, padding:0, height:"auto",
          width:"100%",
        }}>
          {TABS.map(([v, label, Icon]) => (
            <TabsTrigger
              key={v}
              value={v}
              style={{
                display:"flex", flexDirection:"row", alignItems:"center", justifyContent:"center",
                gap:8, padding:"10px 16px", minHeight:48,
                fontSize:"0.82rem", fontWeight:700, borderRadius:0,
                color:"var(--c-text-muted)",
                letterSpacing:"0.02em",
              }}
            >
              <Icon size={18} />
              {label}
            </TabsTrigger>
          ))}
        </TabsList>

        <div style={{ padding:"20px 24px 40px" }}>

          {/* ŽEBŘÍČEK */}
          <TabsContent value="scoreboard">
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14 }}>
              <p style={{ fontSize:"0.72rem", letterSpacing:"0.09em", color:"var(--c-text-muted)", margin:0 }}>AKTUÁLNÍ ŽEBŘÍČEK</p>
              <div style={{ display:"flex", gap:4 }}>
                {(["table","chart"] as const).map(v => (
                  <button key={v} onClick={() => setSbView(v)} style={{
                    all:"unset", boxSizing:"border-box",
                    padding:"5px 10px", borderRadius:8, cursor:"pointer",
                    backgroundColor: sbView === v ? "var(--c-accent)" : "transparent",
                    color: sbView === v ? "#F4ECDF" : "var(--c-text-muted)",
                    border: `1px solid ${sbView === v ? "var(--c-accent)" : "var(--c-border-mid)"}`,
                    display:"flex", alignItems:"center",
                  }}>
                    {v === "table" ? <IconList size={16} /> : <IconChartLine size={16} />}
                  </button>
                ))}
              </div>
            </div>
            {sbView === "table"
              ? <ScoreboardComponent
                  mode={sbMode}
                  showModeToggle
                  onModeChange={setSbMode}
                  highlightId={sbMode === "students" ? student.id : student.teamId}
                />
              : <ChartsPanel />
            }
          </TabsContent>

          <TabsContent value="people"><PeopleTab studentId={student.id} /></TabsContent>
          <TabsContent value="history"><HistoryTab studentId={student.id} /></TabsContent>

          <TabsContent value="wiki">
            <WikiPanel characterId={student.id} kaichiLevel={student.kaichiLevel ?? 0} />
          </TabsContent>

          {/* AKCE — kept in code, tab trigger removed from UI */}
          <TabsContent value="actions"><StudentActionsTab student={student} team={team} /></TabsContent>

        </div>
      </Tabs>
    </div>
  )
}
