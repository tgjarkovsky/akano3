"use client"

import React, { useEffect, useRef } from "react"
import { IconArrowLeft, IconArrowRight, IconX } from "@tabler/icons-react"
import { SpisText } from "@/components/spis/spis-text"
import { CIRCLE_ONLY_GENDER, fitsGender, type PrefKind } from "@/lib/prihlaska"
import { adultGender, entriesOf, genderMark, KIND_ONE } from "./draft"
import { Motto, OffNote, Tri, usePr } from "./parts"

// Čtečka celého medailonku jako modální okno (na telefonu list zespodu).
// Šipky (i klávesy ← →) přechází po kartách v pořadí, v jakém jsou na stránce.

export type ReaderState = { kind: PrefKind; id: string; list: string[] }

const GENDER_WORD = { m: "muž", f: "žena" } as const

export function Reader({ state, onMove, onClose }: {
  state: ReaderState
  onMove: (id: string, kind?: PrefKind, list?: string[]) => void
  onClose: () => void
}) {
  const { catalog, genderPref } = usePr()
  const ref = useRef<HTMLElement>(null)
  const { kind, id, list } = state
  const entry = entriesOf(catalog, kind).find(e => e.id === id)
  const i = list.indexOf(id)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
      const typing = e.target instanceof HTMLElement && e.target.closest("input, textarea, select")
      if (typing || e.altKey || e.metaKey || e.ctrlKey) return
      if (e.key === "ArrowLeft" && i > 0) onMove(list[i - 1])
      if (e.key === "ArrowRight" && i >= 0 && i < list.length - 1) onMove(list[i + 1])
    }
    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  }, [onClose, onMove, i, list])
  // Stránka pod oknem neroluje; po zavření se fokus vrátí tam, odkud se čtečka otevřela.
  useEffect(() => {
    const back = document.activeElement as HTMLElement | null
    const overflow = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => { document.body.style.overflow = overflow; back?.focus?.({ preventScroll: true }) }
  }, [])
  useEffect(() => { ref.current?.scrollTo(0, 0); ref.current?.focus() }, [kind, id])

  if (!entry) return null
  const rows: [string, React.ReactNode][] = []
  let extra: React.ReactNode = null

  if (kind === "character") {
    const team = catalog.teams.find(t => t.id === entry.teamId)
    if (entry.gender) rows.push(["Gender", GENDER_WORD[entry.gender]])
    entry.fixed?.forEach(f => rows.push(["Pevně dané", f]))
    if (team) {
      const mates = catalog.characters.filter(c => c.teamId === team.id && c.id !== id)
      extra = <>
        <div className="pr-reader-team">
          <p className="pr-reader-sub">{team.name}</p>
          <Motto motto={team.motto} />
          {team.themes.length > 0 && <p className="pr-themes">Témata týmu: {team.themes.join(", ")}</p>}
        </div>
        <p className="pr-reader-sub">Spoluhráči v týmu</p>
        <div className="pr-mates">
          {mates.map(m => (
            <button key={m.id} type="button" onClick={() => onMove(m.id, "character", list.includes(m.id) ? list : mates.map(x => x.id).concat(id))}>
              {m.name}{m.gender ? ` · ${genderMark(m.gender)}` : ""}
            </button>
          ))}
        </div>
      </>
    }
  } else {
    entry.facts.forEach(([k, v]) => rows.push([k, v]))
    const only = kind === "circle" ? CIRCLE_ONLY_GENDER[id] : undefined
    if (only) rows.push(["Omezení", only === "f" ? "jen dívčí postavy" : "jen chlapecké postavy"])
  }
  if (entry.sensitive) rows.push(["Citlivá témata", entry.sensitive])

  return (
    <section ref={ref} className="pr-reader" role="dialog" aria-modal="true" aria-label={`${KIND_ONE[kind]} ${entry.name}`} tabIndex={-1}>
      <div className="pr-reader-top">
        <p className="pr-label">{KIND_ONE[kind]}{i >= 0 ? ` · ${i + 1} z ${list.length}` : ""}</p>
        <div className="pr-reader-nav">
          <button type="button" className="pr-icon-btn" aria-label="Předchozí" disabled={i <= 0} onClick={() => onMove(list[i - 1])}><IconArrowLeft size={18} /></button>
          <button type="button" className="pr-icon-btn" aria-label="Další" disabled={i < 0 || i >= list.length - 1} onClick={() => onMove(list[i + 1])}><IconArrowRight size={18} /></button>
          <button type="button" className="pr-icon-btn" aria-label="Zavřít" onClick={onClose}><IconX size={18} /></button>
        </div>
      </div>
      <h2>{entry.name}</h2>
      {kind !== "character" && <Motto motto={entry.motto} />}
      {rows.length > 0 && (
        <dl className="pr-facts">
          {rows.map(([k, v], n) => <div key={n}><dt>{k}</dt><dd>{v}</dd></div>)}
        </dl>
      )}
      {entry.body ? <SpisText body={entry.body} /> : <p className="pr-hint">Medailonek zatím chybí.</p>}
      {extra}
      <div className="pr-reader-tri">
        {(kind === "character" || kind === "adult") && !fitsGender(genderPref, kind === "adult" ? adultGender(entry) : entry.gender)
          ? <OffNote gender={kind === "adult" ? adultGender(entry) : entry.gender} adult={kind === "adult"} />
          : <Tri kind={kind} id={id} name={entry.name} where="reader" />}
      </div>
    </section>
  )
}
