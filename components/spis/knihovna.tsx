"use client"

import React, { useEffect, useState } from "react"
import { IconArrowLeft, IconChevronRight } from "@tabler/icons-react"
import { excerpt, type AcademyEntry, type AcademyKind, type CharacterDoc, type DocChapter } from "@/lib/character-doc"
import { SpisBlock } from "./spis-document"
import { PrintButton } from "./print-button"

// Osobní knihovna hráče: nástěnka s kartami (já, můj tým, jednotka, kruh)
// a pod nimi celá akademie. Klik otevře stránku. Kde hráč je, drží adresa
// za # (#tym, #akademie/team/T02), takže funguje tlačítko Zpět.

const CHAPTER_SLUG: Record<string, string> = { core: "ja", team: "tym", unit: "jednotka", circle: "kruh", traits: "zarazeni" }
const MY_CHAPTER: Record<AcademyKind, string> = { team: "team", unit: "unit", circle: "circle" }
const KIND_LABEL: Record<AcademyKind, { one: string; many: string }> = {
  team:   { one: "Tým",      many: "Týmy" },
  unit:   { one: "Jednotka", many: "Jednotky" },
  circle: { one: "Kruh",     many: "Kruhy" },
}

type Place =
  | { view: "home" }
  | { view: "chapter"; chapter: DocChapter }
  | { view: "academy"; entry: AcademyEntry }

