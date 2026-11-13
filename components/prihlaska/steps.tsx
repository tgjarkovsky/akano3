"use client"

import React, { useState } from "react"
import { SpisText } from "@/components/spis/spis-text"
import {
  RUN_CHOICES, SUBSTITUTE_CHOICES, NEWSLETTER_CHOICES, GENDER_CHOICES, KIND_LABELS, EDIT_UNTIL,
  findConflicts, fitsGender, openCount, prefOf, type Pref, type PrefKind,
} from "@/lib/prihlaska"
import { activeSteps, entriesOf, genderMark, onCard, showsCharacters, visibleEntries, type Draft, type StepId } from "./draft"
import { PrefCard, Motto, usePr } from "./parts"

// Obsah jednotlivých kroků přihlášky.

type StepProps = { draft: Draft; update: (fn: (d: Draft) => Draft) => void }

export function Head({ kicker, title, lead }: { kicker: string; title: string; lead?: React.ReactNode }) {
  return <>
    <div className="pr-kicker"><span>{kicker}</span></div>
    <div className="pr-rule2" />
    <h1>{title}</h1>
    {lead && <p className="pr-lead">{lead}</p>}
  </>
}

const until = new Date(EDIT_UNTIL).toLocaleDateString("cs-CZ", { day: "numeric", month: "numeric", year: "numeric" })

export function Intro() {
  return <>
    <Head kicker="22.–25. 7. a 29. 7.–1. 8. 2027" title="Přihláška na Akano 3"
      lead="Přihláška slouží k registraci i k výběru postavy. Medailonky postav, týmů, jednotek a kruhů čteš přímo tady." />
    <details className="pr-note"><summary>Jak přidělujeme postavy</summary>
      Losujeme 6 lidí na dospělé role a 30 na studentské. Z vylosovaných nejdřív sestavíme kompletní trojice, které se hlásily jako tým (nejvýš 5 týmů). Dvojicím doplníme jejich třetího. Zbytek obsadíme podle preferencí. Nakamuru přednostně dostane člověk se zrakovým postižením.
    </details>
    <details className="pr-note"><summary>Kdo uvidí odpovědi</summary>
      Odpovědi čtou za tým Kla a Guth, za admin Pikaču. Osobní údaje zpracovává Rolling, spolek pro rozvoj zážitkových vzdělávacích her (IČ 02296802), podrobnosti jsou v dokumentu Informace o zpracování osobních údajů na webu spolku. Když nám chceš něco říct mimo přihlášku, napiš Guthovi nebo Kle přes FB stránku Akano3.
    </details>
    <p className="pr-hint">Účast je možná jen pro plnoleté. Vyplnění zabere zhruba 20 minut, rozpracovaná přihláška se ukládá v tomhle prohlížeči. Po odeslání ji můžeš upravovat do {until}.</p>
  </>
}

/** Jak volit u postav a prvků; ukazuje se v prvním kroku s volbami. */
export function HowToChoose() {
  return (
    <div className="pr-note"><b>Jak vybírat.</b> U každé možnosti volíš <b>★ Chci moc</b>, <b>Klidně</b> nebo <b>✕ Nechci</b>. Všechno začíná na „Klidně“. Nevybírej jedinou postavu, spíš vyřaď, co hrát nechceš. Čím víc necháš otevřené, tím snáz ti postavu sestavíme. Když toho vyřadíš moc, nemusí se pro tebe postava najít, i když projdeš losováním.</div>
  )
}

function Field({ id, label, required, help, wide, children }: { id?: string; label: string; required?: boolean; help?: string; wide?: boolean; children: React.ReactNode }) {
  return (
    <div className={`pr-field${wide ? " pr-field-wide" : ""}`}>
      {id ? <label className="pr-flabel" htmlFor={id}>{label}{required && <span className="pr-req"> *</span>}</label>
        : <span className="pr-flabel">{label}{required && <span className="pr-req"> *</span>}</span>}
      {children}
      {help && <small>{help}</small>}
    </div>
  )
}

