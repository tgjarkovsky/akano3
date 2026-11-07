// Vztahy postavy z textového pole „Vztahy“: pod nadpisem ### Jméno řádky
// údajů („čišiki: II“) a pak popis vztahu (odrážky, odstavce). Údaje, které
// ukazuje dogtag (rod, tým, původ, jednotka, kruh, specializace), se zahodí:
// dogtag je bere z aktuálního běhu, text by se s ním rozcházel.
// Čistá funkce, sdílí ji spis pro tisk i osobní knihovna.

export type RelationFact = { key: string; value: string }
export type Relation = { name: string; facts: RelationFact[]; body: string }
export type Relationships = { intro: string; people: Relation[] }

const DOGTAG_KEYS = new Set(["pohlaví", "rod", "tým", "původ", "jednotka", "kruh", "specializace"])
/** Údaje, které se na začátku osoby píšou („čišiki: II“); jiný „Slovo: …“ řádek už je popis. */
const FACT_KEYS = new Set([...DOGTAG_KEYS, "status", "čišiki", "pozice na žebříčku bodování", "pozice na žebříčku"])
const FACT = /^\s*([\p{L}][\p{L} ]{0,40}?)\s*:\s*(\S.*)$/u

/** Nevyplněné místo ze šablony postavy („něco“, „XXX“, „slovní popis/XXX“, „student/učitel/jiné“). */
const PLACEHOLDER = /xxx|^něco$|slovní popis|^student\/učitel/i

const clean = (s: string) => s.replace(/\*\*/g, "").replace(/\s+/g, " ").trim()

/** Rozdělí text vztahů po osobách; null, když text nemá žádný nadpis ### se jménem. */
export function parseRelationships(body: string): Relationships | null {
  const intro: string[] = []
  const people: { name: string; lines: string[] }[] = []
  for (const line of body.split("\n")) {
    const h = line.match(/^###\s*(.*)$/)
    if (h) {
      const name = clean(h[1])
      if (name) { people.push({ name, lines: [] }); continue }
      continue // prázdný nadpis ###: text patří dál k předchozí osobě
    }
    if (people.length) people[people.length - 1].lines.push(line)
    else intro.push(line)
  }
  if (people.length === 0) return null
  return {
    intro: intro.join("\n").trim(),
    people: people.map(p => {
      const facts: RelationFact[] = []
      const rest: string[] = []
      let head = true // údaje jsou na začátku, před prvním odstavcem či odrážkou
      for (const line of p.lines) {
        const m = head ? line.match(FACT) : null
        if (m && FACT_KEYS.has(m[1].trim().toLowerCase())) {
          const key = m[1].trim().toLowerCase()
          const value = clean(m[2])
          const skip = DOGTAG_KEYS.has(key) || PLACEHOLDER.test(value) || (key === "status" && value.toLowerCase() === "student")
          if (!skip) facts.push({ key: m[1].trim(), value })
          continue
        }
        if (line.trim()) head = false
        rest.push(line)
      }
      return { name: p.name, facts, body: rest.join("\n").trim() }
    }),
  }
}

/** První věta či odrážka popisu, pro dlaždici. */
export function relationLead(body: string): string {
  const first = body.split("\n").map(l => l.replace(/^\s*[-*]\s+/, "").trim()).find(Boolean) ?? ""
  return first.replace(/\*\*|\*/g, "")
}
