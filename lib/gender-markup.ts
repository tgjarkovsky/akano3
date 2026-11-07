// Rodové značky v textech. Postavy mohou v různých bězích hrát muži i ženy,
// proto se tvary závislé na rodu píšou oba a spis dosadí ten správný:
//
//   {byl|byla}            rod čtenáře spisu (postavy, jejíž spis to je)
//   {Skála: byl|byla}     rod jmenované postavy (jméno nebo id, např. S014)
//
// Bez známého rodu zůstane „byl/byla“. Mužský tvar je vždy první.

export type Gender = "m" | "f"

export type GenderContext = {
  /** rod čtenáře; ve sdíleném textu (tým, jednotka…) taky čtenář */
  self?: Gender | null
  /** rod podle jména nebo id postavy */
  of?: (nameOrId: string) => Gender | null | undefined
}

export const GENDER_MARK = /\{(?:([^{}|:\n]{1,40}):\s*)?([^{}|\n]{0,60})\|([^{}|\n]{0,60})\}/g

export function resolveGender(body: string, ctx: GenderContext): string {
  if (!body.includes("{")) return body
  return body.replace(GENDER_MARK, (_all, who: string | undefined, m: string, f: string) => {
    const g = who === undefined ? ctx.self : ctx.of?.(who.trim())
    if (g === "m") return m
    if (g === "f") return f
    return m === f ? m : `${m}/${f}`
  })
}

/** Jména a id postav ve značkách, které v textu nikoho neoznačují. */
export function unknownGenderNames(body: string, known: (nameOrId: string) => boolean): string[] {
  const out = new Set<string>()
  for (const [, who] of body.matchAll(GENDER_MARK)) {
    if (who !== undefined && !known(who.trim())) out.add(who.trim())
  }
  return [...out]
}
