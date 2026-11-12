"use client"

import React, { useCallback, useEffect, useMemo, useState } from "react"
import { openCount, KIND_LABELS, type Catalog, type Pref, type PrefKind } from "@/lib/prihlaska"
import { activeSteps, draftOf, emptyDraft, isStepId, restoreDraft, stepError, visibleEntries, visiblePrefs, type Draft, type StepId } from "./draft"
import { PrContext, type PrCtx } from "./parts"
import { Reader, type ReaderState } from "./reader"
import { Head, Intro, Person, Paths, Adults, Team, Characters, Elements, Summary } from "./steps"
import type { Prihlaska } from "@/lib/prihlaska"

// Přihláška na hru. Nová se rozpracovává v localStorage a po odeslání dostane
// hráč tajný odkaz; přes něj se vrátí k úpravám (stejný formulář s token).
// Krok drží adresa za #, takže funguje tlačítko Zpět.

const DRAFT_KEY = "akano-prihlaska"
const LOW: Partial<Record<PrefKind, number>> = { adult: 2, character: 8, unit: 2, circle: 2, specialization: 2, origin: 2 }
const TALLY: Partial<Record<StepId, PrefKind[]>> = { dospeli: ["adult"], postavy: ["character"], prvky: ["unit", "circle", "specialization", "origin"] }

export function PrihlaskaForm({ catalog, initial, token, editable = true }: {
  catalog: Catalog
  initial?: Prihlaska
  /** odkaz na úpravy; bez něj jde o novou přihlášku */
  token?: string
  editable?: boolean
}) {
  const [draft, setDraft] = useState<Draft>(() => (initial ? draftOf(initial) : emptyDraft()))
  const [wanted, setStep] = useState<StepId>("uvod")
  const [reader, setReader] = useState<ReaderState | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState<string | null>(null)
  const [saved, setSaved] = useState<string>("")
  const readOnly = !editable

  // Rozpracovaná nová přihláška z minula.
  useEffect(() => {
    if (token) return
    let restored: Draft | null = null
    try { restored = restoreDraft(localStorage.getItem(DRAFT_KEY)) } catch { /* bez úložiště */ }
    if (restored) { setDraft(restored); setSaved("Obnoveno z tohoto prohlížeče") }
  }, [token])

  const [touched, setTouched] = useState(false)
  const update = useCallback((fn: (d: Draft) => Draft) => {
    setDraft(fn)
    setTouched(true)
    setError(null)
  }, [])

  // Koncept nové přihlášky se průběžně ukládá do prohlížeče.
  useEffect(() => {
    if (token || !touched) return
    try { localStorage.setItem(DRAFT_KEY, JSON.stringify(draft)); setSaved("Uloženo v tomto prohlížeči") } catch { /* soukromé okno */ }
  }, [draft, token, touched])

  const steps = activeSteps(draft)
  // Krok skrytý podle zvolených cest (třeba #tym bez týmu) ukáže volbu cest.
  const step = steps.some(s => s.id === wanted) ? wanted : "cesta"
  const index = steps.findIndex(s => s.id === step)

  // Krok podle adresy (#udaje …); neplatný nebo skrytý krok spadne na úvod.
  useEffect(() => {
    const sync = () => {
      const h = decodeURIComponent(window.location.hash.slice(1))
      setStep(isStepId(h) ? h : "uvod")
      setReader(null)
      window.scrollTo(0, 0)
    }
    sync()
    window.addEventListener("hashchange", sync)
    return () => window.removeEventListener("hashchange", sync)
  }, [])

  // Na úzkém displeji lišta kroků ujede; aktuální krok drž na očích.
  useEffect(() => {
    document.querySelector(".pr-step[aria-current]")?.scrollIntoView({ inline: "center", block: "nearest" })
  }, [step])

  const goTo = useCallback((s: StepId) => {
    if (window.location.hash === `#${s}`) return
    window.location.hash = s
  }, [])

  const next = () => {
    const err = stepError(step, draft)
    if (err) { setError(err); return }
    if (step === "souhrn") { submit(); return }
    goTo(steps[index + 1].id)
  }

  async function submit() {
    for (const s of steps) {
      const err = stepError(s.id, draft)
      if (err) { setError(`${s.label}: ${err}`); return }
    }
    setSending(true)
    try {
      const res = await fetch(token ? `/api/prihlaska/${token}` : "/api/prihlaska", {
        method: token ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...draft, prefs: visiblePrefs(catalog, draft) }),
      })
      if (!res.ok) {
        setError(res.status >= 500 ? "Přihlášku se nepodařilo uložit. Zkus to za chvíli znovu, nic se neztratilo." : await res.text() || "Přihlášku se nepodařilo odeslat.")
        return
      }
      if (token) { setSent(token); return }
      const { token: t } = await res.json() as { token: string }
      try { localStorage.removeItem(DRAFT_KEY) } catch { /* nic */ }
      setSent(t)
    } catch {
      setError("Chyba sítě. Zkus to znovu, nic se neztratilo.")
    } finally {
      setSending(false)
    }
  }

  const setPref = useCallback((kind: PrefKind, id: string, v: Pref) => {
    update(d => {
      const forKind = { ...d.prefs[kind] }
      if (v === "ok") delete forKind[id]; else forKind[id] = v
      return { ...d, prefs: { ...d.prefs, [kind]: forKind } }
    })
  }, [update])

  const openReader = useCallback((kind: PrefKind, id: string, list?: string[]) => {
    setReader(r => ({ kind, id, list: list ?? (r?.kind === kind ? r.list : visibleEntries(catalog, kind, draft.genderPref).map(e => e.id)) }))
  }, [catalog, draft.genderPref])

  const ctx = useMemo<PrCtx>(() => ({ catalog, prefs: draft.prefs, genderPref: draft.genderPref, setPref, openReader, readOnly }), [catalog, draft.prefs, draft.genderPref, setPref, openReader, readOnly])

  if (sent) return <Done token={sent} edited={!!token} name={draft.nickname || draft.firstName} />

  const tally = (TALLY[step] ?? []).map(k => {
    const c = openCount(draft.prefs, k, visibleEntries(catalog, k, draft.genderPref).map(e => e.id))
    return (
      <span key={k} className={c.open < (LOW[k] ?? 0) ? "pr-tally-low" : undefined}>
        {KIND_LABELS[k].toLowerCase()}: <b>{c.open}/{c.total}</b> otevřeno{c.yes ? ` · ★${c.yes}` : ""}
      </span>
    )
  })

  return (
    <PrContext.Provider value={ctx}>
      <div className="pr">
        <header className="pr-top">
          <div className="pr-top-in">
            <div className="pr-top-row">
              <span className="pr-brand"><b>Akano 3</b> · {token ? "Úprava přihlášky" : "Přihláška na hru 2027"}</span>
              <span className="pr-saved" aria-live="polite">{readOnly ? "Přihlašování skončilo, jen pro čtení" : saved}</span>
            </div>
            <nav className="pr-steps" aria-label="Kroky přihlášky">
              {steps.map((s, i) => (
                <button key={s.id} type="button" className={`pr-step${i < index ? " pr-step-done" : ""}`}
                  aria-current={s.id === step ? "step" : undefined} onClick={() => goTo(s.id)}>
                  <span className="pr-step-n">{i < index ? "✓" : i + 1}</span>{s.label}
                </button>
              ))}
            </nav>
          </div>
        </header>

        <div className={`pr-desk${reader ? " pr-desk-reading" : ""}`}>
          <main className="pr-sheet">
            {step === "uvod" && <Intro />}
            {step === "udaje" && <Person draft={draft} update={update} />}
            {step === "cesta" && <Paths draft={draft} update={update} />}
            {step === "dospeli" && <Adults draft={draft} update={update} />}
            {step === "tym" && <Team draft={draft} update={update} />}
            {step === "postavy" && <Characters />}
            {step === "prvky" && <Elements />}
            {step === "souhrn" && <Summary draft={draft} update={update} goTo={goTo} />}
            {error && <div className="pr-warns" role="alert"><div className="pr-warn"><span className="pr-warn-tag">Chybí</span><span>{error}</span></div></div>}
          </main>
          {reader && <>
            <div className="pr-scrim" onClick={() => setReader(null)} />
            <Reader state={reader} onClose={() => setReader(null)}
              onMove={(id, kind, list) => setReader(r => r && ({ kind: kind ?? r.kind, id, list: list ?? r.list }))} />
          </>}
        </div>

        <footer className="pr-bar">
          <div className="pr-bar-in">
            <div className="pr-tally">{step === "uvod" ? "Vyplnění zabere zhruba 20 minut." : tally}</div>
            <div className="pr-btns">
              <button type="button" className="pr-btn" disabled={index <= 0} onClick={() => goTo(steps[index - 1].id)}>Zpět</button>
              {step === "souhrn"
                ? <button type="button" className="pr-btn pr-btn-accent" disabled={sending || readOnly} onClick={next}>
                    {sending ? "Odesílám…" : token ? "Uložit změny" : "Odeslat přihlášku"}
                  </button>
                : <button type="button" className="pr-btn pr-btn-primary" onClick={next}>{index === 0 ? "Začít" : "Pokračovat"}</button>}
            </div>
          </div>
        </footer>
      </div>
    </PrContext.Provider>
  )
}

