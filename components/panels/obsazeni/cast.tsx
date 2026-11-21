"use client"

import React, { useCallback, useEffect, useMemo, useState } from "react"
import { useGame } from "@/lib/game-context"
import { adminFetch, getOrganizer } from "@/lib/admin-client"
import { UNITS, CIRCLES, TEAMS } from "@/lib/data"
import { SPECIALIZATION_OPTIONS, ORIGIN_OPTIONS } from "@/lib/setup-options"
import { castFit, fitMark, playerName, suggestCast, type CastCharacter, type CastFit, type CastStatus } from "@/lib/cast"
import type { Prihlaska } from "@/lib/prihlaska"
import { castFromLottery, NAKAMURA_ID, type LotteryResult } from "@/lib/lottery"
import type { Character } from "@/lib/types"

// Obsazení hráčů na postavy v aktivním běhu: načtení, přiřazení, zveřejnění
// a výběr hráče u postavy se značkami podle jeho voleb v přihlášce.

export type CastCandidate = { id: number; status: CastStatus; data: Prihlaska; characterId: string | null }
export type CastBoard = {
  runId: number
  candidates: CastCandidate[]
  publishedAt: string | null
  gender: Record<string, "m" | "f">
}

export function useCast(runId: number | null) {
  const { addToast } = useGame()
  const [board, setBoard] = useState<CastBoard | null>(null)
  const [pending, setPending] = useState<string | null>(null)

  const reload = useCallback(async () => {
    if (runId === null) return
    try {
      const r = await adminFetch(`/api/priprava/cast?run=${runId}`)
      if (r.ok) setBoard(await r.json())
    } catch { /* bez sítě zůstane poslední stav */ }
  }, [runId])
  useEffect(() => {
    if (runId === null) return
    let cancelled = false
    adminFetch(`/api/priprava/cast?run=${runId}`)
      .then(r => r.ok ? r.json() : null)
      .then(b => { if (!cancelled && b) setBoard(b) })
      .catch(() => { /* bez sítě zůstane poslední stav */ })
    return () => { cancelled = true }
  }, [runId])

  const post = useCallback(async (key: string, body: Record<string, unknown>, failText: string) => {
    setPending(key)
    try {
      const res = await adminFetch("/api/priprava/cast", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...body, runId, by: getOrganizer() }),
      })
      if (!res.ok) { addToast(res.status === 409 || res.status === 400 ? await res.text() : failText, "error"); return false }
      setBoard(await res.json())
      return true
    } catch {
      addToast("Chyba sítě, změna se neuložila", "error")
      return false
    } finally {
      setPending(null)
    }
  }, [addToast, runId])

  const assign = useCallback((characterId: string, prihlaskaId: number | null) =>
    post(`cast:${characterId}`, { characterId, prihlaskaId }, "Hráče se nepodařilo obsadit"), [post])
  const assignMany = useCallback((pairs: { characterId: string; prihlaskaId: number }[]) =>
    post("suggest", { assign: pairs }, "Návrh se nepodařilo uložit"), [post])
  const publish = useCallback((published: boolean) =>
    post("publish", { publish: published }, "Zveřejnění se nepodařilo uložit"), [post])

  // Dokud se nový běh nenačte, neukazuj starý.
  const current = board && board.runId === runId ? board : null
  /** id postavy → přihláška hráče, který ji hraje */
  const playerOf = useMemo(() => new Map(
    (current?.candidates ?? []).filter(c => c.characterId).map(c => [c.characterId!, c]),
  ), [current])

  return { board: current, assign, assignMany, publish, pending, playerOf, reload }
}

const nameOf = (kind: "unit" | "circle" | "specialization" | "origin", id: string) => {
  const list = kind === "unit" ? UNITS : kind === "circle" ? CIRCLES : null
  if (list) return list.find(x => x.id === id)?.name ?? id
  const opts = kind === "specialization" ? SPECIALIZATION_OPTIONS : ORIGIN_OPTIONS
  return opts.find(o => o.value === id)?.label ?? id
}