function Choices<T extends string | boolean>({ name, value, options, onChange, disabled, cols, label }: {
  name: string; value: T | "" | null; options: { value: T; label: string; sub?: string }[]; onChange: (v: T) => void; disabled?: boolean
  /** pevný počet sloupců; bez něj se volby skládají podle šířky */
  cols?: 2 | 3
  label?: string
}) {
  return (
    <div className={`pr-choices${cols ? ` pr-choices-${cols}` : ""}`} role="radiogroup" aria-label={label}>
      {options.map(o => (
        <label key={String(o.value)} className="pr-choice">
          <input type="radio" name={name} checked={value === o.value} onChange={() => onChange(o.value)} disabled={disabled} />
          <span><b>{o.label}</b>{o.sub && <span>{o.sub}</span>}</span>
        </label>
      ))}
    </div>
  )
}

/** Oddíl kroku: nadpis, nápověda a obsah. Všechny otázky kroku mají stejnou úroveň. */
function Question({ title, hint, required, children }: { title: string; hint?: string; required?: boolean; children: React.ReactNode }) {
  return (
    <section className="pr-question">
      <div className="pr-section"><h2>{title}{required && <span className="pr-req"> *</span>}</h2></div>
      {hint && <p className="pr-hint pr-question-hint">{hint}</p>}
      {children}
    </section>
  )
}

/** Zaškrtávací potvrzení: celý řádek je klikací, text v normálním písmu. */
function Check({ checked, onChange, disabled, children }: { checked: boolean; onChange: (v: boolean) => void; disabled?: boolean; children: React.ReactNode }) {
  return (
    <label className="pr-check">
      <input type="checkbox" checked={checked} disabled={disabled} onChange={e => onChange(e.target.checked)} />
      <span>{children}<span className="pr-req"> *</span></span>
    </label>
  )
}

type TextKey = "firstName" | "lastName" | "nickname" | "email" | "phone"

export function Person({ draft: d, update }: StepProps) {
  const { readOnly } = usePr()
  // name + autocomplete, ať prohlížeč nabídne uložené jméno, e-mail a telefon
  const text = (k: TextKey, name: string, type = "text", autoComplete = name) => (
    <input id={`pr-${k}`} name={name} className="pr-input" type={type} value={d[k]} autoComplete={autoComplete} disabled={readOnly}
      onChange={e => { const v = e.target.value; update(x => ({ ...x, [k]: v })) }} />
  )
  return <>
    <Head kicker="Krok 1" title="Základní údaje" lead={<>Pole s <span className="pr-req">*</span> jsou povinná.</>} />
    <Question title="Kontakt">
      <form className="pr-fields pr-fields-2" autoComplete="on" onSubmit={e => e.preventDefault()}>
        <Field id="pr-firstName" label="Jméno" required>{text("firstName", "given-name")}</Field>
        <Field id="pr-lastName" label="Příjmení" required>{text("lastName", "family-name")}</Field>
        <Field id="pr-email" label="E-mail" required>{text("email", "email", "email")}</Field>
        <Field id="pr-phone" label="Telefon" required>{text("phone", "tel", "tel")}</Field>
        <Field id="pr-nickname" label="Jméno do seznamů hráčů (nepovinné)" wide
          help="Když tě lidi znají jinak než podle občanského jména. Uveď i příjmení, ať je jasné, o koho jde.">{text("nickname", "nickname", "text", "off")}</Field>
      </form>
    </Question>
    <Question title="Na který běh chceš jet?" required>
      <Choices name="run" label="Běh" value={d.run} cols={3} disabled={readOnly} onChange={v => update(x => ({ ...x, run: v }))}
        options={RUN_CHOICES.map(o => ({ value: o.value, label: o.label.split(",")[0], sub: o.label.split(", ")[1] }))} />
    </Question>
    <Question title="Náhradnický seznam" required hint="Když se nedostaneš při prvním rozdělování, můžeme ti později nabídnout uvolněnou roli podle tvých preferencí. Jak dlouho ti můžeme psát?">
      <Choices name="substitute" label="Náhradnický seznam" value={d.substitute} cols={2} disabled={readOnly} onChange={v => update(x => ({ ...x, substitute: v }))}
        options={SUBSTITUTE_CHOICES.map(o => ({ value: o.value, label: o.label.replace(/ \(.*\)$/, ""), sub: o.label.match(/\((.*)\)/)?.[1] }))} />
    </Question>
    <Question title="Newsletter spolku Rolling" required hint="Chceš dostávat newsletter Rollingu do e-mailu?">
      <Choices name="newsletter" label="Newsletter" value={d.newsletter} cols={3} disabled={readOnly} onChange={v => update(x => ({ ...x, newsletter: v }))}
        options={NEWSLETTER_CHOICES.map(o => ({ value: o.value, label: o.label }))} />
    </Question>
    <Question title="Potvrzení">
      <div className="pr-checks">
        <Check checked={d.adult === true} disabled={readOnly} onChange={v => update(x => ({ ...x, adult: v }))}>
          V době hry mi bude aspoň 18 let.
        </Check>
        <Check checked={d.consent} disabled={readOnly} onChange={v => update(x => ({ ...x, consent: v }))}>
          Souhlasím se zpracováním osobních údajů z přihlášky spolkem Rolling (IČ 02296802) pro přípravu a organizaci hry Akano 3. Podrobnosti jsou v dokumentu Informace o zpracování osobních údajů na webu spolku.
        </Check>
      </div>
    </Question>
  </>
}

