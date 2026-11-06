import React from "react"
import { romanNumeral } from "@/lib/utils"
import { DOC_VISIBILITY_LABELS, type CharacterDoc, type DocVisibility } from "@/lib/character-doc"
import { SpisText } from "./spis-text"

// Spis postavy: titulní strana a kapitoly. Černobílý, na bílý papír A4.
// Stejná komponenta slouží hráčům (/spis/[odkaz]) i náhledu a tisku v Přípravě.

const TAG_ORDER: DocVisibility[] = ["self", "team", "unit", "circle", "public"]

function Tag({ v }: { v: DocVisibility }) {
  return <span className={`spis-tag spis-tag-${v}`}>{DOC_VISIBILITY_LABELS[v]}</span>
}

export function SpisDocument({ doc, showStatus = false }: { doc: CharacterDoc; showStatus?: boolean }) {
  const h = doc.header
  const facts: [string, string | undefined][] = [
    ["Tým", h.team],
    ["V týmu s tebou", h.teammates.length ? h.teammates.join(", ") : undefined],
    ["Jednotka", h.unit],
    ["Specializace", h.specialization],
    ["Původ", h.origin],
    ["Kruh", h.circle],
  ]
  const usedTags = TAG_ORDER.filter(v => doc.chapters.some(c => c.blocks.some(b => b.visibility === v)))

  return (
    <article className="spis" lang="cs">
      <section className="spis-cover">
        <div className="spis-cover-top">
          <span>Akademie Akano</span>
          <span>{doc.runName}</span>
        </div>
        <div className="spis-double-rule" />
        <p className="spis-cover-kicker">Osobní spis studenta</p>
        <h1 className="spis-name">{doc.character.name}</h1>
        {doc.character.nickname && <p className="spis-nickname">„{doc.character.nickname}“</p>}

        <dl className="spis-facts">
          {facts.filter(([, v]) => v).map(([k, v]) => (
            <div key={k}><dt>{k}</dt><dd>{v}</dd></div>
          ))}
        </dl>

        {doc.chapters.length > 0 && (
          <nav className="spis-toc" aria-label="Obsah">
            <p className="spis-label">Obsah</p>
            <ol>
              {doc.chapters.map((c, i) => (
                <li key={c.key}>
                  <span className="spis-toc-num">{romanNumeral(i + 1)}</span>
                  <span className="spis-toc-kicker">{c.kicker}</span>
                  <span className="spis-toc-title">{c.title}</span>
                </li>
              ))}
            </ol>
          </nav>
        )}

        <div className="spis-cover-note">
          <p className="spis-cover-note-title">Jen pro tebe</p>
          <p>Tenhle spis patří jen tobě, neukazuj ho ostatním. U každého textu je štítek, kdo další ho zná:</p>
          <ul className="spis-tag-legend">
            {usedTags.map(v => (
              <li key={v}><Tag v={v} /> {LEGEND[v]}</li>
            ))}
          </ul>
        </div>
      </section>

      {doc.chapters.map((c, i) => (
        <section key={c.key} className="spis-chapter">
          <header className="spis-chapter-head">
            <span className="spis-chapter-num">{romanNumeral(i + 1)}</span>
            <div>
              <p className="spis-label">{c.kicker}</p>
              <h2 className="spis-chapter-title">{c.title}</h2>
            </div>
          </header>
          {c.blocks.map(b => (
            <section key={b.key} className="spis-block">
              <div className="spis-block-head">
                <h3>{b.title}</h3>
                <Tag v={b.visibility} />
              </div>
              {showStatus && b.approved === false && <p className="spis-draft no-print">Text ještě není schválený</p>}
              <SpisText body={b.body} />
            </section>
          ))}
        </section>
      ))}

      {doc.chapters.length === 0 && (
        <p className="spis-empty">Spis zatím nemá žádné texty.</p>
      )}
    </article>
  )
}

const LEGEND: Record<DocVisibility, string> = {
  self: "nikdo jiný",
  team: "i tvůj tým",
  unit: "celá tvoje jednotka",
  circle: "členové tvého kruhu",
  public: "všichni",
}
