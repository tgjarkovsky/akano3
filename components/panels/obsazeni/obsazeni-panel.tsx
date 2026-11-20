"use client"

import React, { useMemo } from "react"
import { useGame } from "@/lib/game-context"
import { UNITS, TEAMS } from "@/lib/data"
import { getUnitName, getTeamName } from "@/lib/utils"
import { computeUnitSlots } from "@/lib/unit-slots"
import { checkAssignment, charactersWithIssues } from "@/lib/assignment-checks"
import type { Specialization, Origin, Triplet } from "@/lib/types"
import { useSetupSave, useRoleHolders } from "./shared"
import { useRules } from "@/components/panels/pravidla/rules-context"
import { pendingFixedValues } from "@/lib/assignment-rules"
import { ruleOptionsFor } from "@/lib/rule-options"
import { RunBar } from "./run-bar"
import { UnitBoard } from "./unit-board"
import { CharacterTable } from "./character-table"
import { ChecksPanel } from "./checks-panel"
import { useCast, castCharacter, fitOf, AdultCast } from "./cast"
import { SectionTitle } from "./shared"
import { checkCast, playerName } from "@/lib/cast"
import type { Character } from "@/lib/types"

// Běhy a obsazení v Přípravě: nástěnka jednotek, tabulka postav s hráči,
// dospělé postavy, kontroly. Vše se ukládá do aktivního běhu (stejně jako
// zbytek /api/config); hráči na postavy přes /api/priprava/cast.

export function ObsazeniPanel() {
  const { teams, characters } = useGame()
  const { save, pending } = useSetupSave()
  const { index: rules, roles, pending: rulesPending, applyFixed } = useRules()
  const holders = useRoleHolders()
  const cast = useCast()

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
  const allIssues = useMemo(() => [...issues, ...(castCheck?.issues ?? [])], [issues, castCheck])

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

  return (
    <div>
      <RunBar cast={cast.board && {
        cast: cast.playerOf.size,
        total: players.length + adults.length,
        accepted: cast.board.candidates.filter(p => p.status === "accepted").length,
        uncastMessage: castCheck?.uncastMessage ?? null,
        publishedAt: cast.board.publishedAt,
        publishing: cast.pending === "publish",
        onPublish: cast.publish,
      }} />
      <div className="obsazeni-checks-narrow"><ChecksPanel issues={allIssues} compact /></div>
      <div className="obsazeni-grid">
        <div style={{ minWidth: 0, display: "flex", flexDirection: "column", gap: 28 }}>
          <UnitBoard slots={slots} unplacedTeamIds={unplacedTeamIds} characters={players}
            unitsWithIssues={unitsWithIssues} pendingTeamId={pendingTeamId} onMove={moveTeam} rules={rules} roles={roles}
            held={holders.held} fixedHolders={holders.fixed} rolePending={holders.pending} onAssignRole={holders.assign} />
          <CharacterTable slots={slots} unplacedTeamIds={unplacedTeamIds} players={players}
            withIssues={withIssues} pending={pending}
            onSpec={setSpec} onOrigin={setOrigin} onCircle={setCircle}
            rules={rules} roles={roles} held={holders.held} fixedPending={fixedPending} applyingFixed={rulesPending === "apply-fixed"} onApplyFixed={applyFixed}
            cast={cast.board ? { board: cast.board, pending: cast.pending, toCast, characterName, onAssign: cast.assign } : undefined} />
          {cast.board && adults.length > 0 && (
            <section>
              <SectionTitle note="Hráči dospělých postav">Dospělí</SectionTitle>
              <AdultCast adults={adults} board={cast.board} pending={cast.pending} toCast={toCast}
                characterName={characterName} onAssign={cast.assign} />
            </section>
          )}
        </div>
        <aside className="obsazeni-aside"><ChecksPanel issues={allIssues} /></aside>
      </div>
    </div>
  )
}