export function Paths({ draft: d, update }: StepProps) {
  const { catalog, readOnly } = usePr()
  const path = (k: keyof Draft["paths"], title: string, text: string, meta: string) => (
    <label className="pr-path">
      <input type="checkbox" checked={d.paths[k]} disabled={readOnly}
        onChange={e => { const v = e.target.checked; update(x => ({ ...x, paths: { ...x.paths, [k]: v } })) }} />
      <h3>{title}</h3><p>{text}</p><span className="pr-path-meta">{meta}</span>
    </label>
  )
  // Změna rodu zruší tým, jehož vybraná postava už do volby nepatří.
  const setGender = (g: Draft["genderPref"]) => update(x => ({
    ...x,
    genderPref: g,
    team: {
      ...x.team,
      picks: Object.fromEntries(Object.entries(x.team.picks).filter(([, c]) =>
        fitsGender(g, catalog.characters.find(ch => ch.id === c)?.gender))),
    },
  }))
  const next = activeSteps(d).slice(3, -1).map(s => s.label)
  return <>
    <Head kicker="Krok 2" title="Za co se hlásíš?" lead="Zaškrtni všechno, co tě láká. Podle toho ti ukážeme další kroky." />
    <div className="pr-paths">
      {path("adult", "Dospělá postava", "Učitelé a vedení akademie. Část hry hraješ monstrum se skriptovanějším obsahem.", "6 postav")}
      {path("team", "Tým se dvěma kamarády", "Hlásíte se jako celá trojice. Každý vyplní vlastní přihlášku a zvolí, koho z týmu bude hrát.", "10 týmů, nejvýš 5 se obsadí celých")}
      {path("student", "Studentská postava", "Jádro postavy (jméno, gender, tým, původ) je pevné. Jednotku, kruh a specializaci složíme podle tvých preferencí.", "30 postav")}
    </div>
    <div className="pr-section"><h2>Jaké postavy chceš hrát?</h2></div>
    <p className="pr-hint" style={{ marginTop: -4, marginBottom: 10 }}>Gender postav je pevný, crossgender je možný. Vybírat pak půjde jen z postav podle téhle volby, ostatní si můžeš přečíst. Nakamura je nebinární a vybrat ji můžeš vždy.</p>
    <Choices name="genderPref" value={d.genderPref} disabled={readOnly} onChange={setGender}
      options={GENDER_CHOICES.map(o => ({ value: o.value, label: o.label }))} />
    {next.length > 0 && <p className="pr-okline">Další kroky: {next.join(" → ")} → Souhrn</p>}
  </>
}

export function Adults({ draft: d, update, howTo }: StepProps & { howTo?: boolean }) {
  const { catalog, readOnly } = usePr()
  // Dospělí jiného genderu zůstávají vidět, jen ke čtení (bez volby).
  const fits = new Set(visibleEntries(catalog, "adult", d.genderPref).map(a => a.id))
  const adults = catalog.adults
  const list = adults.map(a => a.id)
  const nakamura = catalog.adults.find(a => a.name === "Nakamura")
  return <>
    <Head kicker="Dospělí a monstra" title="Dospělé postavy" lead="Postavy s pevným genderem, Nakamura je nebinární. Část hry každá z nich tráví jako monstrum." />
    {howTo && <HowToChoose />}
    <div className="pr-grid pr-grid-wide" style={{ marginTop: 20 }}>
      {adults.map(a => (
        <PrefCard key={a.id} kind="adult" entry={a} list={list} inactive={!fits.has(a.id)}>
          {a.id === nakamura?.id && fits.has(a.id) && prefOf(d.prefs, "adult", a.id) !== "no" && (
            <label className="pr-choice">
              <input type="checkbox" checked={d.visionImpaired} disabled={readOnly}
                onChange={e => { const v = e.target.checked; update(x => ({ ...x, visionImpaired: v })) }} />
              <span><b>Mám zrakové postižení</b><span>Postavu přednostně nabízíme lidem se zrakovým omezením.</span></span>
            </label>
          )}
        </PrefCard>
      ))}
    </div>
  </>
}

