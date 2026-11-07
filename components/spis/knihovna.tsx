"use client"

import React, { useEffect, useState } from "react"
import { IconArrowLeft, IconChevronRight, IconFileText } from "@tabler/icons-react"
import { excerpt, type AcademyEntry, type AcademyKind, type CharacterDoc, type DocChapter } from "@/lib/character-doc"
import { Members, SpisBlock, SpisDocument } from "./spis-document"
import { SpisText, WithNames } from "./spis-text"
import { PrintButton } from "./print-button"
import { PeekTile } from "./peek-tile"

// Osobní knihovna hráče. Nahoře všechno, co je hráčovo: on sám a jeho skupiny
// (tým, jednotka, kruh) jako karty s vlastní stránkou. Pod tím ostatní skupiny
// akademie; ty stránku nemají, medailonek a veřejný text se ukážou v náhledu
// při najetí myší (na dotykovém displeji klepnutím). Kde hráč je, drží adresa
// za # (#tym, #dokument), takže funguje tlačítko Zpět. #dokument ukáže celý spis
// tak, jak se tiskne do PDF.

const CHAPTER_SLUG: Record<string, string> = { core: "ja", team: "tym", unit: "jednotka", circle: "kruh", traits: "zarazeni" }
const KIND_LABEL: Record<AcademyKind, { one: string; others: string }> = {
  team:   { one: "Tým",      others: "Ostatní týmy" },
  unit:   { one: "Jednotka", others: "Ostatní jednotky" },
  circle: { one: "Kruh",     others: "Ostatní kruhy" },
}

type Place = { view: "home" } | { view: "document" } | { view: "chapter"; chapter: DocChapter }

function readPlace(hash: string, doc: CharacterDoc): Place {
  const h = decodeURIComponent(hash.replace(/^#/, ""))
  if (h === "dokument") return { view: "document" }
  const chapter = doc.chapters.find(c => CHAPTER_SLUG[c.key] === h)
  return chapter ? { view: "chapter", chapter } : { view: "home" }
}

const hrefOfChapter = (c: DocChapter) => `#${CHAPTER_SLUG[c.key] ?? c.key}`

export function Knihovna({ doc, academy }: { doc: CharacterDoc; academy: AcademyEntry[] }) {
  const [place, setPlace] = useState<Place>({ view: "home" })

  useEffect(() => {
    const sync = () => {
      setPlace(readPlace(window.location.hash, doc))
      window.scrollTo(0, 0)
    }
    sync()
    window.addEventListener("hashchange", sync)
    return () => window.removeEventListener("hashchange", sync)
  }, [doc])

  return (
    <div className="kn">
      <div className="spis-toolbar">
        {place.view === "home"
          ? <span className="spis-toolbar-title">Osobní knihovna · {doc.character.name}</span>
          : <a className="spis-btn" href="#"><IconArrowLeft size={18} /> Nástěnka</a>}
        <span className="kn-toolbar-actions">
          {place.view !== "document" && <a className="spis-btn" href="#dokument"><IconFileText size={18} /> Spis jako dokument</a>}
          <PrintButton label={place.view === "document" ? "Vytisknout / uložit PDF" : "Vytisknout spis"} />
        </span>
      </div>
      {place.view === "home" && <Home doc={doc} academy={academy} />}
      {place.view === "document" && <div className="spis-sheet"><SpisDocument doc={doc} /></div>}
      {place.view === "chapter" && <Page chapter={place.chapter} doc={doc} />}
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
      <p className="kn-facts">{[h.team, h.unit && `jednotka ${h.unit}${h.role ? ` (${h.role})` : ""}`, h.circle && `kruh ${h.circle}`].filter(Boolean).join(" · ")}</p>

      <section aria-labelledby="kn-ty">
        <h2 id="kn-ty" className="spis-label kn-section kn-section-first">Ty a tvoje skupiny</h2>
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
        const list = academy.filter(a => a.kind === kind && !a.mine)
        if (list.length === 0) return null
        return (
          <section key={kind} aria-labelledby={`kn-${kind}`}>
            <h2 id={`kn-${kind}`} className="spis-label kn-section">{KIND_LABEL[kind].others}</h2>
            <div className="kn-grid">
              {list.map(e => <GroupTile key={e.id} entry={e} roster={doc.roster} />)}
            </div>
          </section>
        )
      })}
    </div>
  )
}

function Page({ chapter: c, doc }: { chapter: DocChapter; doc: CharacterDoc }) {
  return (
    <article className="spis-sheet spis kn-page" lang="cs">
      <header className="spis-chapter-head">
        <div>
          <p className="spis-label">{c.kicker}</p>
          <h1 className="spis-chapter-title">{c.title}</h1>
        </div>
      </header>
      {c.members && <Members groups={c.members} roster={doc.roster} self={doc.character.name} />}
      {c.blocks.length === 0
        ? <p className="spis-empty">Zatím tu nic není.</p>
        : c.blocks.map(b => <SpisBlock key={b.key} block={b} roster={doc.roster} interactive />)}
    </article>
  )
}

function textCount(n: number) {
  return n === 1 ? "1 text" : n >= 2 && n <= 4 ? `${n} texty` : `${n} textů`
}

// Skupina, kde hráč není: dlaždice a náhled s medailonkem a veřejným textem.
function GroupTile({ entry: e, roster }: { entry: AcademyEntry; roster?: CharacterDoc["roster"] }) {
  const medal = e.blocks.find(b => b.title === "Medailonek") ?? e.blocks[0]
  return (
    <PeekTile label={KIND_LABEL[e.kind].one} title={e.name}
      tile={<>
        {e.sub && <span className="kn-card-sub">{e.sub}</span>}
        <span className="kn-tile-lead">{medal ? excerpt(medal.body, 110) : "Zatím bez popisu."}</span>
      </>}>
      {{
        sub: e.sub && <p className="kn-card-sub"><WithNames text={e.sub} roster={roster} /></p>,
        body: e.blocks.length === 0
          ? <p className="kn-peek-empty">O této skupině zatím nic veřejného nevíme.</p>
          : e.blocks.map(b => (
            <section key={b.key} className="kn-peek-block">
              <p className="kn-peek-label">{b.title}</p>
              <SpisText body={b.body} roster={roster} />
            </section>
          )),
      }}
    </PeekTile>
  )
}
