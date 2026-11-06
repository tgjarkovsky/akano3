"use client"

import React, { useEffect, useState } from "react"
import { TooltipProvider } from "@/components/ui/tooltip"
import { GameProvider } from "@/lib/game-context"
import { ErrorBoundary } from "@/components/shared/error-boundary"
import { PripravaLogin, OrganizerPicker, PasswordSetup } from "@/components/views/priprava/priprava-login"
import { PripravaShell } from "@/components/views/priprava/priprava-shell"
import { getAdminToken, setAdminToken, verifyAdminToken, getOrganizer, setOrganizer, fetchPasswordSet } from "@/lib/admin-client"

// Příprava hry: texty, běhy, obsazení, knihovna. Oddělená od Velínu
// (/character/GM1), aby GM během hry nemohl omylem měnit přípravu.
// Heslo se nastavuje při první návštěvě a ukládá se jako otisk v databázi.
// Server ho ověřuje u každého zápisu.

type Gate = "checking" | "offline" | "setup" | "login" | "organizer" | "ready"

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
    ;(async () => {
      const isSet = await fetchPasswordSet()
      if (isSet === null) { setGate("offline"); return }
      if (!isSet) { setAdminToken(null); setGate("setup"); return }
      if (!token) { setGate("login"); return }
      // Heslo se mezitím mohlo změnit, ověř uložené znovu.
      const err = await verifyAdminToken(token)
      if (err) { setAdminToken(null); setGate("login") }
      else setGate(name ? "ready" : "organizer")
    })()
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
        {gate === "offline" && (
          <p style={{ padding: 24, textAlign: "center", color: "var(--c-text-muted)" }}>
            Server neodpovídá. Zkus stránku obnovit.
          </p>
        )}
        {gate === "setup" && <PasswordSetup onDone={handleLogin} />}
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
