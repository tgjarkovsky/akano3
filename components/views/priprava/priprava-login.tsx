"use client"

import React, { useState } from "react"
import { IconLock, IconArrowRight, IconUser, IconKey, IconCheck } from "@tabler/icons-react"
import { verifyAdminToken, savePassword } from "@/lib/admin-client"
import { ORGANIZERS } from "@/lib/constants"
import { MIN_PASSWORD_LENGTH } from "@/lib/password-hash-rules"

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

// ── Heslo: první nastavení a změna ───────────────────────────────────────

/** Dvě pole (heslo + znovu) se společnou kontrolou. Vrací text chyby nebo null. */
function checkPair(pw: string, again: string): string | null {
  if ([...pw].length < MIN_PASSWORD_LENGTH) return `Heslo musí mít aspoň ${MIN_PASSWORD_LENGTH} znaků.`
  if (pw.trim() !== pw) return "Heslo nesmí začínat ani končit mezerou."
  if (pw !== again) return "Hesla se neshodují."
  return null
}

function PasswordFields({ idPrefix, pw, again, setPw, setAgain, onEdit }: {
  idPrefix: string; pw: string; again: string
  setPw: (v: string) => void; setAgain: (v: string) => void; onEdit: () => void
}) {
  const label: React.CSSProperties = { display: "block", fontSize: "0.8rem", color: "var(--c-text-muted)", margin: "0 0 6px" }
  return (
    <>
      <label htmlFor={`${idPrefix}-nove`} style={label}>Nové heslo</label>
      <input id={`${idPrefix}-nove`} type="password" autoComplete="new-password"
        value={pw} onChange={e => { setPw(e.target.value); onEdit() }} style={input} />
      <p style={{ fontSize: "0.78rem", color: "var(--c-text-faint)", margin: "6px 0 14px" }}>
        Aspoň {MIN_PASSWORD_LENGTH} znaků. Diakritika a mezery uvnitř jsou v pořádku.
      </p>
      <label htmlFor={`${idPrefix}-znovu`} style={label}>Heslo znovu</label>
      <input id={`${idPrefix}-znovu`} type="password" autoComplete="new-password"
        value={again} onChange={e => { setAgain(e.target.value); onEdit() }} style={input} />
    </>
  )
}

export function PasswordSetup({ onDone }: { onDone: (password: string) => void }) {
  const [pw, setPw] = useState("")
  const [again, setAgain] = useState("")
  const [error, setError] = useState("")
  const [saving, setSaving] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    const bad = checkPair(pw, again)
    if (bad) { setError(bad); return }
    setSaving(true)
    const err = await savePassword(pw)
    setSaving(false)
    if (err) { setError(err); return }
    onDone(pw)
  }

  return (
    <Screen>
      <form onSubmit={submit} style={panel}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
          <IconKey size={22} color="var(--c-accent)" />
          <h1 style={heading}>Nastav heslo</h1>
        </div>
        <p style={{ color: "var(--c-text-muted)", fontSize: "0.9rem", margin: "0 0 20px", lineHeight: 1.5 }}>
          Příprava zatím heslo nemá. To, které teď zadáš, budou používat všichni organizátoři.
          Změnit ho jde později v Přehledu.
        </p>
        <PasswordFields idPrefix="setup" pw={pw} again={again} setPw={setPw} setAgain={setAgain} onEdit={() => setError("")} />
        {error && <p role="alert" style={{ color: "var(--destructive, #D96A5C)", fontSize: "0.85rem", margin: "8px 0 0" }}>{error}</p>}
        <button type="submit" disabled={saving} style={{ ...primary, opacity: saving ? 0.6 : 1 }}>
          {saving ? "Ukládám…" : <>Nastavit a vstoupit <IconArrowRight size={16} /></>}
        </button>
      </form>
    </Screen>
  )
}

/** Změna hesla uvnitř Přípravy. Po úspěchu předá nové heslo, aby se záložka nemusela znovu přihlašovat. */
export function PasswordChange({ onChanged }: { onChanged: (password: string) => void }) {
  const [open, setOpen] = useState(false)
  const [pw, setPw] = useState("")
  const [again, setAgain] = useState("")
  const [error, setError] = useState("")
  const [saving, setSaving] = useState(false)
  const [done, setDone] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    const bad = checkPair(pw, again)
    if (bad) { setError(bad); return }
    setSaving(true)
    const err = await savePassword(pw)
    setSaving(false)
    if (err) { setError(err); return }
    onChanged(pw)
    setPw(""); setAgain(""); setOpen(false); setDone(true)
  }

  const box: React.CSSProperties = {
    backgroundColor: "var(--c-bg-card)", border: "1px solid var(--c-border)", borderRadius: 10, padding: "16px 18px", maxWidth: 420,
  }

  if (!open) {
    return (
      <div style={{ ...box, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div>
          <p style={{ fontWeight: 700, fontSize: "0.95rem", margin: "0 0 2px", color: "var(--c-text)" }}>Heslo Přípravy</p>
          <p style={{ color: done ? "var(--c-success)" : "var(--c-text-muted)", fontSize: "0.82rem", margin: 0, display: "flex", alignItems: "center", gap: 4 }}>
            {done ? <><IconCheck size={14} /> Heslo změněno. Ostatním organizátorům ho dej vědět.</> : "Společné pro všechny organizátory."}
          </p>
        </div>
        <button onClick={() => { setOpen(true); setDone(false) }} style={{
          display: "flex", alignItems: "center", gap: 6, minHeight: 40, padding: "0 14px",
          backgroundColor: "transparent", border: "1px solid var(--c-border-mid)", borderRadius: 6,
          color: "var(--c-text)", fontSize: "0.85rem", cursor: "pointer",
        }}>
          <IconKey size={14} /> Změnit heslo
        </button>
      </div>
    )
  }

  return (
    <form onSubmit={submit} style={box}>
      <p style={{ fontWeight: 700, fontSize: "0.95rem", margin: "0 0 12px", color: "var(--c-text)" }}>Nové heslo Přípravy</p>
      <PasswordFields idPrefix="zmena" pw={pw} again={again} setPw={setPw} setAgain={setAgain} onEdit={() => setError("")} />
      {error && <p role="alert" style={{ color: "var(--destructive, #D96A5C)", fontSize: "0.85rem", margin: "8px 0 0" }}>{error}</p>}
      <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
        <button type="submit" disabled={saving} style={{ ...primary, marginTop: 0, flex: 1, opacity: saving ? 0.6 : 1 }}>
          {saving ? "Ukládám…" : "Uložit heslo"}
        </button>
        <button type="button" onClick={() => { setOpen(false); setPw(""); setAgain(""); setError("") }} style={{
          minHeight: 44, padding: "0 14px", backgroundColor: "transparent", border: "1px solid var(--c-border-mid)",
          borderRadius: 6, color: "var(--c-text-muted)", cursor: "pointer",
        }}>Zrušit</button>
      </div>
    </form>
  )
}
