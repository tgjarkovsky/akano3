// Hledání jmen postav v textu spisu, i ve skloňovaných tvarech
// (Šigena, Mušašiho, Kaje, Annou, Šigenův, Mimina…). Čistá funkce, sdílí ji
// server i prohlížeč. Jména jsou s velkým písmenem, ostatní slova se nechytají:
// za kmenem smí být jen česká koncovka a hned za ní konec slova, takže
// „Ren“ chytí „Rena“ i „Renovi“, ale ne „Renka“.

type Named = { id: string; name: string }

export type NameSegment = { text: string; id?: string }

// Koncovky podle zakončení jména.
const AFTER_CONSONANT = ["ových", "ovým", "ovou", "ovi", "ova", "ovo", "ovu", "ovy", "ově", "ové", "em", "ův", "a", "e", "u", "y"]
const AFTER_A = ["iných", "iným", "inou", "ina", "ino", "inu", "iny", "ině", "ou", "in", "a", "e", "ě", "i", "o", "u", "y"]
const AFTER_O = ["ových", "ovým", "ovou", "ovi", "ova", "ovo", "ovu", "ovy", "ově", "em", "ův", "a", "u", "o"]
const AFTER_VOWEL = ["ových", "ovým", "ovou", "ovi", "ova", "ovo", "ovu", "ovy", "ově", "ného", "nými", "ných", "ným", "nou", "ho", "mu", "na", "no", "nu", "ny", "ně", "m", "n"]

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
const alt = (xs: string[]) => xs.map(escape).join("|")

/** Výraz pro jedno jméno: celé jméno, nebo kmen s koncovkou. */
function pattern(name: string): string {
  const last = name.slice(-1)
  if (name.length >= 3 && last === "a") return `${escape(name.slice(0, -1))}(?:${alt(AFTER_A)})`
  if (name.length >= 3 && last === "o") return `${escape(name)}|${escape(name.slice(0, -1))}(?:${alt(AFTER_O)})`
  if (/[aeiouyáéíóúůý]$/i.test(last)) return `${escape(name)}(?:${alt(AFTER_VOWEL)})?`
  return `${escape(name)}(?:${alt(AFTER_CONSONANT)})?`
}

type Finder = { re: RegExp; each: { id: string; re: RegExp }[] }
const cache = new WeakMap<readonly Named[], Finder>()

function finder(people: readonly Named[]): Finder {
  let f = cache.get(people)
  if (!f) {
    // Delší jména napřed, ať kratší jméno nesebere začátek delšího.
    const sorted = [...people].filter(p => p.name.trim()).sort((a, b) => b.name.length - a.name.length)
    const body = sorted.map(p => `(?:${pattern(p.name)})`).join("|")
    f = {
      re: new RegExp(`(?<![\\p{L}\\p{N}])(?:${body || "(?!)"})(?![\\p{L}\\p{N}])`, "gu"),
      each: sorted.map(p => ({ id: p.id, re: new RegExp(`^(?:${pattern(p.name)})$`, "u") })),
    }
    cache.set(people, f)
  }
  return f
}

/** Rozdělí text na úseky; úsek se jménem postavy nese její id. */
export function splitNames(text: string, people: readonly Named[]): NameSegment[] {
  if (!text || people.length === 0) return [{ text }]
  const { re, each } = finder(people)
  const out: NameSegment[] = []
  let last = 0
  for (const m of text.matchAll(re)) {
    const id = each.find(e => e.re.test(m[0]))?.id
    if (!id) continue
    if (m.index > last) out.push({ text: text.slice(last, m.index) })
    out.push({ text: m[0], id })
    last = m.index + m[0].length
  }
  if (last < text.length) out.push({ text: text.slice(last) })
  return out.length ? out : [{ text }]
}
