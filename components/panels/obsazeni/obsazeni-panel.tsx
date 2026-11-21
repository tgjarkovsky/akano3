"use client"

import React, { useEffect, useMemo, useState } from "react"
import { useGame } from "@/lib/game-context"
import { UNITS, TEAMS } from "@/lib/data"
import { getUnitName, getTeamName } from "@/lib/utils"
import { computeUnitSlots } from "@/lib/unit-slots"
import { checkAssignment, charactersWithIssues } from "@/lib/assignment-checks"
import type { Specialization, Origin, Triplet } from "@/lib/types"
import { useSetupSave, useRoleHolders, useRunState } from "./shared"
import { useRules } from "@/components/panels/pravidla/rules-context"
import { pendingFixedValues } from "@/lib/assignment-rules"
import { ruleOptionsFor } from "@/lib/rule-options"
import { RunBar } from "./run-bar"
import { UnitBoard } from "./unit-board"
import { CharacterTable } from "./character-table"
import { ChecksPanel } from "./checks-panel"
import { useCast, castCharacter, fitOf } from "./cast"
import { CastTable } from "./cast-table"
import { LotteryTab, useLottery } from "./lottery-tab"
import type { LotteryRuns } from "@/lib/lottery-store"
import { checkCast, playerName } from "@/lib/cast"
import type { Character } from "@/lib/types"

// Běhy a obsazení v Přípravě, tři záložky:
// Postavy = nástěnka jednotek a tabulka specializací, původů a kruhů (/api/config),
// Los = kdo jede a v jaké skupině, po fázích (/api/priprava/losovani),
// Hráči = kdo hraje kterou postavu, návrh podle losu a přihlášek a zveřejnění (/api/priprava/cast).
// Kontroly vpravo patří k otevřené záložce. Postavy a Hráči platí pro běh vybraný
// nahoře (RunBar), nezávisle na aktivním běhu: obsazuje se dávno před hraním.

type Tab = "characters" | "lottery" | "players"
const TABS: readonly Tab[] = ["characters", "lottery", "players"]
const TAB_KEY = "akano_obsazeni_tab"
const RUN_KEY = "akano_obsazeni_run"

