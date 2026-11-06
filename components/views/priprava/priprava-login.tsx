"use client"

import React, { useState } from "react"
import { IconLock, IconArrowRight, IconUser } from "@tabler/icons-react"
import { verifyAdminToken } from "@/lib/admin-client"
import { ORGANIZERS } from "@/lib/constants"

const panel: React.CSSProperties = {
  width: "100%", maxWidth: 380,
  backgroundColor: "var(--c-bg-card)", border: "1px solid var(--c-border-mid)",
  borderRadius: 10, padding: "28px 24px",
}

const heading: React.CSSProperties = {
  fontFamily: "var(--font-display)", textTransform: "uppercase", letterSpacing: "0.06em",
  fontSize: "1.4rem", fontWeight: 700, color: "var(--c-text)", margin: "0 0 4px",
}

const input: React.CSSProperties = {
  width: "100%", boxSizing: "border-box", minHeight: 44,
  backgroundColor: "var(--c-input)", border: "1px solid var(--c-input-border)",
  borderRadius: 6, color: "var(--c-text)", fontSize: "1rem", padding: "10px 12px",
}

const primary: React.CSSProperties = {
  display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
  width: "100%", minHeight: 44, marginTop: 14,
  backgroundColor: "var(--c-accent)", color: "var(--ink-900, #141210)", border: "none",
  borderRadius: 6, fontWeight: 700, fontSize: "0.95rem", cursor: "pointer",
}

function Screen({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      {children}
    </div>
  )
}

export function PripravaLogin({ onLogin }: { onLogin: (token: string) => void }) {
  const [token, setToken] = useState("")
  const [error, setError] = useState("")
  const [checking, setChecking] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!token.trim()) { setError("Zadej heslo."); return }
    setChecking(true)
    const err = await verifyAdminToken(token.trim())
    setChecking(false)
    if (err) { setError(err); return }
    onLogin(token.trim())
  }

  return (
    <Screen>
      <form onSubmit={submit} style={panel}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
          <img src="/akano-logo.png" alt="" style={{ height: 26, width: "auto" }} />
          <h1 style={heading}>Příprava</h1>
        </div>
        <p style={{ color: "var(--c-text-muted)", fontSize: "0.9rem", margin: "0 0 20px", lineHeight: 1.5 }}>
          Texty postav, běhy a knihovna. Řízení hry zůstává ve Velínu.
        </p>
        <label htmlFor="priprava-heslo" style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "0.8rem", color: "var(--c-text-muted)", marginBottom: 6 }}>
          <IconLock size={14} /> Heslo
        </label>
        <input
          id="priprava-heslo" type="password" autoComplete="current-password" autoFocus
          value={token} onChange={e => { setToken(e.target.value); setError("") }}
          style={input}
        />
        {error && <p role="alert" style={{ color: "var(--destructive, #D96A5C)", fontSize: "0.85rem", margin: "8px 0 0" }}>{error}</p>}
        <button type="submit" disabled={checking} style={{ ...primary, opacity: checking ? 0.6 : 1 }}>
          {checking ? "Ověřuji…" : <>Vstoupit <IconArrowRight size={16} /></>}
        </button>
      </form>
    </Screen>
  )
}

export function OrganizerPicker({ onPick }: { onPick: (name: string) => void }) {
  const [custom, setCustom] = useState("")
  const [error, setError] = useState("")

  const submitCustom = (e: React.FormEvent) => {
    e.preventDefault()
    if (!custom.trim()) { setError("Napiš svoje jméno."); return }
    onPick(custom.trim())
  }

  return (
    <Screen>
      <div style={panel}>
        <h1 style={heading}>Kdo jsi?</h1>
        <p style={{ color: "var(--c-text-muted)", fontSize: "0.9rem", margin: "0 0 18px", lineHeight: 1.5 }}>
          Jméno se ukáže u textů, které označíš jako hotové nebo schválíš. Změnit ho jde kdykoli v hlavičce.
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {ORGANIZERS.map(name => (
            <button key={name} onClick={() => onPick(name)} style={{
              display: "flex", alignItems: "center", gap: 10, minHeight: 44, padding: "0 14px",
              backgroundColor: "var(--c-bg-section)", border: "1px solid var(--c-border-mid)",
              borderRadius: 6, color: "var(--c-text)", fontSize: "0.95rem", cursor: "pointer", textAlign: "left",
            }}>
              <IconUser size={16} color="var(--c-accent)" /> {name}
            </button>
          ))}
        </div>
        <form onSubmit={submitCustom} style={{ marginTop: 18, paddingTop: 16, borderTop: "1px solid var(--c-border)" }}>
          <label htmlFor="priprava-jmeno" style={{ display: "block", fontSize: "0.8rem", color: "var(--c-text-muted)", marginBottom: 6 }}>
            Jiné jméno
          </label>
          <div style={{ display: "flex", gap: 8 }}>
            <input id="priprava-jmeno" value={custom} onChange={e => { setCustom(e.target.value); setError("") }} style={{ ...input, flex: 1 }} />
            <button type="submit" aria-label="Pokračovat" style={{ ...primary, width: 48, marginTop: 0, flexShrink: 0 }}>
              <IconArrowRight size={16} />
            </button>
          </div>
          {error && <p role="alert" style={{ color: "var(--destructive, #D96A5C)", fontSize: "0.85rem", margin: "8px 0 0" }}>{error}</p>}
        </form>
      </div>
    </Screen>
  )
}
