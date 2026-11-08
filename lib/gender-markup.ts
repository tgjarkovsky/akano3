// Rodové značky v textech. Postavy mohou v různých bězích hrát muži i ženy,
// proto se tvary závislé na rodu píšou oba a spis dosadí ten správný:
//
//   {byl|byla}            rod čtenáře spisu (postavy, jejíž spis to je)
//   {Skála: byl|byla}     rod jmenované postavy (jméno nebo id, např. S014)
//   {@ctitel: byl|byla}   rod držitele role (klíč role v jednotce textu)
//
// Bez známého rodu zůstane „byl/byla“. Mužský tvar je vždy první.
//
// Šablona role {@ctitel} dosadí jméno postavy, která roli v běhu drží;
// když ji nikdo nedrží (nebo to není známo), dosadí název role.

export type Gender = "m" | "f"

export type GenderContext = {
  /** rod čtenáře; ve sdíleném textu (tým, jednotka…) taky čtenář */
  self?: Gender | null
  /** rod podle jména nebo id postavy */
  of?: (nameOrId: string) => Gender | null | undefined
  /** rod držitele role podle klíče (bez @) */
  role?: (key: string) => Gender | null | undefined
}

export const GENDER_MARK = /\{(?:([^{}|:\n]{1,40}):\s*)?([^{}|\n]{0,60})\|([^{}|\n]{0,60})\}/g
export const ROLE_MARK = /\{@([a-z][a-z0-9_]{0,29})\}/g

export function resolveGender(body: string, ctx: GenderContext): string {
  if (!body.includes("{")) return body
  return body.replace(GENDER_MARK, (_all, who: string | undefined, m: string, f: string) => {
    const w = who?.trim()
    const g = w === undefined ? ctx.self : w.startsWith("@") ? ctx.role?.(w.slice(1)) : ctx.of?.(w)
    if (g === "m") return m
    if (g === "f") return f
    return m === f ? m : `${m}/${f}`
  })
}

/** Dosadí šablony rolí {@klic}. Neznámý klíč (nameOf vrátí undefined) zůstane, jak je. */
export function resolveRoleNames(body: string, nameOf: (key: string) => string | undefined): string {
  if (!body.includes("{@")) return body
  return body.replace(ROLE_MARK, (all, key: string) => nameOf(key) ?? all)
}

/** Jména a id postav ve značkách, které v textu nikoho neoznačují (značky rolí se nepočítají). */
export function unknownGenderNames(body: string, known: (nameOrId: string) => boolean): string[] {
  const out = new Set<string>()
  for (const [, who] of body.matchAll(GENDER_MARK)) {
    const w = who?.trim()
    if (w !== undefined && !w.startsWith("@") && !known(w)) out.add(w)
  }
  return [...out]
}

/** Klíče rolí v šablonách {@klic} i rodových značkách {@klic: …|…}, které known nezná. */
export function unknownRoleKeys(body: string, known: (key: string) => boolean): string[] {
  const out = new Set<string>()
  for (const [, key] of body.matchAll(ROLE_MARK)) if (!known(key)) out.add(key)
  for (const [, who] of body.matchAll(GENDER_MARK)) {
    const w = who?.trim()
    if (w?.startsWith("@") && !known(w.slice(1))) out.add(w.slice(1))
  }
  return [...out]
}
