"use client"

import React, { createContext, useContext } from "react"
import { excerpt } from "@/lib/character-doc"
import { CIRCLE_ONLY_GENDER, prefOf, type Catalog, type CatalogEntry, type GenderChoice, type Pref, type PrefKind, type Prefs } from "@/lib/prihlaska"
import { genderMark, type KindEntry } from "./draft"

// Sdílené kousky formuláře: kontext, trojstavová volba a karta s medailonkem.

export type PrCtx = {
  catalog: Catalog
  prefs: Prefs
  /** jaké postavy hráč chce hrát; ostatní se neukazují */
  genderPref: GenderChoice | ""
  setPref: (kind: PrefKind, id: string, v: Pref) => void
  openReader: (kind: PrefKind, id: string, list?: string[]) => void
  readOnly: boolean
}

export const PrContext = createContext<PrCtx | null>(null)

export function usePr(): PrCtx {
  const ctx = useContext(PrContext)
  if (!ctx) throw new Error("usePr must be inside PrContext")
  return ctx
}

const OPTIONS: { v: Pref; label: string; cls: string }[] = [
  { v: "yes", label: "★ Chci moc", cls: "pr-tri-yes" },
  { v: "ok", label: "Klidně", cls: "pr-tri-ok" },
  { v: "no", label: "✕ Nechci", cls: "pr-tri-no" },
]

export function Tri({ kind, id, name, where = "card" }: { kind: PrefKind; id: string; name: string; where?: string }) {
  const { prefs, setPref, readOnly } = usePr()
  const value = prefOf(prefs, kind, id)
  return (
    <div className="pr-tri" role="radiogroup" aria-label={`Zájem: ${name}`}>
      {OPTIONS.map(o => (
        <label key={o.v} className={o.cls}>
          <input type="radio" name={`${where}-${kind}-${id}`} value={o.v} checked={value === o.v} disabled={readOnly}
            onChange={() => setPref(kind, id, o.v)} />
          {o.label}
        </label>
      ))}
    </div>
  )
}

export function Motto({ motto }: { motto?: CatalogEntry["motto"] }) {
  if (!motto) return null
  return (
    <p className="pr-motto">
      {motto.jp && <span className="pr-motto-jp" lang="ja">{motto.jp}</span>}
      {motto.text}
    </p>
  )
}

export const SensChip = ({ text }: { text?: string }) =>
  text ? <span className="pr-chip pr-chip-sens" title="Citlivá témata">citlivé: {text}</span> : null

const ONLY: Record<string, string> = { f: "jen dívčí postavy", m: "jen chlapecké postavy" }

/** Karta s výňatkem medailonku, štítky a volbou. */
export function PrefCard({ kind, entry, list, children }: {
  kind: PrefKind
  entry: KindEntry
  /** pořadí pro šipky ve čtečce */
  list: string[]
  children?: React.ReactNode
}) {
  const { catalog, prefs, openReader } = usePr()
  const v = prefOf(prefs, kind, entry.id)
  const team = entry.teamId ? catalog.teams.find(t => t.id === entry.teamId) : undefined
  const gender = kind === "adult" ? entry.facts.find(([k]) => k === "Gender")?.[1] : genderMark(entry.gender)
  const role = kind === "adult" ? entry.facts.find(([k]) => k === "Role")?.[1] : undefined
  const only = kind === "circle" ? CIRCLE_ONLY_GENDER[entry.id] : undefined
  const lead = excerpt(entry.body, 260) || entry.facts.filter(([k]) => k !== "Gender").map(([k, x]) => `${k}: ${x}`).join(" · ")
  return (
    <article className={`pr-card${v === "yes" ? " pr-card-yes" : v === "no" ? " pr-card-no" : ""}`}>
      <div className="pr-card-head">
        <span className="pr-name">{entry.name}</span>
        {gender && <span className="pr-gender">{gender}</span>}
      </div>
      {(team || entry.fixed?.length || entry.sensitive || role || only) && (
        <div className="pr-chips">
          {team && <span className="pr-chip"><i className="pr-dot" style={{ background: team.color }} />{team.name}</span>}
          {role && <span className="pr-chip">{role}</span>}
          {only && <span className="pr-chip pr-chip-fixed">{ONLY[only]}</span>}
          {entry.fixed?.map(f => <span key={f} className="pr-chip pr-chip-fixed" title="Daný Pravidly">⚲ {f}</span>)}
          <SensChip text={entry.sensitive} />
        </div>
      )}
      {kind !== "character" && <Motto motto={entry.motto} />}
      {lead ? <p className="pr-excerpt">{lead}</p> : <p className="pr-excerpt">Medailonek zatím chybí.</p>}
      <button type="button" className="pr-read" onClick={() => openReader(kind, entry.id, list)}>Číst celý medailonek</button>
      {children}
      <Tri kind={kind} id={entry.id} name={entry.name} />
    </article>
  )
}
