"use client"

import { useState } from "react"
import {
  IconDashboard, IconList, IconChartLine, IconUsers, IconBell, IconBooks,
} from "@tabler/icons-react"
import { Tabs, TabsContent } from "@/components/ui/tabs"
import { ScoreboardComponent, type ScoreMode } from "@/components/panels/scoreboard"
import { PointAssignmentSheet, DashboardTabsList, SectionCard, type DashboardTab } from "@/components/shared/dashboard-parts"
import { TransactionLog } from "@/components/panels/transaction-log"
import { ChartsPanel } from "@/components/panels/charts"
import { PeoplePanel } from "@/components/panels/people"
import { AlarmPanel } from "@/components/panels/alarm"
import { WikiPanel } from "@/components/panels/wiki"
import { useGame } from "@/lib/game-context"

const tabs: DashboardTab[] = [
  { value:"overview", label:"Přehled",   Icon:IconDashboard },
  { value:"log",      label:"Log",       Icon:IconList },
  { value:"charts",   label:"Grafy",     Icon:IconChartLine },
  { value:"people",   label:"Lidé",      Icon:IconUsers },
  { value:"alarm",    label:"Alarm",     Icon:IconBell },
  { value:"wiki",     label:"Informace", Icon:IconBooks },
]

export function TeacherDashboard() {
  const { currentUser, characters } = useGame()
  const teacher = characters.find(c => c.id === currentUser?.id)
  const [sbMode,    setSbMode]    = useState<ScoreMode>("teams")

  return (
    <div>
      {/* Růže leaves traces in the system — rare faint rose blip */}
      <img src="/ruze-rose.png" alt="" className="rose-ambient" />
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:20 }}>
        <h1 style={{ color:"var(--c-text)", fontSize:"1.5rem", fontWeight:700 }}>
          Učitelský přehled
        </h1>
        <PointAssignmentSheet />
      </div>

      <Tabs defaultValue="overview">
        <DashboardTabsList tabs={tabs} />

        <TabsContent value="overview">
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:20 }}>
            <SectionCard title="ŽEBŘÍČEK">
              <ScoreboardComponent mode={sbMode} compact showModeToggle onModeChange={setSbMode} />
            </SectionCard>
            <SectionCard title="POSLEDNÍ AKCE">
              <TransactionLog maxRows={8} hideFilters />
            </SectionCard>
          </div>
        </TabsContent>
        <TabsContent value="log"><TransactionLog /></TabsContent>
        <TabsContent value="charts"><ChartsPanel /></TabsContent>
        <TabsContent value="people"><PeoplePanel /></TabsContent>
        <TabsContent value="alarm"><AlarmPanel /></TabsContent>
        <TabsContent value="wiki">
          {teacher
            ? <WikiPanel characterId={teacher.id} kaichiLevel={teacher.kaichiLevel ?? 0} />
            : <p style={{ color:"var(--c-text-muted)", textAlign:"center", padding:"40px 0" }}>Postava nenalezena.</p>}
        </TabsContent>
      </Tabs>
    </div>
  )
}