const GENDER_WORD = { f: "dívčí", m: "chlapecké" } as const

export function Team({ draft: d, update }: StepProps) {
  const { catalog, openReader, readOnly } = usePr()
  const t = d.team
  const setTeam = (patch: Partial<Draft["team"]>) => update(x => ({ ...x, team: { ...x.team, ...patch } }))
  // Výběr postavy = přihláška do týmu. Klik na vybranou postavu tým zase odhlásí.
  const pick = (teamId: string, characterId: string) => {
    const picks = { ...t.picks }
    if (picks[teamId] === characterId) delete picks[teamId]; else picks[teamId] = characterId
    setTeam({ picks })
  }
  const drop = (teamId: string) => {
    const picks = { ...t.picks }
    delete picks[teamId]
    setTeam({ picks })
  }
  const count = Object.keys(t.picks).length
  const other = d.genderPref === "f" || d.genderPref === "m" ? GENDER_WORD[d.genderPref] : null
  return <>
    <Head kicker="Tým" title="Hlásíme se jako tým" lead="Vybrat můžete i víc týmů, jen se domluvte, kdo bude hrát koho. Každý z trojice vyplní svou přihlášku." />
    <div className="pr-fields">
      <Field id="pr-mates" label="S kým se hlásíš (jména a příjmení obou)" required wide>
        <input id="pr-mates" className="pr-input" value={t.mates} disabled={readOnly} onChange={e => setTeam({ mates: e.target.value })} />
      </Field>
    </div>
    <div className="pr-section"><h2>Když vylosují jen tebe</h2></div>
    <p className="pr-hint" style={{ marginTop: -4, marginBottom: 10 }}>
      Losujeme jednotlivce. Když vylosují celou trojici, hrajete spolu; dvojici doplníme třetího z vás. Když vylosují jen tebe, tým se nedoplňuje.
    </p>
    <Choices name="solo" value={t.solo} disabled={readOnly} onChange={v => setTeam({ solo: v })} options={[
      { value: false, label: "Bez nich nejedu", sub: "Moje místo přejde na dalšího vylosovaného." },
      { value: true, label: "Pojedu i bez nich", sub: d.paths.student ? "Dostanu jinou studentskou postavu podle svých voleb." : "V dalším kroku si projdu i ostatní studentské postavy." },
    ]} />
    <div className="pr-section"><h2>Týmy</h2><span className="pr-label">{count ? `vybráno ${count}` : "zatím žádný"}</span></div>
    <p className="pr-hint" style={{ marginTop: -4 }}>U každého týmu, do kterého se hlásíte, klikni na postavu, kterou bys hrál(a).{other && ` Hraješ jen ${other} postavy, ostatní vybrat nejde.`}</p>
    <div className="pr-teams">
      {catalog.teams.map(team => {
        const on = team.id in t.picks
        const members = catalog.characters.filter(c => c.teamId === team.id)
        const fits = members.filter(m => fitsGender(d.genderPref, m.gender))
        const ids = members.map(m => m.id)
        return (
          <article key={team.id} className={`pr-trow${on ? " pr-trow-on" : ""}${fits.length ? "" : " pr-trow-off"}`}>
            <div className="pr-trow-text">
              <h3><i className="pr-dot" style={{ background: team.color }} />{team.name}</h3>
              <Motto motto={team.motto} />
              {team.body ? <SpisText body={team.body} /> : <p className="pr-hint">Medailonek zatím chybí.</p>}
              {team.themes.length > 0 && <p className="pr-themes">Témata: {team.themes.join(", ")}</p>}
            </div>
            <div className="pr-trow-pick">
              {fits.length === 0
                ? <p className="pr-hint">V týmu nejsou {other} postavy.</p>
                : <p className="pr-label">{on ? "Hlásím se, hrál(a) bych" : "Hrál(a) bych"}</p>}
              <div className="pr-who" role="radiogroup" aria-label={`Kterou postavu z týmu ${team.name}`}>
                {members.map(m => {
                  const ok = fits.includes(m)
                  return (
                    <div key={m.id} className={`pr-who-tile${ok ? "" : " pr-who-off"}`} title={ok ? undefined : `Hraješ jen ${other} postavy`}>
                      <label>
                        <input type="radio" name={`who-${team.id}`} checked={t.picks[team.id] === m.id} disabled={!ok || readOnly}
                          onClick={() => pick(team.id, m.id)} onChange={() => {}} />
                        <b>{m.name}</b><span>{genderMark(m.gender) || " "}</span>
                      </label>
                      <button type="button" className="pr-who-read" onClick={() => openReader("character", m.id, ids)} aria-label={`Číst medailonek: ${m.name}`}>číst</button>
                    </div>
                  )
                })}
              </div>
              {on && !readOnly && <button type="button" className="pr-who-drop" onClick={() => drop(team.id)}>Zrušit výběr týmu</button>}
            </div>
          </article>
        )
      })}
    </div>
  </>
}


