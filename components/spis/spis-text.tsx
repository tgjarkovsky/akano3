import React from "react"
import { parseInlineLinks } from "@/lib/wiki-inline-links"

// Text spisu pro čtení a tisk. Stejné značky jako knihovna (## nadpis, - body,
// **tučně**, *kurzíva*, --- oddělovač), ale s typografií pro papír.
// Odkazy [[slug|text]] se vypíšou jen jako text.

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

function inline(text: string): React.ReactNode {
  const plain = parseInlineLinks(text).map(s => s.type === "link" ? s.label : s.text).join("")
  const parts: React.ReactNode[] = []
  const re = /\*\*(.+?)\*\*|\*(.+?)\*/g
  let last = 0
  for (const m of plain.matchAll(re)) {
    if (m.index > last) parts.push(plain.slice(last, m.index))
    parts.push(m[1] != null ? <strong key={m.index}>{m[1]}</strong> : <em key={m.index}>{m[2]}</em>)
    last = m.index + m[0].length
  }
  if (last < plain.length) parts.push(plain.slice(last))
  return parts
}

export function SpisText({ body }: { body: string }) {
  return (
    <div className="spis-text">
      {groupLines(body).map((g, i) => {
        switch (g.kind) {
          case "p":     return <p key={i}>{inline(g.text)}</p>
          case "h2":    return <h4 key={i} className="spis-subhead">{inline(g.text)}</h4>
          case "h3":    return <h5 key={i} className="spis-minorhead">{inline(g.text)}</h5>
          // Úsloví v kanji na začátku textu (medailonky týmů a jednotek) jako motto.
          case "quote": return i === 0 && CJK.test(g.text)
            ? <p key={i} className="spis-motto">{inline(g.text)}</p>
            : <blockquote key={i}>{inline(g.text)}</blockquote>
          case "hr":    return <p key={i} className="spis-asterism" aria-hidden="true">⁂</p>
          case "ul":    return <ul key={i}>{g.items.map((t, j) => <li key={j}>{inline(t)}</li>)}</ul>
          case "ol":    return <ol key={i}>{g.items.map((t, j) => <li key={j}>{inline(t)}</li>)}</ol>
        }
      })}
    </div>
  )
}
