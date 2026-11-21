"use client"

import React, { useEffect, useState } from "react"
import {
  IconLayoutDashboard, IconRepeat, IconBook, IconLogout, IconUser, IconInfoCircle, IconBroadcast, IconAdjustments, IconFileText, IconPrinter, IconClipboardList, IconMail, IconUsers,
} from "@tabler/icons-react"
import { useGame } from "@/lib/game-context"
import { adminFetch, setAdminToken } from "@/lib/admin-client"
import { PasswordChange } from "@/components/views/priprava/priprava-login"
import { ObsazeniPanel } from "@/components/panels/obsazeni/obsazeni-panel"
import { PravidlaPanel } from "@/components/panels/pravidla/pravidla-panel"
import { RulesProvider } from "@/components/panels/pravidla/rules-context"
import { TextyPanel } from "@/components/panels/texty/texty-panel"
import { WikiAdminPanel } from "@/components/panels/wiki-admin"
import { SpisyPanel, type PrintJob } from "@/components/panels/spisy/spisy-panel"
import { SpisPrintScreen } from "@/components/panels/spisy/spis-print-screen"
import { PrihlaskyPanel } from "@/components/panels/prihlasky/prihlasky-panel"
import { EmailyPanel } from "@/components/panels/emaily/emaily-panel"
import { HraciPanel } from "@/components/panels/hraci/hraci-panel"
import { ToastContainer } from "@/components/shared/toast"
import type { TablerIcon } from "@/lib/types"

type Section = "overview" | "signups" | "mails" | "texts" | "runs" | "players" | "rules" | "docs" | "library"

// Larp = nastavení společné všem během, Běhy = příprava konkrétního běhu.
type Group = "larp" | "runs"

const SECTIONS: { value: Section; label: string; hint: string; Icon: TablerIcon; group?: Group }[] = [
  { value: "overview", label: "Přehled",     hint: "Stav přípravy",              Icon: IconLayoutDashboard },
  { value: "texts",    label: "Texty",       hint: "Psaní a schvalování",        Icon: IconFileText,      group: "larp" },
  { value: "rules",    label: "Pravidla",    hint: "Co je napevno, co zakázané", Icon: IconAdjustments,   group: "larp" },
  { value: "library",  label: "Knihovna",    hint: "Články a vazby",             Icon: IconBook,          group: "larp" },
  { value: "mails",    label: "E-maily",     hint: "Texty a náhledy mailů",      Icon: IconMail,          group: "larp" },
  { value: "signups",  label: "Přihlášky",   hint: "Odpovědi z formuláře",       Icon: IconClipboardList, group: "runs" },
  { value: "runs",     label: "Obsazení",    hint: "Hráči, jednotky, kruhy",     Icon: IconRepeat,        group: "runs" },
  { value: "players",  label: "Hráči",       hint: "Platby, fotky, maily",       Icon: IconUsers,         group: "runs" },
  { value: "docs",     label: "Spisy hráčů", hint: "Odkazy, zveřejnění, tisk",   Icon: IconPrinter,       group: "runs" },
]

