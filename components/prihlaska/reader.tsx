"use client"

import React, { useEffect, useRef } from "react"
import { IconArrowLeft, IconArrowRight, IconX } from "@tabler/icons-react"
import { SpisText } from "@/components/spis/spis-text"
import { CIRCLE_ONLY_GENDER, type PrefKind } from "@/lib/prihlaska"
import { entriesOf, genderMark, KIND_ONE } from "./draft"
import { Motto, Tri, usePr } from "./parts"

// Čtečka celého medailonku. Na širokém displeji panel vpravo, na úzkém list
// zespodu. Šipky přechází po kartách v pořadí, v jakém jsou na stránce.

export type ReaderState = { kind: PrefKind; id: string; list: string[] }

const GENDER_WORD = { m: "muž", f: "žena" } as const

export function Reader({ state, onMove, onClose }: {
  state: ReaderState
  onMove: (id: string, kind?: PrefKind, list?: string[]) => void
  onClose: () => void
}) {
  const { catalog } = usePr()
  const ref = useRef<HTMLElement>(null)
  const { kind, id, list } = state
  const entry = entriesOf(catalog, kind).find(e => e.id === id)
  const i = list.indexOf(id)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose() }
    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  }, [onClose])
  useEffect(() => { ref.current?.scrollTo(0, 0); ref.current?.focus() }, [kind, id])

  if (!entry) return null
  const rows: [string, React.ReactNode][] = []
  let extra: React.ReactNode = null

  if (kind === "character") {
    const team = catalog.teams.find(t => t.id === entry.teamId)
    if (team) rows.push(["Tým", <span key="t" className="pr-chip"><i className="pr-dot" style={{ background: team.color }} />{team.name}</span>])
    if (entry.gender) rows.push(["Gender", GENDER_WORD[entry.gender]])
    entry.fixed?.forEach(f => rows.push(["Pravidla", f]))
    if (team) {
      const mates = catalog.characters.filter(c => c.teamId === team.id && c.id !== id)
      extra = <>
        <p className="pr-reader-sub">{team.name}</p>
        <Motto motto={team.motto} />
        {team.themes.length > 0 && <p className="pr-themes">Témata týmu: {team.themes.join(", ")}</p>}
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
    <aside ref={ref} className="pr-reader" aria-label={`${KIND_ONE[kind]} ${entry.name}`} tabIndex={-1}>
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
      <div className="pr-reader-tri"><Tri kind={kind} id={id} name={entry.name} where="reader" /></div>
    </aside>
  )
}