/** Medailonek týmu: dva řádky, které se klikem rozbalí na celý text a zase sbalí. */
function TeamText({ body }: { body: string }) {
  const [open, setOpen] = useState(false)
  return (
    <div className={`pr-team-text${open ? " pr-team-text-open" : ""}`} role="button" tabIndex={0} aria-expanded={open}
      title={open ? "Sbalit medailonek týmu" : "Rozbalit medailonek týmu"}
      onClick={e => { if (!(e.target as HTMLElement).closest("a")) setOpen(o => !o) }}
      onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setOpen(o => !o) } }}>
      <SpisText body={body} />
    </div>
  )
}

export function Characters({ howTo }: { howTo?: boolean }) {
  const { catalog, prefs, setPref, readOnly, genderPref } = usePr()
  const shown = visibleEntries(catalog, "character", genderPref)
  const fits = new Set(shown.map(c => c.id))
  // Spoluhráči jiného genderu zůstávají v týmu vidět, jen ke čtení (bez volby).
  const visible = catalog.characters
  const list = visible.map(c => c.id)
  const bulk = (teamId: string, v: Pref) => shown.filter(c => c.teamId === teamId).forEach(c => setPref("character", c.id, v))
  const which = genderPref === "f" ? "dívčí postavy" : genderPref === "m" ? "chlapecké postavy" : null
  return <>
    <Head kicker="Studentstvo" title="Studentské postavy"
      lead={<>Postavy jsou po týmech{which && <>; vybírat můžeš jen {which}, ostatní členy týmů si můžeš přečíst</>}. ◆ označuje prvky, které má postava dané pevně.</>} />
    {howTo && <HowToChoose />}
    {catalog.teams.map(team => {
      const members = visible.filter(c => c.teamId === team.id)
      const playable = members.filter(c => fits.has(c.id))
      if (!playable.length) return null
      // Pevně dané prvky, které má celý tým, patří do hlavičky, ne na každou kartu.
      const all = catalog.characters.filter(c => c.teamId === team.id)
      const shared = (all[0]?.fixed ?? []).filter(f => onCard(f) && all.every(c => c.fixed?.includes(f)))
      const allNo = playable.every(c => prefOf(prefs, "character", c.id) === "no")
      return (
        <section key={team.id} className="pr-team">
          <div className="pr-team-head">
            <h3><i className="pr-dot" style={{ background: team.color }} />{team.name}</h3>
            <Motto motto={team.motto} />
            {!readOnly && (allNo
              ? <button type="button" className="pr-mini" onClick={() => bulk(team.id, "ok")}>Vrátit tým na klidně</button>
              : <button type="button" className="pr-mini" onClick={() => bulk(team.id, "no")}>✕ Nechci nikoho z týmu</button>)}
          </div>
          <div className="pr-team-meta">
            {shared.map(f => <span key={f} className="pr-chip pr-chip-fixed" title="Pevně dané celému týmu">◆ {f}</span>)}
            {team.themes.length > 0 && <span className="pr-themes">Témata: {team.themes.join(", ")}</span>}
          </div>
          {team.body && <TeamText body={team.body} />}
          <div className="pr-grid">{members.map(c => <PrefCard key={c.id} kind="character" entry={c} list={list} shared={shared} inactive={!fits.has(c.id)} />)}</div>
        </section>
      )
    })}
  </>
}

