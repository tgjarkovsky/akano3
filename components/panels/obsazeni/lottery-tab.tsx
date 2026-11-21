"use client"

import React, { useCallback, useEffect, useMemo, useState } from "react"
import { IconDice5, IconCheck, IconRefresh, IconArrowLeft, IconArrowRight, IconArrowBackUp } from "@tabler/icons-react"
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { useGame } from "@/lib/game-context"
import { adminFetch, getOrganizer } from "@/lib/admin-client"
import { RUN_CHOICES } from "@/lib/prihlaska"
import type { CastCharacter } from "@/lib/cast"
import { TERMS, type LotteryTrio, type LotteryStep, type Term } from "@/lib/lottery"
import type { StoredLottery, LotteryPerson, LotteryRuns } from "@/lib/lottery-store"

// Záložka Los v Obsazení: společný los obou běhů po fázích (lib/lottery.ts).
// Každá fáze ukáže pravidlo a co z něj vyšlo v obou bězích; tlačítkem Další se
// jde na další. Los určí, kdo jede, na který běh a v jaké skupině, a společné
// pořadí náhradníků. Postavy navrhne až záložka Hráči.

type Busy = "draw" | "apply" | "revert" | null
type Run = { id: number; name: string }

export function useLottery() {
  const { addToast } = useGame()
  const [lottery, setLottery] = useState<StoredLottery | null>(null)
  const [busy, setBusy] = useState<Busy>(null)

  useEffect(() => {
    let cancelled = false
    adminFetch("/api/priprava/losovani")
      .then(r => r.ok ? r.json() : null)
      .then(l => { if (!cancelled) setLottery(l) })
      .catch(() => { /* bez sítě bez losu */ })
    return () => { cancelled = true }
  }, [])

  const post = useCallback(async (kind: Exclude<Busy, null>, body: Record<string, unknown>) => {
    setBusy(kind)
    try {
      const res = await adminFetch("/api/priprava/losovani", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...body, by: getOrganizer() }),
      })
      if (!res.ok) { addToast(await res.text() || "Losování se nepovedlo", "error"); return false }
      setLottery(await res.json())
      return true
    } catch {
      addToast("Chyba sítě, los se neuložil", "error")
      return false
    } finally {
      setBusy(null)
    }
  }, [addToast])

  const draw = (runs: LotteryRuns, adults: (CastCharacter & { name: string })[], students: (CastCharacter & { name: string })[]) =>
    post("draw", { draw: { runs, adults, students } })
  const apply = (id: number) => post("apply", { apply: id })
  const revert = (id: number) => post("revert", { revert: id })
  return { lottery, busy, draw, apply, revert }
}

/** Výchozí přiřazení termínů z přihlášky k během: podle čísla v názvu, vybraný běh na první termín. */
function guessRuns(runs: Run[], activeRunId: number | null): LotteryRuns {
  const second = runs.find(r => /2|druh/i.test(r.name))?.id ?? null
  const active = runs.find(r => r.id === activeRunId)
  const first = active && active.id !== second ? active.id : runs.find(r => /1|prvn/i.test(r.name) && r.id !== second)?.id ?? null
  return { first, second: second === first ? null : second }
}
const termDate = (t: Term) => RUN_CHOICES.find(x => x.value === t)?.label.split(", ")[1] ?? ""
const termTitle = (t: Term) => t === "first" ? "1. termín" : "2. termín"

const PHASES = [
  { title: "Osudí", short: "Osudí" },
  { title: "Nakamura", short: "Nakamura" },
  { title: "Dospělé role", short: "Dospělí" },
  { title: "Pořadí studentů", short: "Studenti" },
  { title: "Trojice", short: "Trojice" },
  { title: "Jednotlivci", short: "Jednotlivci" },
  { title: "Výsledek", short: "Výsledek" },
] as const
const LAST = PHASES.length - 1

const plural = (n: number, one: string, few: string, many: string) => n === 1 ? one : n >= 2 && n <= 4 ? few : many

