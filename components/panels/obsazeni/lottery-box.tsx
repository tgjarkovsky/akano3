"use client"

import React, { useCallback, useEffect, useState } from "react"
import { IconDice5, IconCheck, IconRefresh, IconX } from "@tabler/icons-react"
import { useGame } from "@/lib/game-context"
import { adminFetch, getOrganizer } from "@/lib/admin-client"
import { RUN_CHOICES, type RunChoice } from "@/lib/prihlaska"
import type { CastCharacter } from "@/lib/cast"
import type { LotteryVia } from "@/lib/lottery"
import type { StoredLottery } from "@/lib/lottery-store"

// Losování obsazení běhu z nových přihlášek (lib/lottery.ts): náhled losu,
// použití na prázdný běh, protokol. Postavy z náhledu ukazuje tabulka Hráčů.

export const VIA_LABEL: Record<LotteryVia, string> = {
  nakamura: "zrakově postižený", adult: "dospělá role", team: "trojice", student: "jednotlivě",
}

export function useLottery() {
  const { addToast, activeRunId } = useGame()
  const [lottery, setLottery] = useState<StoredLottery | null>(null)
  const [busy, setBusy] = useState<"draw" | "apply" | null>(null)

  useEffect(() => {
    let cancelled = false
    adminFetch("/api/priprava/losovani")
      .then(r => r.ok ? r.json() : null)
      .then(l => { if (!cancelled) setLottery(l) })
      .catch(() => { /* bez sítě bez losu */ })
    return () => { cancelled = true }
  }, [activeRunId])

  const post = useCallback(async (kind: "draw" | "apply", body: Record<string, unknown>) => {
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
      addToast("Chyba sítě, losování se neuložilo", "error")
      return false
    } finally {
      setBusy(null)
    }
  }, [addToast])

  const draw = (choice: RunChoice, adults: (CastCharacter & { name: string })[], students: (CastCharacter & { name: string })[]) =>
    post("draw", { draw: { choice, adults, students } })
  const apply = (id: number) => post("apply", { apply: id })
  return { lottery, busy, draw, apply }
}

/** Z kterého běhu v přihláškách se pro tenhle běh losuje: podle čísla v názvu, jinak první. */
const guessChoice = (runName: string): RunChoice => /2|druh/i.test(runName) ? "second" : "first"