/** Postava, jak ji vidí shoda s hráčem: rod a prvky v aktivním běhu. */
export function castCharacter(c: Character, gender: Record<string, "m" | "f">, unitOfTeam: (teamId: string) => string | undefined): CastCharacter {
  return {
    id: c.id,
    kind: c.role === "teacher" ? "adult" : "player",
    teamId: c.teamId,
    gender: gender[c.id] ?? null,
    unitId: c.teamId ? unitOfTeam(c.teamId) : undefined,
    circleId: c.circleIds.length === 1 ? c.circleIds[0] : undefined,
    specialization: c.specialization,
    origin: c.origin,
  }
}

export const fitOf = (p: CastCandidate, c: CastCharacter): CastFit => castFit(p.data, c, nameOf)

/**
 * Návrh obsazení volných postav přijatými hráči bez postavy. S použitým losem
 * podle jeho skupin (Nakamura, trojice do týmů, dospělí, jednotlivci), bez něj
 * jen podle preferencí (lib/cast.ts).
 */
export function suggestFor(board: CastBoard, characters: CastCharacter[], groups: LotteryResult["selected"] | null): { assign: Map<string, number>; notes: string[] } {
  const players = board.candidates.filter(p => p.status === "accepted")
  if (!groups) return { assign: suggestCast(characters, players, nameOf), notes: [] }
  return castFromLottery({
    selected: groups, players,
    adults: characters.filter(c => c.kind === "adult"), students: characters.filter(c => c.kind === "player"),
    teams: TEAMS, nakamuraId: NAKAMURA_ID, nameOf,
  })
}

/** Výběr hráče u postavy. Přijatí seřazení podle shody, náhradníci jen pro přehled. */
export function PlayerSelect({ character, board, characterName, busy, onAssign }: {
  character: CastCharacter
  board: CastBoard
  characterName: (id: string) => string
  busy: boolean
  onAssign: (prihlaskaId: number | null) => void
}) {
  const current = board.candidates.find(p => p.characterId === character.id)
  const options = useMemo(() => {
    const accepted = board.candidates.filter(p => p.status === "accepted").map(p => ({ p, fit: fitOf(p, character) }))
    const rank = (f: CastFit) => f.refused ? 3 : f.warnings.length ? 2 : f.wanted ? 0 : 1
    return accepted.sort((a, b) => rank(a.fit) - rank(b.fit) || playerName(a.p.data).localeCompare(playerName(b.p.data), "cs"))
  }, [board, character])
  const substitutes = board.candidates.filter(p => p.status === "substitute")
  const currentFit = current && fitOf(current, character)

  return (
    <span style={{ display: "block" }}>
      <select className="circle-select" value={current?.id ?? ""} disabled={busy} aria-label={`Hráč postavy ${characterName(character.id)}`}
        style={{ width: "100%", maxWidth: 300 }}
        onChange={e => onAssign(e.target.value ? Number(e.target.value) : null)}>
        <option value="">{options.length ? "Bez hráče" : "Žádný přijatý hráč"}</option>
        {options.map(({ p, fit }) => {
          const mark = fitMark(fit)
          const elsewhere = p.characterId && p.characterId !== character.id ? ` · hraje ${characterName(p.characterId)}` : ""
          return <option key={p.id} value={p.id}>{mark ? `${mark} ` : ""}{playerName(p.data)}{elsewhere}</option>
        })}
        {substitutes.length > 0 && (
          <optgroup label="Náhradníci (nejdřív přijmout v Přihláškách)">
            {substitutes.map(p => <option key={p.id} value={p.id} disabled>{playerName(p.data)}</option>)}
          </optgroup>
        )}
      </select>
      {currentFit && (currentFit.refused || currentFit.warnings.length > 0) && (
        <span style={{ display: "block", fontSize: "0.74rem", color: currentFit.refused ? "var(--destructive)" : "var(--c-accent)", marginTop: 2 }}>
          {[currentFit.refused && "postavu odmítl(a)", ...currentFit.warnings].filter(Boolean).join(" · ")}
        </span>
      )}
    </span>
  )
}
