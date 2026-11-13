"use client"

import React, { createContext, useContext } from "react"
import { excerpt } from "@/lib/character-doc"
import { SpisText } from "@/components/spis/spis-text"
import { CIRCLE_ONLY_GENDER, prefOf, type Catalog, type CatalogEntry, type GenderChoice, type Pref, type PrefKind, type Prefs } from "@/lib/prihlaska"
import { adultGender, adultGenderMark, genderMark, onCard, type KindEntry } from "./draft"

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

export function Motto({ motto, inline }: { motto?: CatalogEntry["motto"]; inline?: boolean }) {
  if (!motto) return null
  const Tag = inline ? "span" : "p"
  return (
    <Tag className="pr-motto">
      {motto.jp && <span className="pr-motto-jp" lang="ja" aria-hidden="true">{motto.jp}</span>}
      {motto.text}
    </Tag>
  )
}

/** Proč postavu nejde vybrat: hráč chce hrát jen druhý gender. */
export const OffNote = ({ gender }: { gender?: "m" | "f" | null }) =>
  <p className="pr-off-note">{gender === "f" ? "Ženská" : "Mužská"} postava · podle tvé volby jen ke čtení</p>

const ONLY: Record<string, string> = { f: "jen ženské postavy", m: "jen mužské postavy" }

/** Karta s výňatkem medailonku, štítky a volbou. Klik na jméno nebo výňatek otevře čtečku. */
export function PrefCard({ kind, entry, list, inactive, shared, children }: {
  kind: PrefKind
  entry: KindEntry
  /** pořadí pro šipky ve čtečce */
  list: string[]
  /** postava mimo hráčovu volbu genderu: jen ke čtení, bez volby */
  inactive?: boolean
  /** pevně dané prvky, které už ukazuje hlavička týmu */
  shared?: string[]
  children?: React.ReactNode
}) {
  const { catalog, prefs, openReader } = usePr()
  const v = prefOf(prefs, kind, entry.id)
  // U studentských postav je tým v hlavičce sekce; štítek by se opakoval.
  const team = kind !== "character" && entry.teamId ? catalog.teams.find(t => t.id === entry.teamId) : undefined
  const gender = kind === "adult" ? adultGenderMark(entry) : genderMark(entry.gender)
  const genderWord = kind === "adult" ? entry.facts.find(([k]) => k === "Gender")?.[1] : entry.gender === "f" ? "dívka" : entry.gender === "m" ? "chlapec" : undefined
  const role = kind === "adult" ? entry.facts.find(([k]) => k === "Role")?.[1] : undefined
  const only = kind === "circle" ? CIRCLE_ONLY_GENDER[entry.id] : undefined
  const fixed = (entry.fixed ?? []).filter(f => onCard(f) && !shared?.includes(f))
  // Specializace mají krátký popis, který se vejde celý; čtečku nepotřebují.
  const whole = kind === "specialization"
  const lead = excerpt(entry.body, 220) || entry.facts.filter(([k]) => k !== "Gender").map(([k, x]) => `${k}: ${x}`).join(" · ")
  const chips = (team || fixed.length > 0 || role || only) && (
    <div className="pr-chips">
      {team && <span className="pr-chip"><i className="pr-dot" style={{ background: team.color }} />{team.name}</span>}
      {role && <span className="pr-chip">{role}</span>}
      {only && <span className="pr-chip pr-chip-fixed">{ONLY[only]}</span>}
      {fixed.map(f => <span key={f} className="pr-chip pr-chip-fixed" title="Pevně dané">◆ {f}</span>)}
    </div>
  )
  const head = (
    <span className="pr-card-head">
      <span className="pr-name">{entry.name}</span>
      {gender && <span className="pr-gender" title={genderWord} aria-label={genderWord}>{gender}</span>}
    </span>
  )
  return (
    <article className={`pr-card${inactive ? " pr-card-off" : v === "yes" ? " pr-card-yes" : v === "no" ? " pr-card-no" : ""}`}>
      {whole ? <>
        {head}
        {chips}
        <Motto motto={entry.motto} />
        {(entry.facts.length > 0 || entry.body)
          ? <div className="pr-card-full">
              {entry.facts.length > 0 && <dl>{entry.facts.map(([k, x]) => <div key={k}><dt>{k}</dt><dd>{x}</dd></div>)}</dl>}
              {entry.body && <SpisText body={entry.body} />}
            </div>
          : <p className="pr-excerpt">Popis zatím chybí.</p>}
      </> : <>
        <button type="button" className="pr-card-open" onClick={() => openReader(kind, entry.id, list)} title="Číst celý medailonek" aria-label={`${entry.name}: číst celý medailonek`}>
          {head}
          {kind !== "character" && <Motto motto={entry.motto} inline />}
          <span className="pr-excerpt">{lead || "Medailonek zatím chybí."}</span>
        </button>
        {chips}
      </>}
      {children}
      {inactive ? <OffNote gender={kind === "adult" ? adultGender(entry) : entry.gender} /> : <Tri kind={kind} id={entry.id} name={entry.name} />}
    </article>
  )
}