export function LotteryBox({ lottery, busy, runName, castCount, onDraw, onApply }: {
  lottery: StoredLottery | null
  busy: "draw" | "apply" | null
  runName: string
  /** kolik postav už má hráče (los jde použít jen na prázdný běh) */
  castCount: number
  onDraw: (choice: RunChoice) => void
  onApply: (id: number) => Promise<boolean>
}) {
  const [choice, setChoice] = useState<RunChoice>(lottery?.choice ?? guessChoice(runName))
  const [hidden, setHidden] = useState<number | null>(null)
  const preview = lottery && !lottery.appliedAt && hidden !== lottery.id ? lottery : null
  const name = (id: number) => lottery?.people[id]?.name ?? `#${id}`

  // Použitý los: jen odkaz na protokol.
  if (lottery?.appliedAt && castCount > 0) {
    return (
      <details className="lottery-done">
        <summary>Obsazeno losem {new Date(lottery.appliedAt).toLocaleString("cs-CZ")} · los č. {lottery.result.seed} · protokol</summary>
        <Protocol lottery={lottery} name={name} />
      </details>
    )
  }
  if (castCount > 0 && !preview) return null

  const r = preview?.result
  const teams = r ? r.cast.filter(c => c.via === "team").length / 3 : 0
  const warns = r?.log.filter(l => l.level === "warn") ?? []

  return (
    <div className="cast-proposal lottery-box" role="region" aria-label="Losování obsazení">
      <div style={{ minWidth: 0, flex: "1 1 320px", fontSize: "0.85rem", lineHeight: 1.5 }}>
        {!preview ? (
          <>
            <span style={{ fontWeight: 700, color: "var(--c-text)" }}>Losování obsazení</span>
            <span style={{ display: "block", color: "var(--c-text-muted)" }}>
              Osudí: nové přihlášky, které chtějí{" "}
              <select className="circle-select" style={{ width: "auto", minHeight: 28 }} value={choice} onChange={e => setChoice(e.target.value as RunChoice)} aria-label="Běh v přihláškách">
                {RUN_CHOICES.filter(c => c.value !== "any").map(c => <option key={c.value} value={c.value}>{c.label.split(",")[0].toLowerCase()}</option>)}
              </select>{" "}
              nebo je jim to jedno. Nejdřív Nakamura a dospělé role, pak trojice (nejvýš 5) a zbylé studentské postavy podle preferencí; zbytek jsou náhradníci v pořadí losu.
            </span>
            {castCount > 0 && <span style={{ display: "block", color: "var(--c-accent)" }}>Běh už má obsazení, los půjde použít až na prázdný běh.</span>}
          </>
        ) : r && (
          <>
            <span style={{ fontWeight: 700, color: "var(--c-text)" }}>Los č. {r.seed}: obsadí {r.cast.length} postav</span>
            <span style={{ color: "var(--c-text-muted)" }}>
              {" · "}{teams} {teams >= 1 && teams <= 4 ? "trojice" : "trojic"} · náhradníků {r.substitutes.length}{r.declined.length > 0 && ` · nejede ${r.declined.length}`}
            </span>
            <span style={{ display: "block", fontSize: "0.78rem", color: "var(--c-text-faint)" }}>
              Vylosované postavy jsou v tabulce označené LOS. Náhled nic nemění, dokud los nepoužiješ.
            </span>
            {warns.map((w, i) => <span key={i} style={{ display: "block", color: "var(--c-accent)" }}>⚠ {w.text}</span>)}
            <details style={{ marginTop: 6 }}>
              <summary style={{ cursor: "pointer" }}>Náhradníci v pořadí ({r.substitutes.length}) a protokol</summary>
              <Protocol lottery={preview} name={name} />
            </details>
          </>
        )}
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {preview && (
          <button className="tool-btn tool-btn-primary" disabled={!!busy || castCount > 0} onClick={() => onApply(preview.id)}>
            <IconCheck size={15} /> {busy === "apply" ? "Zapisuji…" : "Použít los"}
          </button>
        )}
        <button className={preview ? "tool-btn" : "tool-btn tool-btn-primary"} disabled={!!busy} onClick={() => { setHidden(null); onDraw(preview?.choice ?? choice) }}>
          {preview ? <IconRefresh size={15} /> : <IconDice5 size={15} />} {busy === "draw" ? "Losuji…" : preview ? "Losovat znovu" : "Losovat"}
        </button>
        {preview && <button className="tool-btn" disabled={!!busy} onClick={() => setHidden(preview.id)}><IconX size={15} /> Zavřít</button>}
      </div>
    </div>
  )
}

function Protocol({ lottery, name }: { lottery: StoredLottery; name: (id: number) => string }) {
  const r = lottery.result
  return (
    <div style={{ fontSize: "0.82rem", lineHeight: 1.5, marginTop: 8 }}>
      {r.substitutes.length > 0 && (
        <>
          <p style={{ margin: "0 0 4px", fontWeight: 700 }}>Náhradníci v pořadí</p>
          <ol style={{ margin: "0 0 10px", paddingLeft: 22 }}>
            {r.substitutes.map(id => (
              <li key={id}>{name(id)}{lottery.people[id]?.fromRun ? <span style={{ color: "var(--c-text-faint)" }}> (zůstává náhradníkem svého běhu)</span> : null}</li>
            ))}
          </ol>
        </>
      )}
      {r.declined.length > 0 && <p style={{ margin: "0 0 10px" }}><b>Nejedou</b> (náhradníky být nechtějí): {r.declined.map(name).join(", ")}</p>}
      <p style={{ margin: "0 0 4px", fontWeight: 700 }}>Protokol</p>
      <ul style={{ margin: 0, paddingLeft: 18 }}>
        {r.log.map((l, i) => <li key={i} style={{ color: l.level === "warn" ? "var(--c-accent)" : undefined }}>{l.text}</li>)}
      </ul>
    </div>
  )
}