const LIMIT_WORD = { unit: "jednotku", circle: "kruh", specialization: "specializaci", origin: "původ" } as const

export function Conflicts() {
  const { catalog, prefs, genderPref } = usePr()
  const shown = new Set(visibleEntries(catalog, "character", genderPref).map(c => c.id))
  const list = findConflicts(prefs, catalog.limits).filter(c => shown.has(c.characterId))
  if (!list.length) return null
  const name = (id: string) => catalog.characters.find(c => c.id === id)?.name ?? id
  const wanted = list.filter(c => c.wanted)
  const rest = [...new Set(list.filter(c => !c.wanted).map(c => name(c.characterId)))]
  return (
    <div className="pr-warns">
      {wanted.map(c => (
        <div key={`${c.characterId}-${c.kind}`} className="pr-warn"><span className="pr-warn-tag">Střet</span>
          <span><b>{name(c.characterId)}</b> (★ chci moc) může mít jen {LIMIT_WORD[c.kind]} {c.allowed.map(v => entriesOf(catalog, c.kind).find(e => e.id === v)?.name ?? v).join(" nebo ")}, a to máš vyřazené. Vrať to na „Klidně“, nebo {name(c.characterId)} hrát nebudeš.</span></div>
      ))}
      {rest.length > 0 && <div className="pr-warn"><span className="pr-warn-tag">Info</span><span>Kvůli vyřazeným prvkům pro tebe nepřichází v úvahu: {rest.join(", ")}.</span></div>}
    </div>
  )
}

const GROUPS: { kind: PrefKind; title: string; hint: string }[] = [
  { kind: "unit", title: "Jednotky", hint: "Každá jednotka má dva týmy a vlastní velký příběh." },
  { kind: "circle", title: "Kruhy", hint: "Volnočasové skupiny, každý kruh řeší svůj příběh." },
  { kind: "specialization", title: "Specializace", hint: "Role v týmu při lovu." },
]

export function Elements({ howTo }: { howTo?: boolean }) {
  const { catalog, prefs, genderPref } = usePr()
  return <>
    <Head kicker="Volitelné prvky" title="Jednotky, kruhy a specializace"
      lead="Tyhle prvky se mění běh od běhu. Když volba vyloučí postavu, kterou chceš, upozorníme tě. Při křížení s předchozími kroky přidělujeme hlavně podle týmů a postav." />
    {howTo && <HowToChoose />}
    <Conflicts />
    {GROUPS.map(g => {
      const entries = visibleEntries(catalog, g.kind, genderPref)
      return (
        <section key={g.kind}>
          <div className="pr-section"><h2>{g.title}</h2></div>
          <p className="pr-hint" style={{ marginTop: -4 }}>{g.hint}</p>
          <div className="pr-grid" style={{ marginTop: 10 }}>
            {entries.map(e => <PrefCard key={e.id} kind={g.kind} entry={e} list={entries.map(x => x.id)} />)}
          </div>
        </section>
      )
    })}
  </>
}

/** Druhy voleb, které hráč v přihlášce opravdu vyplňuje. */
export function shownKinds(d: Draft): PrefKind[] {
  const out: PrefKind[] = []
  if (d.paths.adult) out.push("adult")
  if (showsCharacters(d)) out.push("character")
  if (d.paths.student || d.paths.team) out.push("unit", "circle", "specialization")
  return out
}

/** Texty z Webu (oddíl „Témata a citlivá témata“). */
const SENSITIVE_INTRO = [
  "V medailoncích se setkáš se dvěma pojmy: témata a citlivá témata. Oboje ti řekne něco o tom, čemu se bude příběh věnovat a čemu se nedá vyhnout. Pokud se s hraním těchto témat cítíš nekomfortně, zvol prosím jinou postavu, jednotku nebo kruh.",
  "Na hře se nevyskytuje sexuální násilí ani jakýkoliv sexuální obsah. Také se zde neřeší téma potratu nebo těhotenství.",
  "Co se naopak na hře vyskytuje a v podstatě nebude možné se tomu vyhnout, je téma smrti – smrt v rodině, smrt blízkého. I pokud by se netýkala přímo tvé postavy, rozhodně to bude téma někoho blízko tebe a nedá se mu vyhnout. Naše hra se odehrává ve světě po apokalypse, který je velmi nebezpečný, smrt je součástí života a lidský život nemá nutně takovou hodnotu, na jakou jsme zvyklí. Toto téma není v citlivých tématech explicitně zmíněno a počítej prosím s tím, že může být všude. Totéž platí pro toxické vztahy mezi postavami, násilí a krev. Je proto dobré se zamyslet, jestli ti tato témata nevadí, a jestli je naše hra tudíž pro tebe.",
]
const ALWAYS = ["smrt", "toxické vztahy", "násilí", "krev"]