function readPlace(hash: string, doc: CharacterDoc, academy: AcademyEntry[]): Place {
  const h = decodeURIComponent(hash.replace(/^#/, ""))
  const chapter = doc.chapters.find(c => CHAPTER_SLUG[c.key] === h)
  if (chapter) return { view: "chapter", chapter }
  const m = h.match(/^akademie\/(team|unit|circle)\/(.+)$/)
  const entry = m && academy.find(a => a.kind === m[1] && a.id === m[2])
  if (entry) {
    // Vlastní skupina vede na kapitolu spisu, kde jsou i interní texty.
    const own = entry.mine && doc.chapters.find(c => c.key === MY_CHAPTER[entry.kind])
    return own ? { view: "chapter", chapter: own } : { view: "academy", entry }
  }
  return { view: "home" }
}

const hrefOfChapter = (c: DocChapter) => `#${CHAPTER_SLUG[c.key] ?? c.key}`
const hrefOfEntry = (e: AcademyEntry, doc: CharacterDoc) => {
  const own = e.mine && doc.chapters.find(c => c.key === MY_CHAPTER[e.kind])
  return own ? hrefOfChapter(own) : `#akademie/${e.kind}/${e.id}`
}

export function Knihovna({ doc, academy }: { doc: CharacterDoc; academy: AcademyEntry[] }) {
  const [place, setPlace] = useState<Place>({ view: "home" })

  useEffect(() => {
    const sync = () => {
      setPlace(readPlace(window.location.hash, doc, academy))
      window.scrollTo(0, 0)
    }
    sync()
    window.addEventListener("hashchange", sync)
    return () => window.removeEventListener("hashchange", sync)
  }, [doc, academy])

  return (
    <div className="kn">
      <div className="spis-toolbar">
        {place.view === "home"
          ? <span className="spis-toolbar-title">Osobní knihovna · {doc.character.name}</span>
          : <a className="spis-btn" href="#"><IconArrowLeft size={18} /> Nástěnka</a>}
        <PrintButton label="Vytisknout spis" />
      </div>
      {place.view === "home" && <Home doc={doc} academy={academy} />}
      {place.view === "chapter" && <Page kicker={place.chapter.kicker} title={place.chapter.title} blocks={place.chapter.blocks} />}
      {place.view === "academy" && (
        <Page kicker={KIND_LABEL[place.entry.kind].one} title={place.entry.name} sub={place.entry.sub}
          blocks={place.entry.blocks} empty="O této skupině zatím nic veřejného nevíme." />
      )}
    </div>
  )
}

function Home({ doc, academy }: { doc: CharacterDoc; academy: AcademyEntry[] }) {
  const h = doc.header
  const sub = (c: DocChapter): string | undefined => {
    switch (c.key) {
      case "core": return [h.specialization, h.origin].filter(Boolean).join(" · ") || undefined
      case "team": return h.teammates.length ? `s tebou ${h.teammates.join(" a ")}` : undefined
      case "unit": return academy.find(a => a.kind === "unit" && a.mine)?.sub
      case "circle": return academy.find(a => a.kind === "circle" && a.mine)?.sub
    }
  }
  const lead = (c: DocChapter) => {
    const b = c.blocks.find(x => x.title === "Medailonek") ?? c.blocks[0]
    return b ? excerpt(b.body, 150) : ""
  }

  return (
    <div className="spis-sheet kn-home">
      <div className="spis-cover-top">
        <span>Akademie Akano</span>
        <span>{[doc.runName, doc.runDate].filter(Boolean).join(" · ")}</span>
      </div>
      <div className="spis-double-rule" />
      <h1 className="kn-name">{doc.character.name}</h1>
      <p className="kn-facts">{[h.team, h.unit && `jednotka ${h.unit}`, h.circle && `kruh ${h.circle}`].filter(Boolean).join(" · ")}</p>

      <section aria-labelledby="kn-ty">
        <h2 id="kn-ty" className="spis-label kn-section">Ty a tvoje skupiny</h2>
        <div className="kn-mine">
          {doc.chapters.map(c => (
            <a key={c.key} href={hrefOfChapter(c)} className={c.key === "core" ? "kn-card kn-card-self" : "kn-card"}>
              <span className="spis-label">{c.kicker}</span>
              <span className="kn-card-title">{c.title}</span>
              {sub(c) && <span className="kn-card-sub">{sub(c)}</span>}
              {lead(c) && <span className="kn-card-lead">{lead(c)}</span>}
              <span className="kn-card-more">{textCount(c.blocks.length)} <IconChevronRight size={14} /></span>
            </a>
          ))}
        </div>
      </section>

      {(["team", "unit", "circle"] as const).map(kind => {
        const list = academy.filter(a => a.kind === kind)
        if (list.length === 0) return null
        return (
          <section key={kind} aria-labelledby={`kn-${kind}`}>
            <h2 id={`kn-${kind}`} className="spis-label kn-section">Akademie · {KIND_LABEL[kind].many}</h2>
            <div className="kn-grid">
              {list.map(e => {
                const medal = e.blocks.find(b => b.title === "Medailonek") ?? e.blocks[0]
                return (
                  <a key={e.id} href={hrefOfEntry(e, doc)} className={e.mine ? "kn-tile kn-tile-mine" : "kn-tile"}>
                    <span className="kn-tile-title">{e.name}{e.mine && <span className="kn-mine-mark">tvoje</span>}</span>
                    {e.sub && <span className="kn-card-sub">{e.sub}</span>}
                    <span className="kn-tile-lead">{medal ? excerpt(medal.body, 110) : "Zatím bez popisu."}</span>
                  </a>
                )
              })}
            </div>
          </section>
        )
      })}
    </div>
  )
}

function Page({ kicker, title, sub, blocks, empty }: {
  kicker: string; title: string; sub?: string
  blocks: DocChapter["blocks"]; empty?: string
}) {
  return (
    <article className="spis-sheet spis kn-page" lang="cs">
      <header className="spis-chapter-head">
        <div>
          <p className="spis-label">{kicker}</p>
          <h1 className="spis-chapter-title">{title}</h1>
          {sub && <p className="kn-card-sub" style={{ marginTop: 4 }}>{sub}</p>}
        </div>
      </header>
      {blocks.length === 0
        ? <p className="spis-empty">{empty ?? "Zatím tu nic není."}</p>
        : blocks.map(b => <SpisBlock key={b.key} block={b} />)}
    </article>
  )
}

function textCount(n: number) {
  return n === 1 ? "1 text" : n >= 2 && n <= 4 ? `${n} texty` : `${n} textů`
}
