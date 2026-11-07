import React from "react"
import { romanNumeral } from "@/lib/utils"
import { DOC_LEVEL, DOC_LEVEL_LABELS, type CharacterDoc, type DocBlock, type DocLevel, type DocVisibility, type DogTag, type MemberGroup } from "@/lib/character-doc"
import { SpisText, WithNames } from "./spis-text"

// Spis postavy: titulní strana a kapitoly. Černobílý, na bílý papír A4.
// Stejná komponenta slouží hráčům (/spis/[odkaz]) i náhledu a tisku v Přípravě.

const LEVEL_ORDER: DocLevel[] = ["self", "group", "public"]

export function Tag({ level }: { level: DocLevel }) {
  return <span className={`spis-tag spis-tag-${level}`}>{DOC_LEVEL_LABELS[level]}</span>
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
  const used = new Set<DocVisibility>(doc.chapters.flatMap(c => c.blocks.map(b => b.visibility)))
  const usedLevels = LEVEL_ORDER.filter(l => [...used].some(v => DOC_LEVEL[v] === l))

  return (
    <article className="spis" lang="cs">
      <section className="spis-cover">
        <div className="spis-cover-top">
          <span>Akademie Akano</span>
          <span>{[doc.runName, doc.runDate].filter(Boolean).join(" · ")}</span>
        </div>
        <div className="spis-double-rule" />
        <p className="spis-cover-kicker">Osobní spis studenta</p>
        <h1 className="spis-name">{doc.character.name}</h1>

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
            {usedLevels.map(l => (
              <li key={l}><Tag level={l} /> {LEGEND[l]}</li>
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
          {c.members && <Members groups={c.members} roster={doc.roster} self={doc.character.name} />}
          {c.blocks.map(b => <SpisBlock key={b.key} block={b} showStatus={showStatus} roster={doc.roster} />)}
        </section>
      ))}

      {doc.chapters.length === 0 && (
        <p className="spis-empty">Spis zatím nemá žádné texty.</p>
      )}
    </article>
  )
}

/** Jeden text spisu s nadpisem a štítkem; sdílí ho tisk i osobní knihovna. */
export function SpisBlock({ block: b, showStatus = false, roster }: { block: DocBlock; showStatus?: boolean; roster?: DogTag[] }) {
  return (
    <section className={`spis-block${b.voice ? ` spis-voice-${b.voice}` : ""}`}>
      <div className="spis-block-head">
        <h3>{b.title}</h3>
        <Tag level={DOC_LEVEL[b.visibility]} />
      </div>
      {showStatus && b.approved === false && <p className="spis-draft no-print">Text ještě není schválený</p>}
      <SpisText body={b.body} roster={roster} />
    </section>
  )
}

/** Kdo ve skupině je, na začátku kapitoly. Jména mají dogtag, hráč je označený „ty“. */
export function Members({ groups, roster, self }: { groups: MemberGroup[]; roster?: DogTag[]; self?: string }) {
  return (
    <dl className="spis-members">
      {groups.map((g, i) => (
        <div key={i}>
          <dt>{g.label ?? "Členové"}</dt>
          <dd>
            {g.names.map((n, j) => (
              <React.Fragment key={n}>
                {j > 0 && ", "}
                <WithNames text={n} roster={roster} />
                {n === self && <span className="spis-members-self"> (ty)</span>}
              </React.Fragment>
            ))}
          </dd>
        </div>
      ))}
    </dl>
  )
}

const LEGEND: Record<DocLevel, string> = {
  self: "nikdo jiný",
  group: "ostatní ze skupiny, o které kapitola je: tvůj tým, jednotka nebo kruh",
  public: "všechny postavy na larpu; medailonky znají hráči už před přihláškou",
}