export function LotteryTab({ lottery, busy, runs, defaultRunId, onDraw, onApply, onRevert, onGoCast }: {
  lottery: StoredLottery | null
  busy: Busy
  runs: Run[]
  /** běh vybraný v Obsazení: výchozí pro 1. termín */
  defaultRunId: number | null
  onDraw: (runs: LotteryRuns) => Promise<boolean>
  onApply: (id: number) => Promise<boolean>
  onRevert: (id: number) => Promise<boolean>
  /** přepne Obsazení na běh a záložku Hráči */
  onGoCast: (runId: number) => void
}) {
  const [map, setMap] = useState<LotteryRuns>(() => lottery?.runs ?? guessRuns(runs, defaultRunId))
  const [step, setStep] = useState(0)
  const [seen, setSeen] = useState(0)
  const [confirmRevert, setConfirmRevert] = useState(false)
  const lotId = lottery?.id ?? null
  const applied = !!lottery?.appliedAt
  // Nový los začíná od osudí; použitý se otevře na výsledku a jde volně procházet.
  useEffect(() => {
    setStep(applied ? LAST : 0)
    setSeen(applied ? LAST : 0)
  }, [lotId, applied])
  useEffect(() => { if (lottery) setMap(lottery.runs) }, [lottery])
  const go = (n: number) => { setStep(n); setSeen(s => Math.max(s, n)) }
  const runName = (id: number | null) => runs.find(r => r.id === id)?.name ?? (id == null ? "—" : `běh ${id}`)

  const draw = async () => { if (await onDraw(lottery?.runs ?? map)) go(0) }
  const mapOk = (map.first != null || map.second != null) && map.first !== map.second

  if (!lottery) {
    return (
      <section className="lot-phase">
        <h3>Společný los obou běhů</h3>
        <p className="lot-rule">
          Los se prochází po fázích, u každé je vidět pravidlo a co z něj vyšlo. Obsazuje oba běhy najednou: kdo chce
          konkrétní termín, potřebuje místo v něm, kdo „je mi to jedno“, jde tam, kde zbývá víc místa. Určí, kdo jede,
          kam a v jaké skupině (Nakamura, dospělá role, trojice jako tým, jednotlivec), a společné pořadí náhradníků.
          Na rod ani odmítnuté postavy nehledí; postavy podle preferencí navrhne po použití losu záložka Hráči.
        </p>
        <ol className="lot-rule" style={{ paddingLeft: 20 }}>
          <li><b>Nakamura</b>: los mezi zrakově postiženými, jeden na každý běh; bez nich se obsadí jako ostatní dospělé role.</li>
          <li><b>Dospělé role</b>: náhodné pořadí lidí s cestou dospělého, shora dokud jsou místa.</li>
          <li><b>Pořadí studentů</b>: náhodné pořadí ostatních, shora tolik vylosovaných, kolik je studentských postav v obou bězích.</li>
          <li><b>Trojice</b>: vylosované celé, pak dvojice doplněné o třetího; nejvýš 5 týmů na běh.</li>
          <li><b>Jednotlivci</b>: zbylá místa shora v pořadí; kdo jede jen s trojicí, která nevyšla, místo přenechá.</li>
          <li><b>Náhradníci</b>: zbytek ve společném pořadí losu; kdo náhradníkem být nechce, nejede.</li>
        </ol>
        <p className="lot-rule" style={{ marginBottom: 8, color: "var(--c-text)" }}>Který běh v aplikaci odpovídá termínu z přihlášky:</p>
        <div style={{ display: "grid", gap: 8, marginBottom: 14, maxWidth: 520 }}>
          {TERMS.map(t => (
            <label key={t} style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", fontSize: "0.88rem" }}>
              <span style={{ minWidth: 190 }}>{termTitle(t)} <span style={{ color: "var(--c-text-faint)" }}>{termDate(t)}</span></span>
              <select className="circle-select" style={{ width: "auto", minHeight: 32 }} value={map[t] ?? ""}
                onChange={e => setMap(m => ({ ...m, [t]: e.target.value ? Number(e.target.value) : null }))}>
                <option value="">nelosovat</option>
                {runs.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
            </label>
          ))}
        </div>
        {map.first != null && map.first === map.second && <p className="lot-warn">Každý termín musí mít jiný běh.</p>}
        <button className="tool-btn tool-btn-primary" disabled={!!busy || !mapOk} onClick={draw}>
          <IconDice5 size={15} /> {busy === "draw" ? "Losuji…" : "Losovat"}
        </button>
      </section>
    )
  }

  const terms = lottery.result.terms
  return (
    <section>
      <div className="cast-summary" style={{ marginBottom: 14 }}>
        <div style={{ fontSize: "0.85rem", color: "var(--c-text-muted)", lineHeight: 1.45 }}>
          <span style={{ color: "var(--c-text)", fontWeight: 700 }}>Los č. {lottery.result.seed}</span>
          {" · "}{new Date(lottery.createdAt).toLocaleString("cs-CZ")}
          {" · "}{terms.map(t => `${termTitle(t)} → ${runName(lottery.runs[t])}`).join(", ")}
          {" · "}{applied
            ? <span style={{ color: "var(--c-success)", fontWeight: 700 }}>použitý {new Date(lottery.appliedAt!).toLocaleString("cs-CZ")}</span>
            : "náhled, zatím se nic nezapsalo"}
        </div>
        {!applied && (
          <button className="tool-btn" disabled={!!busy} onClick={draw}>
            <IconRefresh size={15} /> {busy === "draw" ? "Losuji…" : "Losovat znovu"}
          </button>
        )}
      </div>

      <ol className="lot-steps" aria-label="Fáze losu">
        {PHASES.map((p, i) => (
          <li key={p.title}>
            <button className="lot-step" disabled={i > seen} aria-current={i === step ? "step" : undefined}
              data-state={i === step ? "current" : i <= seen ? "done" : undefined} onClick={() => go(i)}>
              <span className="lot-step-n">{i + 1}</span>{p.short}
            </button>
          </li>
        ))}
      </ol>

      <div className="lot-phase">
        <Phase step={step} lottery={lottery} runName={t => runName(lottery.runs[t])} />
        {step === LAST && (
          <div style={{ marginTop: 16, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            {applied ? (
              <>
                {terms.map(t => lottery.runs[t]).filter((id): id is number => id != null).map(id => (
                  <button key={id} className="tool-btn tool-btn-primary" onClick={() => onGoCast(id)}>Obsadit postavy: {runName(id)} <IconArrowRight size={15} /></button>
                ))}
                <button className="tool-btn" disabled={!!busy} onClick={() => setConfirmRevert(true)}><IconArrowBackUp size={15} /> Vrátit los</button>
              </>
            ) : (
              <>
                <button className="tool-btn tool-btn-primary" disabled={!!busy} onClick={() => onApply(lottery.id)}>
                  <IconCheck size={15} /> {busy === "apply" ? "Zapisuji…" : "Použít los"}
                </button>
                <span style={{ fontSize: "0.8rem", color: "var(--c-text-muted)" }}>
                  Zapíše stavy přihlášek. Postavy pak navrhne záložka Hráči.
                </span>
              </>
            )}
          </div>
        )}
        <div className="lot-nav">
          {step > 0 ? <button className="tool-btn" onClick={() => go(step - 1)}><IconArrowLeft size={15} /> {PHASES[step - 1].title}</button> : <span />}
          {step < LAST && (
            <button className="tool-btn tool-btn-primary" onClick={() => go(step + 1)}>
              Další: {PHASES[step + 1].title} <IconArrowRight size={15} />
            </button>
          )}
        </div>
      </div>

      <AlertDialog open={confirmRevert} onOpenChange={setConfirmRevert}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Vrátit los?</AlertDialogTitle>
            <AlertDialogDescription>
              Přijatí, náhradníci i ti, kdo nejedou, se vrátí mezi nové přihlášky a vylosovaným se smažou postavy
              v {terms.map(t => runName(lottery.runs[t])).join(" a ")}. Komu se od losu stav změnil ručně, toho se to netýká.
              Maily, které už odešly, se tím nevrátí.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Zrušit</AlertDialogCancel>
            <AlertDialogAction onClick={() => { setConfirmRevert(false); void onRevert(lottery.id) }}>Vrátit los</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  )
}

function Phase({ step, lottery, runName }: { step: number; lottery: StoredLottery; runName: (t: Term) => string }) {
  const r = lottery.result
  const terms = r.terms
  const two = terms.length === 2
  const people = lottery.people
  const person = (id: number): LotteryPerson | undefined => people[id]
  const name = (id: number) => person(id)?.name ?? `#${id}`
  const pos = useMemo(() => new Map(r.students.order.map((id, i) => [id, i + 1])), [r])
  // Trojice dostanou písmena v pořadí, jak se objeví v losu studentů.
  const letter = useMemo(() => {
    const m = new Map<number, string>()
    for (const id of [...r.students.order, ...Object.keys(people).map(Number)]) {
      const g = people[id]?.teamGroup
      if (g != null && people[id]?.paths.team && !m.has(g)) m.set(g, m.size < 26 ? String.fromCharCode(65 + m.size) : `${m.size + 1}`)
    }
    return m
  }, [r, people])
  const sel = useMemo(() => new Map(r.selected.map(s => [s.id, s])), [r])
  /** kam člověk chce: konkrétní běh, nebo oba */
  const wants = (id: number) => {
    const run = person(id)?.run
    return run === "first" || run === "second" ? runName(run) : "oba běhy"
  }
  const wantedFull = (id: number) => {
    const run = person(id)?.run
    return run === "first" || run === "second" ? `${runName(run)} je plný` : "oba běhy jsou plné"
  }

  const Name = ({ id, trio = true }: { id: number; trio?: boolean }) => {
    const p = person(id)
    const g = p?.teamGroup
    return (
      <>
        {name(id)}
        {two && <span className="lot-tag">{wants(id)}</span>}
        {p?.vision && <span className="lot-tag">zrak. postižení</span>}
        {trio && g != null && p?.paths.team && <span className="lot-tag lot-trio-tag">trojice {letter.get(g)}</span>}
      </>
    )
  }
  const Row = ({ n, id, state, out, trio }: { n: number | string; id: number; state?: "in" | "out" | "skip"; out: React.ReactNode; trio?: boolean }) => (
    <li className="lot-row" data-state={state}>
      <span className="lot-row-n">{n}.</span>
      <span className="lot-row-name"><Name id={id} trio={trio} /></span>
      <span className="lot-row-out">{out}</span>
    </li>
  )
  const Cut = ({ children }: { children: React.ReactNode }) => <li className="lot-cut" aria-hidden>{children}</li>
  /** „Běh 1 5/6 · Běh 2 6/6“ */
  const tally = (got: (t: Term) => number, of: (t: Term) => number) => terms.map(t => `${runName(t)} ${got(t)}/${of(t)}`).join(" · ")
  const inGroup = (g: string, t?: Term) => r.selected.filter(s => s.group === g && (!t || s.term === t)).length
  const ids = Object.keys(people).map(Number)
  const nakIn = (t: Term) => r.nakamura?.picked.filter(p => p.term === t).length ?? 0
  const adultCap = (t: Term) => r.slots.adults - nakIn(t)
  const teamsIn = (t: Term) => r.trios.filter(x => x.outcome === "team" && x.term === t).length
  const goes = (id: number) => { const s = sel.get(id); return s ? (two ? `jede · ${runName(s.term)}` : "jede") : "" }

  switch (step) {
    case 0: {
      const linked = new Set(ids.map(id => people[id].paths.team ? people[id].teamGroup : null).filter(g => g != null)).size
      const count = (f: (p: LotteryPerson) => boolean) => ids.filter(id => f(people[id])).length
      return (
        <>
          <h3>Osudí</h3>
          <p className="lot-rule">
            Losuje se z nových přihlášek na {terms.map(t => `${termTitle(t)} (${runName(t)})`).join(" a ")} a z těch,
            kterým je termín jedno. Kdo se hlásí na dospělou i studentskou roli, je v obou losech. Los nehledí na rod ani
            odmítnuté postavy.
          </p>
          {r.unpaired > 0 && (
            <p className="lot-warn">
              ⚠ {r.unpaired} {plural(r.unpaired, "přihláška s trojicí nemá", "přihlášky s trojicí nemají", "přihlášek s trojicí nemá")} spárovanou
              trojici (Přihlášky → Spárovat trojice) a {r.unpaired === 1 ? "losuje se" : "losují se"} jako jednotlivci.
            </p>
          )}
          <div className="lot-tiles">
            <Tile n={ids.length} label="lidí v osudí" strong />
            {terms.map(t => <Tile key={t} n={count(p => p.run === t)} label={`chce jen ${runName(t)}`} />)}
            {two && <Tile n={count(p => p.run === "any")} label="je mi to jedno" />}
            <Tile n={count(p => p.paths.adult)} label={`na dospělé role (${r.slots.adults} na běh)`} />
            <Tile n={count(p => p.paths.student || p.paths.team)} label={`na studentské role (${r.slots.students} na běh)`} />
            <Tile n={linked} label="spárovaných trojic" />
            <Tile n={count(p => p.vision)} label="zrakově postižených" />
          </div>
        </>
      )
    }
    case 1: {
      const n = r.nakamura
      return (
        <>
          <h3>Nakamura</h3>
          <p className="lot-rule">
            Na Nakamuru má v každém běhu přednost člověk se zrakovým postižením, který se hlásí na dospělou roli a Nakamuru
            neodmítl. Je-li jich víc, rozhodne pořadí losu. Kde se nikdo takový nenajde, Nakamura se obsadí v další fázi jako
            ostatní dospělé role.
          </p>
          {!n ? <p className="lot-rule">Běhy Nakamuru nemají.</p>
            : n.candidates.length === 0 ? <p className="lot-warn">Nikdo se zrakovým postižením se nehlásí, Nakamura jde mezi ostatní dospělé role.</p>
            : (
              <>
                <p className="lot-rule" style={{ marginBottom: 8 }}>{tally(nakIn, () => 1)}</p>
                <ol className="lot-list">
                  {n.candidates.map((id, i) => {
                    const p = n.picked.find(x => x.id === id)
                    return <Row key={id} n={i + 1} id={id} trio={false} state={p ? "in" : "out"}
                      out={p ? `Nakamura${two ? ` · ${runName(p.term)}` : ""}` : `${wantedFull(id).replace("plný", "už má Nakamuru").replace("plné", "už mají Nakamuru")} → los dospělých`} />
                  })}
                </ol>
              </>
            )}
        </>
      )
    }
    case 2: {
      const stepOf = new Map(r.adults.steps.map(s => [s.id, s]))
      const last = r.adults.order.findLastIndex(id => stepOf.has(id))
      const after = (id: number) => {
        const p = person(id)
        if (p?.paths.student || p?.paths.team) return "jde do losu studentů"
        return p?.substitute === "no" ? "nejede (náhradník být nechce)" : "náhradník"
      }
      return (
        <>
          <h3>Dospělé role · {tally(t => inGroup("adult", t), adultCap)}</h3>
          <p className="lot-rule">
            Lidé s cestou dospělého v náhodném pořadí. Shora jede každý, pro koho je v běhu, který chce, místo
            ({r.slots.adults} {plural(r.slots.adults, "dospělá postava", "dospělé postavy", "dospělých postav")} na běh, bez obsazeného Nakamury).
            Kdo se nevešel a hlásí se i na studenta, jde do losu studentů.
          </p>
          <ol className="lot-list">
            {r.adults.order.map((id, i) => {
              const s = stepOf.get(id)
              return (
                <React.Fragment key={id}>
                  <Row n={i + 1} id={id} trio={false} state={s?.outcome === "taken" ? "in" : s ? "skip" : "out"}
                    out={s?.outcome === "taken" ? goes(id) : s ? `${wantedFull(id)} → ${after(id)}` : after(id)} />
                  {i === last && i < r.adults.order.length - 1 && <Cut>místa plná</Cut>}
                </React.Fragment>
              )
            })}
          </ol>
          {r.adults.order.length === 0 && <p className="lot-rule">Na dospělou roli se nikdo nehlásí.</p>}
        </>
      )
    }
    case 3: {
      const drawn = new Set(r.students.drawn), full = new Set(r.students.full)
      const last = r.students.order.findLastIndex(id => drawn.has(id) || full.has(id))
      const slots = r.slots.students * terms.length
      return (
        <>
          <h3>Pořadí studentů · vylosováno {drawn.size} z {slots}</h3>
          <p className="lot-rule">
            Všichni ostatní se studentskou nebo týmovou cestou v náhodném pořadí. Shora se losuje {slots} lidí
            ({r.slots.students} studentských postav na běh); kdo chce běh, který už má dost vylosovaných, se přeskočí.
            Pořadí platí i dál: z něj se doplňují místa a podle něj jdou náhradníci.
          </p>
          <ol className="lot-list">
            {r.students.order.map((id, i) => (
              <React.Fragment key={id}>
                <Row n={i + 1} id={id} state={drawn.has(id) ? "in" : full.has(id) ? "skip" : "out"}
                  out={drawn.has(id) ? "vylosován(a)" : full.has(id) ? `${wantedFull(id).replace("plný", "má dost vylosovaných").replace("plné", "mají dost vylosovaných")}` : "v pořadí"} />
                {i === last && i < r.students.order.length - 1 && <Cut>vylosováno {drawn.size}</Cut>}
              </React.Fragment>
            ))}
          </ol>
        </>
      )
    }
    case 4:
      return (
        <>
          <h3>Trojice · {tally(teamsIn, () => r.slots.maxTeams)}</h3>
          <p className="lot-rule">
            Shora v pořadí losu nejdřív trojice vylosované celé, pak vylosované dvojice, kterým se doplní třetí, i když
            vylosovaný nebyl. Nejvýš {r.slots.maxTeams} týmů na běh; trojice s „je mi to jedno“ jde do běhu, kde je
            týmů méně. Který tým trojice dostane, se rozhodne až při obsazení podle jejich výběru.
          </p>
          {r.trios.length === 0
            ? <p className="lot-rule">Mezi vylosovanými není nikdo ze spárované trojice.</p>
            : <div className="lot-trios">{r.trios.map((t, i) => (
              <TrioCard key={i} t={t} maxTeams={r.slots.maxTeams} name={name} pos={pos} sel={sel}
                letter={letter.get(person(t.members[0])?.teamGroup ?? -1) ?? "?"} runName={two ? runName : null} />
            ))}</div>}
        </>
      )
    case 5: {
      const k: Record<Term, number> = { first: 0, second: 0 }
      return (
        <>
          <h3>Jednotlivci · {tally(t => inGroup("student", t), t => r.singles.free[t])}</h3>
          <p className="lot-rule">
            Zbylá studentská místa: {terms.map(t => `${runName(t)} ${r.singles.free[t]} (${r.slots.students} − 3 × ${teamsIn(t)} ${plural(teamsIn(t), "tým", "týmy", "týmů")})`).join(", ")}.
            Berou se shora v pořadí losu ti, kdo ještě nejedou. Kdo jede jen s trojicí a jeho trojice nejede, místo přenechá
            dalšímu. Kdo je až za hranicí vylosovaných, je doplněný z pořadí.
          </p>
          {terms.some(t => inGroup("student", t) < r.singles.free[t]) && (
            <p className="lot-warn">⚠ Neobsazená místa zůstávají, v osudí už nikdo, kdo by na ně mohl, není.</p>
          )}
          <ol className="lot-list">
            {r.singles.steps.map(s => {
              const p = pos.get(s.id) ?? 0
              if (s.outcome === "taken" && s.term) k[s.term]++
              const late = !r.students.drawn.includes(s.id)
              return <Row key={s.id} n={p} id={s.id} state={s.outcome === "taken" ? "in" : "skip"}
                out={s.outcome === "taken" && s.term
                  ? `${two ? `${runName(s.term)} · ` : ""}místo ${k[s.term]}/${r.singles.free[s.term]}${late ? " · doplněn(a) z pořadí" : ""}`
                  : skipText(s, wantedFull(s.id))} />
            })}
          </ol>
        </>
      )
    }
    default: {
      return (
        <>
          <h3>Výsledek</h3>
          <p className="lot-rule">
            {lottery.appliedAt ? "Los je zapsaný: vylosovaní jsou přijatí na svůj běh, ostatní náhradníci ve společném pořadí losu."
              : "Po použití budou vylosovaní přijatí na svůj běh a ostatní náhradníci ve společném pořadí losu."}
            {two && " Náhradník s „je mi to jedno“ je náhradníkem pro oba běhy."} Postavy navrhne záložka Hráči podle skupin z losu a preferencí.
          </p>
          <div className="lot-result">
            <table>
              <thead><tr><th />{terms.map(t => <th key={t}>{runName(t)}</th>)}</tr></thead>
              <tbody>
                <tr><th>Nakamura</th>{terms.map(t => <td key={t}>{inGroup("nakamura", t)}</td>)}</tr>
                <tr><th>Dospělé role</th>{terms.map(t => <td key={t}>{inGroup("adult", t)}</td>)}</tr>
                <tr><th>V trojicích</th>{terms.map(t => <td key={t}>{inGroup("team", t)} <span>({teamsIn(t)} {plural(teamsIn(t), "tým", "týmy", "týmů")})</span></td>)}</tr>
                <tr><th>Jednotlivě</th>{terms.map(t => <td key={t}>{inGroup("student", t)}</td>)}</tr>
                <tr className="lot-result-total"><th>Jede celkem</th>{terms.map(t => <td key={t}>{r.selected.filter(s => s.term === t).length} <span>z {r.slots.adults + r.slots.students}</span></td>)}</tr>
              </tbody>
            </table>
          </div>
          {r.substitutes.length > 0 && (
            <>
              <p style={{ margin: "16px 0 6px", fontWeight: 700, fontSize: "0.88rem" }}>Náhradníci ve společném pořadí ({r.substitutes.length})</p>
              <ol className="lot-list" style={{ marginBottom: 12 }}>
                {r.substitutes.map((id, i) => <Row key={id} n={i + 1} id={id} out={two ? `náhradník · ${wants(id)}` : "náhradník"} />)}
              </ol>
            </>
          )}
          {r.declined.length > 0 && <p className="lot-rule"><b>Nejedou</b> (náhradníky být nechtějí): {r.declined.map(name).join(", ")}</p>}
        </>
      )
    }
  }
}

function skipText(s: LotteryStep, full: string): string {
  switch (s.why) {
    case "full": return `${full} → místo jde dál`
    case "limit": return "trojice nad limit, jede jen s ní → přenechává místo"
    case "unpaired": return "nespárovaný, jede jen s trojicí → přenechává místo"
    case "incomplete": return "trojice nejede celá, jede jen s ní → přenechává místo"
    default: return "jede jen s trojicí, ta nevyšla → přenechává místo"
  }
}

function TrioCard({ t, maxTeams, name, letter, pos, sel, runName }: {
  t: LotteryTrio
  maxTeams: number
  name: (id: number) => string
  letter: string
  pos: Map<number, number>
  sel: Map<number, { group: string }>
  /** jen když se losuje na oba běhy */
  runName: ((t: Term) => string) | null
}) {
  const where = t.term && runName ? ` v ${runName(t.term)}` : ""
  const out = t.outcome === "team"
    ? (t.added != null ? `Vylosovaní dva + doplněný třetí → jede jako tým ${t.team}${where}` : `Vylosovaná celá → jede jako tým ${t.team}${where}`)
    : t.outcome === "limit" ? `Nad limit ${maxTeams} týmů na běh → jednotlivě`
    : t.outcome === "single" ? "Vylosovaný jen jeden → jednotlivě podle své volby"
    : t.outcome === "split" ? "Členové chtějí různé běhy → jednotlivě"
    : t.members.length < 3 ? `V osudí ${t.members.length === 1 ? "je jen 1" : `jsou jen ${t.members.length}`} z trojice (ostatní chtějí jiný běh, nebo je spárovaná jen dvojice) → jednotlivě`
    : "Člen trojice jede na dospělou roli → ostatní jednotlivě"
  return (
    <div className="lot-trio" data-state={t.outcome === "team" ? "in" : undefined}>
      <div className="lot-trio-head"><span>Trojice {letter}</span>{t.team != null && <span>Tým {t.team}{t.term && runName ? ` · ${runName(t.term)}` : ""}</span>}</div>
      <ul>
        {t.members.map(id => {
          const g = sel.get(id)?.group
          const [mark, text] = t.drawn.includes(id) ? ["✓", `vylosován(a), č. ${pos.get(id)}`]
            : id === t.added ? ["+", `doplněn(a), v pořadí č. ${pos.get(id)}`]
            : g === "adult" || g === "nakamura" ? ["·", "jede na dospělou roli"]
            : ["·", pos.has(id) ? `nevylosován(a), č. ${pos.get(id)}` : "není v losu studentů"]
          return (
            <li key={id}>
              <span className="lot-mark" aria-hidden>{mark}</span>
              <span>{name(id)} <span style={{ color: "var(--c-text-faint)", fontSize: "0.76rem" }}>{text}</span></span>
            </li>
          )
        })}
      </ul>
      <div className="lot-trio-out">{out}</div>
    </div>
  )
}

function Tile({ n, label, strong }: { n: number; label: string; strong?: boolean }) {
  return (
    <div className="lot-tile" style={strong ? { borderColor: "var(--c-success)" } : undefined}>
      <b>{n}</b><span>{label}</span>
    </div>
  )
}
