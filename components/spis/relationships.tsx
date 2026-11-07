import React from "react"
import type { DogTag } from "@/lib/character-doc"
import { splitNames } from "@/lib/dogtag"
import { excerpt } from "@/lib/character-doc"
import { relationLead, type Relation, type Relationships } from "@/lib/relationships"
import { SpisText } from "./spis-text"
import { PeekTile } from "./peek-tile"

// Vztahy postavy. V osobní knihovně dlaždice jako na nástěnce, celý popis
// v náhledu při najetí myší nebo klepnutí. V dokumentu a tisku karty s celým
// textem. Údaje o osobě (tým, jednotka…) jsou z běhu přes dogtag, ne z textu.

/** Dogtag osoby podle jména v nadpisu („Anna (Aquila)“ → Anna); NPC dogtag nemají. */
function tagOf(name: string, roster?: DogTag[]): DogTag | undefined {
  if (!roster?.length) return undefined
  const id = splitNames(name, roster).find(s => s.id)?.id
  return roster.find(r => r.id === id)
}

const who = (tag?: DogTag) => tag ? [tag.team, tag.unit && `jednotka ${tag.unit}`].filter(Boolean).join(" · ") : ""

function Facts({ person, tag }: { person: Relation; tag?: DogTag }) {
  const rows: [string, string][] = [
    ...(tag ? ([["Tým", tag.team], ["Jednotka", tag.unit], ["Kruh", tag.circle], ["Specializace", tag.specialization], ["Původ", tag.origin]]
      .filter(([, v]) => v) as [string, string][]) : []),
    ...person.facts.map(f => [f.key.charAt(0).toUpperCase() + f.key.slice(1), f.value] as [string, string]),
  ]
  if (rows.length === 0) return null
  return (
    <dl className="spis-rel-facts">
      {rows.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}
    </dl>
  )
}

export function RelationshipTiles({ rel, roster }: { rel: Relationships; roster?: DogTag[] }) {
  return (
    <>
      {rel.intro && <SpisText body={rel.intro} roster={roster} />}
      <div className="kn-grid spis-rel-grid">
        {rel.people.map((p, i) => {
          const tag = tagOf(p.name, roster)
          const lead = relationLead(p.body)
          return (
            <PeekTile key={`${p.name}-${i}`} label="Vztah" title={p.name}
              tile={<>
                {who(tag) && <span className="kn-card-sub">{who(tag)}</span>}
                <span className="kn-tile-lead">{lead ? excerpt(lead, 110) : "Zatím bez popisu."}</span>
              </>}>
              {{
                body: (
                  <section className="kn-peek-block">
                    <Facts person={p} tag={tag} />
                    {p.body ? <SpisText body={p.body} roster={roster} /> : <p className="kn-peek-empty">Zatím bez popisu.</p>}
                  </section>
                ),
              }}
            </PeekTile>
          )
        })}
      </div>
    </>
  )
}

export function RelationshipCards({ rel, roster }: { rel: Relationships; roster?: DogTag[] }) {
  return (
    <>
      {rel.intro && <SpisText body={rel.intro} roster={roster} />}
      <div className="spis-rel-cards">
        {rel.people.map((p, i) => {
          const tag = tagOf(p.name, roster)
          return (
            <article key={`${p.name}-${i}`} className="spis-rel-card">
              <h4 className="spis-rel-name">{p.name}</h4>
              <Facts person={p} tag={tag} />
              {p.body && <SpisText body={p.body} roster={roster} />}
            </article>
          )
        })}
      </div>
    </>
  )
}