/** Citlivá témata u všeho, co hráč nechal otevřené (★ nebo Klidně) a u postav vybraných v týmu. */
export function Sensitive({ draft: d, update, goTo }: StepProps & { goTo: (s: StepId) => void }) {
  const { catalog, prefs, genderPref, readOnly } = usePr()
  const STEP_OF: Partial<Record<PrefKind, StepId>> = { adult: "dospeli", character: "postavy", unit: "prvky", circle: "prvky" }
  const picked = new Set(d.paths.team ? Object.values(d.team.picks) : [])
  const groups = (["adult", "character", "unit", "circle"] as const)
    .filter(k => shownKinds(d).includes(k) || (k === "character" && picked.size > 0))
    .map(k => {
      const open = visibleEntries(catalog, k, genderPref).filter(e =>
        (shownKinds(d).includes(k) && prefOf(prefs, k, e.id) !== "no") || (k === "character" && picked.has(e.id)))
      return { kind: k, open, withTopics: open.filter(e => e.sensitive), without: open.filter(e => !e.sensitive) }
    })
    .filter(g => g.open.length > 0)
  const topics = [...new Set(groups.flatMap(g => g.withTopics.flatMap(e => e.sensitive!.split(",").map(t => t.trim()).filter(t => t && !t.startsWith("u ")))))]
  // „šikana, u někoho pasivně, u někoho aktivně“: upřesnění za čárkou do přehledu nepatří
  const edit = (s: StepId) => <a href={`#${s}`} onClick={e => { e.preventDefault(); goTo(s) }}>Upravit</a>
  return <>
    <Head kicker="Než odešleš" title="Citlivá témata" />
    {SENSITIVE_INTRO.map((p, i) => <p key={i} className="pr-lead">{p}</p>)}
    <div className="pr-section"><h2>Co tě podle tvých voleb čeká</h2></div>
    <p className="pr-hint" style={{ marginTop: -4 }}>Počítá se všechno, co máš na „★ Chci moc“ nebo „Klidně“{picked.size > 0 && ", a postavy, které jste si vybrali v týmu"}. Když ti něco nesedí, vrať se a dej tomu „✕ Nechci“.</p>
    <dl className="pr-sum pr-sens-sum">
      <div><dt>Vždy na hře</dt><dd>{ALWAYS.join(", ")}</dd><span /></div>
      <div><dt>Navíc u tvých voleb</dt><dd>{topics.length ? <b>{topics.join(", ")}</b> : "nic dalšího"}</dd><span /></div>
    </dl>
    {groups.map(g => (
      <section key={g.kind}>
        <div className="pr-section"><h2>{KIND_LABELS[g.kind]}</h2>{STEP_OF[g.kind] && edit(STEP_OF[g.kind]!)}</div>
        {g.withTopics.length > 0 && (
          <dl className="pr-sum pr-sens-sum">
            {g.withTopics.map(e => (
              <div key={e.id}>
                <dt>{prefOf(prefs, g.kind, e.id) === "yes" && <span className="pr-sum-yes">★ </span>}{e.name}</dt>
                <dd>{e.sensitive}</dd><span />
              </div>
            ))}
          </dl>
        )}
        {g.without.length > 0 && <p className="pr-hint">Bez citlivých témat: {g.without.map(e => e.name).join(", ")}</p>}
      </section>
    ))}
    <div className="pr-checks" style={{ marginTop: 28 }}>
      <Check checked={d.sensitiveOk} disabled={readOnly} onChange={v => update(x => ({ ...x, sensitiveOk: v }))}>
        Přečetl(a) jsem si citlivá témata svých voleb i témata, která jsou na hře vždy, a jsem s nimi v pořádku.
      </Check>
    </div>
  </>
}