const GROUP_COLOR: Record<Group, string> = { larp: "var(--c-accent)", runs: "var(--c-teal)" }

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
  const { runs, activeRunId } = useGame()
  const activeRun = runs.find(r => r.id === activeRunId)
  const [printJob, setPrintJob] = useState<PrintJob | null>(null)

  if (printJob) return <SpisPrintScreen job={printJob} onClose={() => setPrintJob(null)} />

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
          {/* Velín ve stejné záložce; zpět do Přípravy bez nového přihlášení. */}
          <a href="/character/GM1" title="Řízení hry" style={{ ...chip, color: "var(--c-text)", fontWeight: 600, textDecoration: "none" }}>
            <IconBroadcast size={14} /> Velín
          </a>
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
          {SECTIONS.map(({ value, label, hint, Icon, group }, i) => {
            const active = value === section
            const color = group ? GROUP_COLOR[group] : "var(--c-accent)"
            const heading = group && SECTIONS[i - 1]?.group !== group
            return (
              <React.Fragment key={value}>
              {heading && (
                <p className="priprava-nav-group" style={{ color }}>
                  {group === "larp" ? "Larp" : <>Běhy<span style={{ color: "var(--c-text-faint)" }}> · {activeRun ? `hraje se ${activeRun.name}` : "nehraje se"}</span></>}
                </p>
              )}
              <button onClick={() => go(value)} aria-current={active ? "page" : undefined}
                className="priprava-nav-item" style={{
                  backgroundColor: active ? `color-mix(in srgb, ${color} 14%, transparent)` : "transparent",
                  borderColor: active ? `color-mix(in srgb, ${color} 45%, transparent)` : "transparent",
                  color: active ? "var(--c-text)" : "var(--c-text-muted)",
                }}>
                <Icon size={18} color={active ? color : "currentColor"} />
                <span style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", minWidth: 0 }}>
                  <span style={{ fontWeight: active ? 700 : 500, fontSize: "0.92rem" }}>{label}</span>
                  <span className="priprava-hide-narrow" style={{ fontSize: "0.75rem", color: "var(--c-text-faint)" }}>{hint}</span>
                </span>
              </button>
              </React.Fragment>
            )
          })}
        </nav>

        <main style={{ minWidth: 0, padding: "24px 20px 48px" }}>
          <h1 style={{
            fontFamily: "var(--font-display)", textTransform: "uppercase", letterSpacing: "0.05em",
            fontSize: "1.5rem", fontWeight: 700, color: "var(--c-text)", margin: "0 0 20px",
          }}>{current.label}</h1>
          <RulesProvider>
            {section === "overview" && <Overview onGo={go} />}
            {section === "texts"    && <TextyPanel />}
            {section === "runs"     && <ObsazeniPanel />}
            {section === "rules"    && <PravidlaPanel />}
            {section === "docs"     && <SpisyPanel onPrint={setPrintJob} />}
          </RulesProvider>
          {section === "library"  && <WikiAdminPanel />}
          {section === "signups"  && <PrihlaskyPanel />}
          {section === "players"  && <HraciPanel />}
          {section === "mails"    && <EmailyPanel />}
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
        <Stat label="Aktivní běh" value={activeRun?.name ?? "—"} note={activeRun ? `#${activeRun.id} · ${runs.length} běhů celkem` : `Teď se nehraje · ${runs.length} běhů celkem`} />
        <Stat label="Postavy hráčů" value={String(players)} note={`${teams.length} týmů`} />
        <Stat label="Články knihovny"
          value={articleCount === null ? "…" : articleCount === "error" ? "—" : String(articleCount)}
          note={articleCount === "error" ? "Nepodařilo se načíst" : undefined} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 12 }}>
        <Jump title="Texty" text="Jádra postav, týmy, jednotky s rolemi, kruhy. Psaní, Hotovo a schvalování." onClick={() => onGo("texts")} />
        <Jump title="Obsazení" text="Hráči na postavy, týmy do jednotek, postavám specializace, původ a kruhy. Kontroly ukážou, co chybí." onClick={() => onGo("runs")} />
        <Jump title="Hráči" text="Soupiska běhu: kdo zaplatil, kdo poslal fotku, oznámení o přijetí a upomínky." onClick={() => onGo("players")} />
        <Jump title="Pravidla" text="Které postavy mají specializaci, původ nebo kruh napevno a co je zakázané." onClick={() => onGo("rules")} />
        <Jump title="Knihovna" text="Články herní knihovny a vazby mezi nimi." onClick={() => onGo("library")} />
      </div>

      <p style={{ display: "flex", alignItems: "center", gap: 6, color: "var(--c-text-faint)", fontSize: "0.82rem", margin: "4px 0 0" }}>
        <IconInfoCircle size={14} />
        Vztahy postav, spis pro hráče a tisk přibudou v dalších krocích.
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
