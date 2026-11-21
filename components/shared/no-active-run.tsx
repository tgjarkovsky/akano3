"use client"

import React from "react"
import { IconPlayerPause } from "@tabler/icons-react"
import { NO_ACTIVE_RUN } from "@/lib/run-status"

// Místo hry, když není aktivní žádný běh (mimo hraní). Žádné herní akce,
// jen vysvětlení; Velín dostane odkaz do Přípravy, kde se běh aktivuje.

export function NoActiveRun({ forGm = false, fullscreen = false }: { forGm?: boolean; fullscreen?: boolean }) {
  return (
    <div role="status" style={{
      minHeight: fullscreen ? "100vh" : "60vh", display: "flex", alignItems: "center", justifyContent: "center",
      padding: "24px 16px", boxSizing: "border-box",
      backgroundColor: fullscreen ? "var(--c-bg)" : undefined,
    }}>
      <div style={{ maxWidth: 440, textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
        <IconPlayerPause size={fullscreen ? 56 : 40} color="var(--c-text-muted)" aria-hidden />
        <h1 style={{ margin: 0, color: "var(--c-text)", fontSize: fullscreen ? "2rem" : "1.4rem", fontWeight: 700 }}>
          {NO_ACTIVE_RUN}
        </h1>
        <p style={{ margin: 0, color: "var(--c-text-muted)", fontSize: "0.95rem", lineHeight: 1.5 }}>
          {forGm
            ? "Body, alarm ani lekce teď nejdou zadávat. Běh se aktivuje v Přípravě (Obsazení → Všechny běhy)."
            : "Hra začne, až organizátoři spustí běh. Stránka se pak sama přepne."}
        </p>
        {forGm && (
          <a href="/priprava" style={{
            marginTop: 4, display: "inline-flex", alignItems: "center", minHeight: 36, padding: "0 14px",
            border: "1px solid var(--c-border-mid)", borderRadius: 6, color: "var(--c-text)",
            fontSize: "0.85rem", fontWeight: 600, textDecoration: "none",
          }}>Do Přípravy</a>
        )}
      </div>
    </div>
  )
}
