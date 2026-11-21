"use client"

import React, { use, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { TooltipProvider } from "@/components/ui/tooltip"
import { GameProvider, useGame } from "@/lib/game-context"
import { GMDashboard } from "@/components/views/gm-dashboard"
import { TeacherDashboard } from "@/components/views/teacher-dashboard"
import { RuzeDashboard } from "@/components/views/ruze-dashboard"
import { StudentDashboard } from "@/components/views/student-dashboard"
import { DisplayScreen } from "@/components/views/display-screen"
import { LibraryView } from "@/components/views/library-view"
import { AlarmBannerStrip } from "@/components/shared/alarm-banner"
import { ToastContainer } from "@/components/shared/toast"
import { TopBar } from "@/components/shared/top-bar"
import { ThemeProvider } from "@/lib/theme-context"
import { ErrorBoundary } from "@/components/shared/error-boundary"

function CharacterRouter() {
  const { currentUser, noActiveRun, logout } = useGame()
  const router = useRouter()

  // Hraní skončilo (žádný aktivní běh): odhlásit, úvodní obrazovka ukáže „nehraje se“.
  useEffect(() => { if (noActiveRun) logout() }, [noActiveRun, logout])

  useEffect(() => {
    if (currentUser === null) {
      sessionStorage.removeItem("ruze-hidden")
      router.replace("/")
    }
  }, [currentUser, router])

  // Růže panic-hide: defaults ON each login (plain student profile), the chip
  // reveals her special access. sessionStorage so a refresh keeps her choice
  // but a fresh login starts back in cover.
  const [ruzeHidden, setRuzeHidden] = useState(true)
  useEffect(() => {
    setRuzeHidden(sessionStorage.getItem("ruze-hidden") !== "0")
  }, [])
  const toggleRuzeHidden = () => setRuzeHidden(v => {
    sessionStorage.setItem("ruze-hidden", v ? "0" : "1")
    return !v
  })

  // Per-role DS ground: student = bone paper (root), růže = hacked terminal, teacher = teal night, GM = ink backstage
  const role = currentUser?.role
  const themeClass =
    role === "teacher" ? "theme-teal" :
    role === "gm"      ? "theme-ink"  :
    role === "ruze"    ? (ruzeHidden ? "" : "theme-ruze") : ""

  // Mirror the theme onto <body>: sheets/selects/dialogs render in portals
  // outside this tree and would otherwise resolve theme vars against :root.
  useEffect(() => {
    if (!themeClass) return
    document.body.classList.add(themeClass)
    return () => document.body.classList.remove(themeClass)
  }, [themeClass])

  if (!currentUser) return null
  if (role === "display") return <DisplayScreen />
  if (role === "library") {
    return (
      <div style={{ minHeight:"100vh", backgroundColor:"var(--c-bg)", color:"var(--c-text)" }}>
        <LibraryView />
      </div>
    )
  }

  return (
    <div className={themeClass} style={{ minHeight:"100vh", backgroundColor:"var(--c-bg)", color:"var(--c-text)" }}>
      <AlarmBannerStrip />
      <TopBar showBroadcast={["gm","teacher","ruze"].includes(role ?? "")} ruzeHidden={ruzeHidden} />
      {role === "student" || role === "ruze" ? (
        <>
          {role === "student"
            ? <StudentDashboard />
            : <RuzeDashboard hidden={ruzeHidden} onToggle={toggleRuzeHidden} />}
          <ToastContainer />
        </>
      ) : (
        <>
          <div style={{ maxWidth:1400, margin:"0 auto", padding:"24px 16px" }}>
            {role === "gm"      && <GMDashboard />}
            {role === "teacher" && <TeacherDashboard />}
          </div>
          <ToastContainer />
        </>
      )}
    </div>
  )
}

export default function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <TooltipProvider>
          <GameProvider initialUserId={id}>
            <CharacterRouter />
          </GameProvider>
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  )
}
