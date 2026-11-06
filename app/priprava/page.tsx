"use client"

import React, { useEffect, useState } from "react"
import { TooltipProvider } from "@/components/ui/tooltip"
import { GameProvider } from "@/lib/game-context"
import { ErrorBoundary } from "@/components/shared/error-boundary"
import { PripravaLogin, OrganizerPicker } from "@/components/views/priprava/priprava-login"
import { PripravaShell } from "@/components/views/priprava/priprava-shell"
import { getAdminToken, setAdminToken, verifyAdminToken, getOrganizer, setOrganizer } from "@/lib/admin-client"

// Příprava hry: texty, běhy, obsazení, knihovna. Oddělená od Velínu
// (/character/GM1), aby GM během hry nemohl omylem měnit přípravu.
// Heslo = ADMIN_TOKEN, ověřuje ho server u každého zápisu.

type Gate = "checking" | "login" | "organizer" | "ready"

export default function PripravaPage() {
  const [gate, setGate] = useState<Gate>("checking")
  const [organizer, setOrganizerState] = useState<string | null>(null)

  // Tmavý podklad i pro portály (dialogy, selecty), které se kreslí mimo strom.
  useEffect(() => {
    document.body.classList.add("theme-ink")
    return () => document.body.classList.remove("theme-ink")
  }, [])

  useEffect(() => {
    const token = getAdminToken()
    const name = getOrganizer()
    setOrganizerState(name)
    if (!token) { setGate("login"); return }
    // Heslo se mezitím na serveru mohlo změnit, ověř uložené znovu.
    verifyAdminToken(token).then(err => {
      if (err) { setAdminToken(null); setGate("login") }
      else setGate(name ? "ready" : "organizer")
    })
  }, [])

  const handleLogin = (token: string) => {
    setAdminToken(token)
    setGate(organizer ? "ready" : "organizer")
  }

  const handlePick = (name: string) => {
    setOrganizer(name)
    setOrganizerState(name)
    setGate("ready")
  }

  const handleLogout = () => {
    setAdminToken(null)
    setGate("login")
  }

  return (
    <ErrorBoundary>
      <div className="theme-ink" style={{ minHeight: "100vh", backgroundColor: "var(--c-bg)", color: "var(--c-text)" }}>
        {gate === "checking" && null}
        {gate === "login" && <PripravaLogin onLogin={handleLogin} />}
        {gate === "organizer" && <OrganizerPicker onPick={handlePick} />}
        {gate === "ready" && organizer && (
          <TooltipProvider>
            {/* GM1 jen kvůli načítání stavu hry (běhy, týmy, kruhy). Oprávnění
                k zápisu dává heslo, ne tahle postava. */}
            <GameProvider initialUserId="GM1">
              <PripravaShell
                organizer={organizer}
                onChangeOrganizer={() => setGate("organizer")}
                onLogout={handleLogout}
              />
            </GameProvider>
          </TooltipProvider>
        )}
      </div>
    </ErrorBoundary>
  )
}
