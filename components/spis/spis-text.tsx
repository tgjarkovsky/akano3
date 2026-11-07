import React from "react"
import { parseInlineLinks } from "@/lib/wiki-inline-links"
import { splitNames } from "@/lib/dogtag"
import type { DogTag } from "@/lib/character-doc"

// Text spisu pro čtení a tisk. Stejné značky jako knihovna (## nadpis, - body,
// **tučně**, *kurzíva*, --- oddělovač), ale s typografií pro papír.
// Odkazy [[slug|text]] se vypíšou jen jako text. Jména postav z roster dostanou
// dogtag: při najetí myší nebo klepnutí se ukáže tým, rod, jednotka, kruh…

type Group =
  | { kind: "p" | "h2" | "h3" | "quote"; text: string }
  | { kind: "ul" | "ol"; items: string[] }
  | { kind: "hr" }

function groupLines(body: string): Group[] {
  const out: Group[] = []
  for (const raw of body.split("\n")) {
    const line = raw.trimEnd()
    if (!line.trim()) continue
    const last = out[out.length - 1]
    const bullet = line.match(/^[-*] (.+)$/)
    const num = line.match(/^\d+[.)] (.+)$/)
    if (bullet) { if (last?.kind === "ul") last.items.push(bullet[1]); else out.push({ kind: "ul", items: [bullet[1]] }); continue }
    if (num)    { if (last?.kind === "ol") last.items.push(num[1]);    else out.push({ kind: "ol", items: [num[1]] });    continue }
    if (/^-{3,}$/.test(line.trim())) { out.push({ kind: "hr" }); continue }
    if (line.startsWith("### ")) { out.push({ kind: "h3", text: line.slice(4) }); continue }
    if (line.startsWith("## "))  { out.push({ kind: "h2", text: line.slice(3) }); continue }
    if (line.startsWith("# "))   { out.push({ kind: "h2", text: line.slice(2) }); continue }
    if (line.startsWith("> "))   { out.push({ kind: "quote", text: line.slice(2) }); continue }
    out.push({ kind: "p", text: line.trim() })
  }
  return out
}

const CJK = /[\u3040-\u30ff\u4e00-\u9fff]/

const DOGTAG_ROWS: [keyof DogTag, string][] = [
  ["gender", "Rod"], ["team", "Tým"], ["unit", "Jednotka"], ["circle", "Kruh"],
  ["specialization", "Specializace"], ["origin", "Původ"],
]

/** Jméno postavy s náhledem základních údajů. Jen CSS: najetí myší, nebo fokus po klepnutí. */
export function Dogtag({ tag, children }: { tag: DogTag; children: React.ReactNode }) {
  const rows = DOGTAG_ROWS.filter(([k]) => tag[k])
  return (
    <span className="dogtag" tabIndex={0}>
      {children}
      <span className="dogtag-card" role="tooltip">
        <span className="dogtag-name">{tag.name}</span>
        {rows.map(([k, label]) => (
          <span key={k} className="dogtag-row"><span className="dogtag-key">{label}</span><span>{tag[k]}</span></span>
        ))}
      </span>
    </span>
  )
}

/** Text s jmény postav obalenými dogtagem. */
export function WithNames({ text, roster }: { text: string; roster?: DogTag[] }): React.ReactNode {
  if (!roster?.length) return text
  return splitNames(text, roster).map((seg, i) => {
    const tag = seg.id ? roster.find(r => r.id === seg.id) : undefined
    return tag ? <Dogtag key={i} tag={tag}>{seg.text}</Dogtag> : seg.text
  })
}

function inline(text: string, roster?: DogTag[]): React.ReactNode {
  const plain = parseInlineLinks(text).map(s => s.type === "link" ? s.label : s.text).join("")
  const parts: React.ReactNode[] = []
  const re = /\*\*(.+?)\*\*|\*(.+?)\*/g
  let last = 0
  const words = (t: string, key: string | number) => <React.Fragment key={key}><WithNames text={t} roster={roster} /></React.Fragment>
  for (const m of plain.matchAll(re)) {
    if (m.index > last) parts.push(words(plain.slice(last, m.index), `t${last}`))
    parts.push(m[1] != null
      ? <strong key={m.index}><WithNames text={m[1]} roster={roster} /></strong>
      : <em key={m.index}><WithNames text={m[2]} roster={roster} /></em>)
    last = m.index + m[0].length
  }
  if (last < plain.length) parts.push(words(plain.slice(last), `t${last}`))
  return parts
}

export function SpisText({ body, roster }: { body: string; roster?: DogTag[] }) {
  const inline_ = (t: string) => inline(t, roster)
  return (
    <div className="spis-text">
      {groupLines(body).map((g, i) => {
        switch (g.kind) {
          case "p":     return <p key={i}>{inline_(g.text)}</p>
          case "h2":    return <h4 key={i} className="spis-subhead">{inline_(g.text)}</h4>
          case "h3":    return <h5 key={i} className="spis-minorhead">{inline_(g.text)}</h5>
          // Úsloví v kanji na začátku textu (medailonky týmů a jednotek) jako motto.
          case "quote": return i === 0 && CJK.test(g.text)
            ? <p key={i} className="spis-motto">{inline_(g.text)}</p>
            : <blockquote key={i}>{inline_(g.text)}</blockquote>
          case "hr":    return <p key={i} className="spis-asterism" aria-hidden="true">⁂</p>
          case "ul":    return <ul key={i}>{g.items.map((t, j) => <li key={j}>{inline_(t)}</li>)}</ul>
          case "ol":    return <ol key={i}>{g.items.map((t, j) => <li key={j}>{inline_(t)}</li>)}</ol>
        }
      })}
    </div>
  )
}