export function Summary({ draft: d, update, goTo }: StepProps & { goTo: (s: StepId) => void }) {
  const { catalog, prefs, readOnly, genderPref } = usePr()
  const entries = (kind: PrefKind) => visibleEntries(catalog, kind, genderPref)
  const names = (kind: PrefKind, v: Pref) => entries(kind).filter(e => prefOf(prefs, kind, e.id) === v).map(e => e.name)
  const STEP_OF: Record<PrefKind, StepId> = { adult: "dospeli", character: "postavy", unit: "prvky", circle: "prvky", specialization: "prvky", origin: "prvky" }
  const edit = (s: StepId) => <a href={`#${s}`} onClick={e => { e.preventDefault(); goTo(s) }}>Upravit</a>
  const kinds = shownKinds(d)
  const shownChars = new Set(entries("character").map(c => c.id))
  const wanted = findConflicts(prefs, catalog.limits).filter(c => c.wanted && shownChars.has(c.characterId))
  const run = RUN_CHOICES.find(o => o.value === d.run)?.label ?? "—"
  return <>
    <Head kicker="Souhrn" title="Zkontroluj a odešli" />
    <dl className="pr-sum">
      <div><dt>Ty</dt><dd>{d.firstName} {d.lastName}{d.nickname && ` („${d.nickname}“)`} · {d.email} · {d.phone}</dd>{edit("udaje")}</div>
      <div><dt>Běh</dt><dd>{run}</dd>{edit("udaje")}</div>
      <div><dt>Hraju</dt><dd>{GENDER_CHOICES.find(o => o.value === d.genderPref)?.label ?? "—"}</dd>{edit("cesta")}</div>
      {d.paths.team && (
        <div><dt>Tým</dt><dd>
          s: {d.team.mates || "—"}<br />
          {Object.entries(d.team.picks).map(([t, c]) => `${catalog.teams.find(x => x.id === t)?.name}: ${catalog.characters.find(x => x.id === c)?.name ?? "nevybráno"}`).join(" · ") || "žádný tým"}<br />
          {d.team.solo === null ? "" : d.team.solo ? "Když vylosují jen mě, pojedu i bez nich." : "Bez nich nejedu."}
        </dd>{edit("tym")}</div>
      )}
      {kinds.map(k => {
        const y = names(k, "yes"), n = names(k, "no")
        return (
          <div key={k}><dt>{KIND_LABELS[k]}</dt><dd>
            {y.length ? <span className="pr-sum-yes">★ {y.join(", ")}</span> : "bez silného přání"}
            {n.length > 0 && <><br /><span className="pr-sum-no">{n.join(", ")}</span></>}
          </dd>{edit(STEP_OF[k])}</div>
        )
      })}
    </dl>
    {kinds.length > 0 && <>
      <div className="pr-section"><h2>Kolik necháváš otevřené</h2><span className="pr-label">★ chci moc · ▬ klidně · zbytek vyřazeno</span></div>
      <div className="pr-meter">
        {kinds.map(k => {
          const c = openCount(prefs, k, entries(k).map(e => e.id))
          return (
            <div key={k} className="pr-meter-row">
              <span>{KIND_LABELS[k]}</span>
              <div className="pr-track" aria-hidden><i className="pr-track-yes" style={{ width: `${c.yes / c.total * 100}%` }} /><i className="pr-track-ok" style={{ width: `${(c.open - c.yes) / c.total * 100}%` }} /></div>
              <output>{c.open}/{c.total}</output>
            </div>
          )
        })}
      </div>
    </>}
    {wanted.length > 0 ? <Conflicts /> : <p className="pr-okline">Volby se nekříží.</p>}
    <div className="pr-fields">
      <Field id="pr-noteCasting" label="Je ještě něco, co bychom při výběru postavy měli vědět?" wide>
        <textarea id="pr-noteCasting" className="pr-input" value={d.noteCasting} maxLength={4000} disabled={readOnly}
          onChange={e => { const v = e.target.value; update(x => ({ ...x, noteCasting: v })) }} />
      </Field>
      <Field id="pr-noteOrg" label="Poznámky a vzkazy organizátorům" wide>
        <textarea id="pr-noteOrg" className="pr-input" value={d.noteOrg} maxLength={4000} disabled={readOnly}
          onChange={e => { const v = e.target.value; update(x => ({ ...x, noteOrg: v })) }} />
      </Field>
    </div>
  </>
}