export function ObsazeniPanel() {
  const { runs, activeRunId } = useGame()
  const [tab, setTab] = useState<Tab>("characters")
  const [picked, setPicked] = useState<number | null>(null)
  useEffect(() => {
    try {
      const saved = localStorage.getItem(TAB_KEY) as Tab | null
      if (saved && TABS.includes(saved)) setTab(saved)
      const run = Number(localStorage.getItem(RUN_KEY))
      if (run > 0) setPicked(run)
    } catch { /* bez úložiště zůstane výchozí */ }
  }, [])
  const pickTab = (t: Tab) => {
    setTab(t)
    try { localStorage.setItem(TAB_KEY, t) } catch { /* nevadí */ }
  }
  const pickRun = (id: number) => {
    setPicked(id)
    try { localStorage.setItem(RUN_KEY, String(id)) } catch { /* nevadí */ }
  }
  // Vybraný běh; bez volby aktivní, bez aktivního poslední založený.
  const runId = (picked !== null && runs.some(r => r.id === picked) ? picked : null) ?? activeRunId ?? runs.at(-1)?.id ?? null
  const runState = useRunState(runId)
  const characters = useMemo(() => runState.characters ?? [], [runState.characters])
  const teams = useMemo(() => runState.teams ?? [], [runState.teams])
  const { save, pending } = useSetupSave(runId, runState.reload)
  const { index: rules, roles, pending: rulesPending, applyFixed } = useRules()
  const holders = useRoleHolders(runId)
  const cast = useCast(runId)
  const lottery = useLottery()

  const players = useMemo(
    () => characters.filter(c => (c.role === "student" || c.role === "ruze") && c.teamId),
    [characters],
  )

  const slots = useMemo(() => computeUnitSlots(
    UNITS.map(u => u.id),
    TEAMS.map(t => {
      const live = teams.find(x => x.id === t.id)
      return { teamId: t.id, unitId: live?.unitId ?? t.unitId, triplet: live?.triplet ?? null }
    }),
  ), [teams])

  const unplacedTeamIds = useMemo(() => {
    const placed = new Set(slots.flatMap(s => [s.A, s.B, ...s.overflow].filter(Boolean) as string[]))
    return TEAMS.map(t => t.id).filter(id => !placed.has(id))
  }, [slots])

  const issues = useMemo(() => checkAssignment({
    slots, unplacedTeamIds, players,
    unitName: getUnitName, teamName: getTeamName,
    rules, optionsFor: ruleOptionsFor, roles, held: holders.held,
  }), [slots, unplacedTeamIds, players, rules, roles, holders.held])
  const adults = useMemo(() => characters.filter(c => c.role === "teacher"), [characters])
  const unitOfTeam = useMemo(() => {
    const m = new Map<string, string>()
    for (const s of slots) for (const id of [s.A, s.B, ...s.overflow]) if (id) m.set(id, s.unitId)
    return m
  }, [slots])
  const characterName = useMemo(() => {
    const m = new Map(characters.map(c => [c.id, c.name]))
    return (id: string) => m.get(id) ?? id
  }, [characters])
  const gender = cast.board?.gender
  const toCast = useMemo(() => (c: Character) => castCharacter(c, gender ?? {}, id => unitOfTeam.get(id)), [gender, unitOfTeam])

  const castCheck = useMemo(() => {
    if (!cast.board) return null
    const castMap = new Map([...cast.playerOf].map(([characterId, p]) => {
      const c = characters.find(x => x.id === characterId)
      return [characterId, { name: playerName(p.data), fit: c ? fitOf(p, toCast(c)) : { wanted: false, refused: false, warnings: [] } }]
    }))
    return checkCast({
      characters: [...players, ...adults].map(c => ({ id: c.id, name: c.name })),
      cast: castMap,
      uncast: cast.board.candidates.filter(p => p.status === "accepted" && !p.characterId).map(p => playerName(p.data)),
    })
  }, [cast.board, cast.playerOf, characters, players, adults, toCast])

  const fixedPending = useMemo(() => pendingFixedValues(rules, players).length, [rules, players])

  const unitsWithIssues = useMemo(
    () => new Set(issues.filter(i => i.target.type === "unit").map(i => i.target.id)),
    [issues],
  )
  const withIssues = useMemo(() => charactersWithIssues(issues), [issues])

  // Přesun mění, které role týmu platí, proto se role načtou znovu.
  const moveTeam = async (teamId: string, unitId: string, triplet: Triplet) => {
    if (await save(`team:${teamId}`, { action: "placeTeam", teamId, unitId, triplet })) await holders.reload()
  }
  const setSpec = (characterId: string, specialization: Specialization) =>
    save(`spec:${characterId}`, { action: "setSpecialization", characterId, specialization })
  const setOrigin = (characterId: string, origin: Origin) =>
    save(`origin:${characterId}`, { action: "setOrigin", characterId, origin })
  const setCircle = (characterId: string, circleId: string) =>
    save(`circle:${characterId}`, { action: "setCharacterCircle", characterId, circleId })

  const pendingTeamId = pending?.startsWith("team:") ? pending.slice(5) : null

  // Skupiny pro záložku Hráči: týmy v pořadí nástěnky, pak dospělí.
  const castGroups = useMemo(() => {
    const out: { key: string; teamId?: string; title: string; label: string; characters: Character[] }[] = []
    const push = (teamId: string, label: string) => {
      const list = players.filter(c => c.teamId === teamId)
      if (list.length) out.push({ key: teamId, teamId, title: TEAMS.find(t => t.id === teamId)?.name ?? teamId, label, characters: list })
    }
    for (const s of slots) {
      for (const t of ["A", "B"] as const) if (s[t]) push(s[t]!, `${getUnitName(s.unitId)} · ${t}`)
      for (const id of s.overflow) push(id, `${getUnitName(s.unitId)} · navíc`)
    }
    for (const id of unplacedTeamIds) push(id, "Bez jednotky")
    if (adults.length) out.push({ key: "adults", title: "Dospělí", label: "učitelé a další dospělé postavy", characters: adults })
    return out
  }, [slots, unplacedTeamIds, players, adults])

  // Postavy pro losování, jak je vidí shoda s hráčem (stejné jako výběr hráče).
  const drawLottery = (map: LotteryRuns) => lottery.draw(
    map,
    adults.map(c => ({ ...toCast(c), name: c.name })),
    players.map(c => ({ ...toCast(c), name: c.name })),
  )
  const applyLottery = async (id: number) => {
    const ok = await lottery.apply(id)
    if (ok) await cast.reload()
    return ok
  }
  const revertLottery = async (id: number) => {
    const ok = await lottery.revert(id)
    if (ok) await cast.reload()
    return ok
  }
  // Skupiny z použitého losu pro vybraný běh (návrh obsazení podle nich).
  const lotteryGroups = useMemo(() => {
    const l = lottery.lottery
    if (!l?.appliedAt) return null
    const mine = l.result.selected.filter(s => l.runs[s.term] === runId)
    return mine.length ? mine : null
  }, [lottery.lottery, runId])
  const runName = runs.find(r => r.id === runId)?.name ?? ""
  const goCast = (id: number) => { pickRun(id); pickTab("players") }

  const structureIssues = issues.length
  const castIssues = castCheck?.issues ?? []
  const tabBtn = (t: Tab, label: React.ReactNode) => (
    <button role="tab" aria-selected={tab === t} className="obsazeni-tab" data-on={tab === t ? "true" : undefined} onClick={() => pickTab(t)}>
      {label}
    </button>
  )

  return (
    <div>
      <RunBar runId={runId} onRunChange={pickRun} />
      <div role="tablist" aria-label="Části obsazení" className="obsazeni-tabs">
        {tabBtn("characters", <>Postavy {structureIssues > 0 && <span className="obsazeni-tab-badge">{structureIssues}</span>}</>)}
        {tabBtn("lottery", <>Los {lottery.lottery && <span className="obsazeni-tab-count">{lottery.lottery.appliedAt ? "použitý" : "náhled"}</span>}</>)}
        {tabBtn("players", <>Hráči <span className="obsazeni-tab-count">{cast.playerOf.size}/{players.length + adults.length}</span></>)}
      </div>
      {tab === "characters" && !runState.characters ? (
        <p style={{ color: "var(--c-text-muted)", fontSize: "0.9rem" }}>Načítám běh…</p>
      ) : tab === "characters" ? (
        <>
          <div className="obsazeni-checks-narrow"><ChecksPanel issues={issues} compact /></div>
          <div className="obsazeni-grid">
            <div style={{ minWidth: 0, display: "flex", flexDirection: "column", gap: 28 }}>
              <UnitBoard slots={slots} unplacedTeamIds={unplacedTeamIds} characters={players}
                unitsWithIssues={unitsWithIssues} pendingTeamId={pendingTeamId} onMove={moveTeam} rules={rules} roles={roles}
                held={holders.held} fixedHolders={holders.fixed} rolePending={holders.pending} onAssignRole={holders.assign} />
              <CharacterTable slots={slots} unplacedTeamIds={unplacedTeamIds} players={players}
                withIssues={withIssues} pending={pending}
                onSpec={setSpec} onOrigin={setOrigin} onCircle={setCircle}
                rules={rules} roles={roles} held={holders.held} fixedPending={fixedPending} applyingFixed={rulesPending === "apply-fixed"} onApplyFixed={() => applyFixed(runId, runState.reload)} />
            </div>
            <aside className="obsazeni-aside"><ChecksPanel issues={issues} /></aside>
          </div>
        </>
      ) : tab === "lottery" ? (
        <LotteryTab lottery={lottery.lottery} busy={lottery.busy} runs={runs} defaultRunId={runId}
          onDraw={drawLottery} onApply={applyLottery} onRevert={revertLottery} onGoCast={goCast} />
      ) : !cast.board ? (
        <p style={{ color: "var(--c-text-muted)", fontSize: "0.9rem" }}>Načítám hráče…</p>
      ) : (
        <>
          <div className="obsazeni-checks-narrow"><ChecksPanel issues={castIssues} compact /></div>
          <div className="obsazeni-grid">
            <div style={{ minWidth: 0 }}>
              <CastTable groups={castGroups} board={cast.board} pending={cast.pending} toCast={toCast}
                characterName={characterName} uncastMessage={castCheck?.uncastMessage ?? null}
                onAssign={cast.assign} onAssignMany={cast.assignMany} onPublish={cast.publish} runName={runName}
                lotteryGroups={lotteryGroups} />
            </div>
            <aside className="obsazeni-aside"><ChecksPanel issues={castIssues} /></aside>
          </div>
        </>
      )}
    </div>
  )
}