function Done({ token, edited, name }: { token: string; edited: boolean; name: string }) {
  const [copied, setCopied] = useState(false)
  const link = `${window.location.origin}/prihlaska/${token}`
  const copy = () => navigator.clipboard?.writeText(link).then(() => setCopied(true), () => setCopied(false))
  return (
    <div className="pr">
      <div className="pr-desk">
        <main className="pr-sheet" style={{ maxWidth: 720 }}>
          <Head kicker={edited ? "Uloženo" : "Odesláno"} title={edited ? "Změny jsou uložené" : "Přihláška je u nás"}
            lead={edited ? "Díky, přihlášku jsme aktualizovali." : `Díky${name ? `, ${name}` : ""}. Přihláška platí.`} />
          <p className="pr-label" style={{ marginTop: 22 }}>Tvůj odkaz pro úpravy</p>
          <div className="pr-linkbox">
            <code>{link}</code>
            <button type="button" className="pr-btn" onClick={copy}>{copied ? "Zkopírováno" : "Kopírovat"}</button>
          </div>
          <p className="pr-hint">Odkaz si ulož a nikomu ho neposílej, kdo ho má, může přihlášku měnit. Když ho ztratíš, napiš nám.</p>
          <p style={{ marginTop: 22 }}><a className="pr-btn" href={`/prihlaska/${token}`}>Otevřít přihlášku</a></p>
        </main>
      </div>
    </div>
  )
}
