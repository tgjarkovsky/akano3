"use client"

import React, { useEffect, useState } from "react"
import {
  IconLayoutDashboard, IconRepeat, IconBook, IconLogout, IconUser, IconInfoCircle,
} from "@tabler/icons-react"
import { useGame } from "@/lib/game-context"
import { adminFetch, setAdminToken } from "@/lib/admin-client"
import { PasswordChange } from "@/components/views/priprava/priprava-login"
import { ObsazeniPanel } from "@/components/panels/obsazeni/obsazeni-panel"
import { WikiAdminPanel } from "@/components/panels/wiki-admin"
import { ToastContainer } from "@/components/shared/toast"
import type { TablerIcon } from "@/lib/types"

type Section = "overview" | "runs" | "library"

const SECTIONS: { value: Section; label: string; hint: string; Icon: TablerIcon }[] = [
  { value: "overview", label: "Přehled",          hint: "Stav přípravy",              Icon: IconLayoutDashboard },
  { value: "runs",     label: "Běhy a obsazení",  hint: "Jednotky, postavy, kruhy",   Icon: IconRepeat },
  { value: "library",  label: "Knihovna",         hint: "Články a vazby",             Icon: IconBook },
]

const SECTION_KEY = "akano_priprava_section"

function readSection(): Section {
  try {
    const s = sessionStorage.getItem(SECTION_KEY)
    if (s && SECTIONS.some(x => x.value === s)) return s as Section
  } catch { /* bez úložiště začne Přehledem */ }
  return "overview"
}

