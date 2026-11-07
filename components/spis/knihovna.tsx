"use client"

import React, { useEffect, useId, useRef, useState } from "react"
import { IconArrowLeft, IconChevronRight, IconFileText, IconX } from "@tabler/icons-react"
import { excerpt, type AcademyEntry, type AcademyKind, type CharacterDoc, type DocChapter } from "@/lib/character-doc"
import { SpisBlock, SpisDocument } from "./spis-document"
import { SpisText } from "./spis-text"
import { PrintButton } from "./print-button"

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
      {place.view === "chapter" && <Page kicker={place.chapter.kicker} title={place.chapter.title} blocks={place.chapter.blocks} />}
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
              {list.map(e => <GroupTile key={e.id} entry={e} />)}
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

// Skupina, kde hráč není: dlaždice a náhled s medailonkem a veřejným textem.
// Myš: náhled se ukáže při najetí a zmizí po odjetí (i z náhledu).
// Klepnutí nebo Enter: náhled zůstane otevřený, zavře ho křížek, Esc nebo klik jinam.
function GroupTile({ entry: e }: { entry: AcademyEntry }) {
  const [open, setOpen] = useState<"hover" | "pinned" | null>(null)
  const [alignRight, setAlignRight] = useState(false)
  const [above, setAbove] = useState(false)
  const wrap = useRef<HTMLDivElement>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const id = useId()
  const medal = e.blocks.find(b => b.title === "Medailonek") ?? e.blocks[0]

  const place = () => {
    const r = wrap.current?.getBoundingClientRect()
    if (!r) return
    setAlignRight(r.left + 380 > window.innerWidth)
    // U spodního okraje okna se náhled otevře nad dlaždicí.
    setAbove(window.innerHeight - r.bottom < 320 && r.top > window.innerHeight - r.bottom)
  }
  const clear = () => { if (timer.current) clearTimeout(timer.current); timer.current = null }
  const hoverIn = (ev: React.PointerEvent) => {
    if (ev.pointerType !== "mouse") return
    clear()
    if (open) return
    timer.current = setTimeout(() => { place(); setOpen("hover") }, 180)
  }
  const hoverOut = (ev: React.PointerEvent) => {
    if (ev.pointerType !== "mouse") return
    clear()
    setOpen(o => (o === "hover" ? null : o))
  }

  useEffect(() => {
    if (open !== "pinned") return
    const onKey = (ev: KeyboardEvent) => { if (ev.key === "Escape") setOpen(null) }
    const onDown = (ev: PointerEvent) => { if (!wrap.current?.contains(ev.target as Node)) setOpen(null) }
    document.addEventListener("keydown", onKey)
    document.addEventListener("pointerdown", onDown)
    return () => { document.removeEventListener("keydown", onKey); document.removeEventListener("pointerdown", onDown) }
  }, [open])
  useEffect(() => clear, [])

  return (
    <div ref={wrap} className="kn-peek-wrap" onPointerEnter={hoverIn} onPointerLeave={hoverOut}>
      <button type="button" className="kn-tile" aria-expanded={open !== null} aria-controls={id}
        onClick={() => { clear(); place(); setOpen(o => (o === "pinned" ? null : "pinned")) }}>
        <span className="kn-tile-title">{e.name}</span>
        {e.sub && <span className="kn-card-sub">{e.sub}</span>}
        <span className="kn-tile-lead">{medal ? excerpt(medal.body, 110) : "Zatím bez popisu."}</span>
      </button>
      {open && (
        <div id={id} role="dialog" aria-label={`${KIND_LABEL[e.kind].one} ${e.name}`}
          className={`kn-peek${alignRight ? " kn-peek-right" : ""}${above ? " kn-peek-above" : ""}`}>
          <div className="kn-peek-head">
            <div>
              <p className="spis-label">{KIND_LABEL[e.kind].one}</p>
              <p className="kn-peek-title">{e.name}</p>
              {e.sub && <p className="kn-card-sub">{e.sub}</p>}
            </div>
            <button type="button" className="kn-peek-close" aria-label="Zavřít náhled" onClick={() => setOpen(null)}>
              <IconX size={16} />
            </button>
          </div>
          {e.blocks.length === 0
            ? <p className="kn-peek-empty">O této skupině zatím nic veřejného nevíme.</p>
            : e.blocks.map(b => (
              <section key={b.key} className="kn-peek-block">
                <p className="kn-peek-label">{b.title}</p>
                <SpisText body={b.body} />
              </section>
            ))}
        </div>
      )}
    </div>
  )
}