export function PripravaShell({ organizer, onChangeOrganizer, onLogout }: {
  organizer: string
  onChangeOrganizer: () => void
  onLogout: () => void
}) {
  const [section, setSection] = useState<Section>("overview")
  useEffect(() => { setSection(readSection()) }, [])
  const go = (s: Section) => {
    setSection(s)
    try { sessionStorage.setItem(SECTION_KEY, s) } catch { /* jen se nezapamatuje */ }
  }
  const current = SECTIONS.find(s => s.value === section)!

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <header style={{
        display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12,
        padding: "10px 20px", backgroundColor: "var(--c-topbar)", borderBottom: "1px solid var(--c-border-mid)",
        position: "sticky", top: 0, zIndex: 20,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
          <img src="/akano-logo.png" alt="" style={{ height: 22, width: "auto" }} />
          <span style={{
            fontFamily: "var(--font-display)", textTransform: "uppercase", letterSpacing: "0.06em",
            fontWeight: 700, fontSize: "1.1rem", color: "var(--c-text)",
          }}>Příprava</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button onClick={onChangeOrganizer} title="Změnit jméno" style={chip}>
            <IconUser size={14} /> <span className="priprava-hide-narrow">{organizer}</span>
          </button>
          <button onClick={onLogout} title="Odhlásit" style={chip}>
            <IconLogout size={14} /> <span className="priprava-hide-narrow">Odhlásit</span>
          </button>
        </div>
      </header>

      <div className="priprava-layout">
        <nav aria-label="Sekce Přípravy" className="priprava-nav">
          {SECTIONS.map(({ value, label, hint, Icon }) => {
            const active = value === section
            return (
              <button key={value} onClick={() => go(value)} aria-current={active ? "page" : undefined}
                className="priprava-nav-item" style={{
                  backgroundColor: active ? "color-mix(in srgb, var(--c-accent) 14%, transparent)" : "transparent",
                  borderColor: active ? "color-mix(in srgb, var(--c-accent) 45%, transparent)" : "transparent",
                  color: active ? "var(--c-text)" : "var(--c-text-muted)",
                }}>
                <Icon size={18} color={active ? "var(--c-accent)" : "currentColor"} />
                <span style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", minWidth: 0 }}>
                  <span style={{ fontWeight: active ? 700 : 500, fontSize: "0.92rem" }}>{label}</span>
                  <span className="priprava-hide-narrow" style={{ fontSize: "0.75rem", color: "var(--c-text-faint)" }}>{hint}</span>
                </span>
              </button>
            )
          })}
        </nav>

        <main style={{ minWidth: 0, padding: "24px 20px 48px" }}>
          <h1 style={{
            fontFamily: "var(--font-display)", textTransform: "uppercase", letterSpacing: "0.05em",
            fontSize: "1.5rem", fontWeight: 700, color: "var(--c-text)", margin: "0 0 20px",
          }}>{current.label}</h1>
          {section === "overview" && <Overview onGo={go} />}
          {section === "runs"     && <ObsazeniPanel />}
          {section === "library"  && <WikiAdminPanel />}
        </main>
      </div>
      <ToastContainer />
    </div>
  )
}

const chip: React.CSSProperties = {
  display: "flex", alignItems: "center", gap: 6, minHeight: 36, padding: "0 12px",
  backgroundColor: "transparent", border: "1px solid var(--c-border-mid)", borderRadius: 6,
  color: "var(--c-text-muted)", fontSize: "0.82rem", cursor: "pointer",
}

function Overview({ onGo }: { onGo: (s: Section) => void }) {
  const { runs, activeRunId, characters, teams } = useGame()
  // null = načítá se, "error" = server neodpověděl
  const [articleCount, setArticleCount] = useState<number | "error" | null>(null)

  useEffect(() => {
    let cancelled = false
    adminFetch("/api/wiki?admin=1")
      .then(r => r.ok ? r.json() : null)
      .then(rows => { if (!cancelled) setArticleCount(Array.isArray(rows) ? rows.length : "error") })
      .catch(() => { if (!cancelled) setArticleCount("error") })
    return () => { cancelled = true }
  }, [])

  const activeRun = runs.find(r => r.id === activeRunId)
  const players = characters.filter(c => c.role === "student" || c.role === "ruze").length

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, maxWidth: 900 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12 }}>
        <Stat label="Aktivní běh" value={activeRun?.name ?? "—"} note={activeRun ? `#${activeRun.id} · ${runs.length} běhů celkem` : "Žádný běh není aktivní"} />
        <Stat label="Postavy hráčů" value={String(players)} note={`${teams.length} týmů`} />
        <Stat label="Články knihovny"
          value={articleCount === null ? "…" : articleCount === "error" ? "—" : String(articleCount)}
          note={articleCount === "error" ? "Nepodařilo se načíst" : undefined} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 12 }}>
        <Jump title="Běhy a obsazení" text="Týmy do jednotek, postavám specializace, původ a kruhy. Kontroly ukážou, co chybí." onClick={() => onGo("runs")} />
        <Jump title="Knihovna" text="Články herní knihovny a vazby mezi nimi." onClick={() => onGo("library")} />
      </div>

      <p style={{ display: "flex", alignItems: "center", gap: 6, color: "var(--c-text-faint)", fontSize: "0.82rem", margin: "4px 0 0" }}>
        <IconInfoCircle size={14} />
        Texty postav, kontrola obsazení a tisk přibudou v dalších krocích.
      </p>

      <PasswordChange onChanged={setAdminToken} />
    </div>
  )
}

function Stat({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div style={{ backgroundColor: "var(--c-bg-card)", border: "1px solid var(--c-border)", borderRadius: 10, padding: "14px 18px" }}>
      <p style={{ color: "var(--c-text-muted)", fontSize: "0.75rem", letterSpacing: "0.06em", margin: "0 0 6px" }}>{label}</p>
      <p style={{ color: "var(--c-text)", fontSize: "1.35rem", fontWeight: 800, margin: 0, lineHeight: 1.1 }}>{value}</p>
      {note && <p style={{ color: "var(--c-text-faint)", fontSize: "0.78rem", margin: "6px 0 0" }}>{note}</p>}
    </div>
  )
}

function Jump({ title, text, onClick }: { title: string; text: string; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{
      textAlign: "left", cursor: "pointer", padding: "16px 18px", minHeight: 44,
      backgroundColor: "var(--c-bg-section)", border: "1px solid var(--c-border-mid)", borderRadius: 10,
      color: "var(--c-text)",
    }}>
      <p style={{ fontWeight: 700, fontSize: "0.95rem", margin: "0 0 4px" }}>{title}</p>
      <p style={{ color: "var(--c-text-muted)", fontSize: "0.85rem", margin: 0, lineHeight: 1.45 }}>{text}</p>
    </button>
  )
}
