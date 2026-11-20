"use client"

import React, { useMemo, useState } from "react"
import { IconSearch, IconSparkles, IconEye, IconEyeOff, IconCheck, IconX } from "@tabler/icons-react"
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { useGame } from "@/lib/game-context"
import { TEAMS, CIRCLES } from "@/lib/data"
import { TeamIcon } from "@/components/shared/team-icon"
import { SPECIALIZATION_OPTIONS, ORIGIN_OPTIONS } from "@/lib/setup-options"
import { fitMark, playerName, type CastCharacter } from "@/lib/cast"
import type { Character } from "@/lib/types"
import { PlayerSelect, fitOf, suggestFor, type CastBoard } from "./cast"

// Záložka Hráči v Obsazení: kdo hraje kterou postavu, strojový návrh podle
// přihlášek ke schválení a zveřejnění obsazení hráčům.

type Group = { key: string; teamId?: string; title: string; label: string; characters: Character[] }

export function CastTable({ groups, board, pending, toCast, characterName, uncastMessage, onAssign, onAssignMany, onPublish, runName }: {
  groups: Group[]
  board: CastBoard
  pending: string | null
  toCast: (c: Character) => CastCharacter
  characterName: (id: string) => string
  uncastMessage: string | null
  onAssign: (characterId: string, prihlaskaId: number | null) => void
  onAssignMany: (pairs: { characterId: string; prihlaskaId: number }[]) => Promise<boolean>
  onPublish: (published: boolean) => Promise<boolean>
  runName: string
}) {
  const { addToast } = useGame()
  const [query, setQuery] = useState("")
  const [onlyEmpty, setOnlyEmpty] = useState(false)
  const [proposal, setProposal] = useState<Map<string, number> | null>(null)
  const [confirmPublish, setConfirmPublish] = useState(false)

  const all = useMemo(() => groups.flatMap(g => g.characters), [groups])
  const byId = useMemo(() => new Map(board.candidates.map(p => [p.id, p])), [board])
  const playerOf = useMemo(() => new Map(board.candidates.filter(p => p.characterId).map(p => [p.characterId!, p])), [board])
  const accepted = board.candidates.filter(p => p.status === "accepted").length

  const propose = () => {
    const s = suggestFor(board, all.map(toCast))
    if (s.size === 0) { addToast("Není co navrhnout: volným hráčům žádná volná postava nesedí", "info"); return }
    setProposal(s)
    setOnlyEmpty(false)
  }
  const drop = (characterId: string) => setProposal(p => {
    if (!p) return p
    const next = new Map(p); next.delete(characterId)
    return next.size ? next : null
  })
  const approve = async () => {
    if (!proposal) return
    if (await onAssignMany([...proposal].map(([characterId, prihlaskaId]) => ({ characterId, prihlaskaId })))) {
      addToast(`Obsazeno ${proposal.size} postav podle návrhu`, "success")
      setProposal(null)
    }
  }

  const proposalStats = useMemo(() => {
    if (!proposal) return null
    let wanted = 0, warned = 0
    for (const [cid, pid] of proposal) {
      const c = all.find(x => x.id === cid), p = byId.get(pid)
      if (!c || !p) continue
      const f = fitOf(p, toCast(c))
      if (f.wanted) wanted++
      if (f.warnings.length) warned++
    }
    const left = board.candidates.filter(p => p.status === "accepted" && !p.characterId).length - proposal.size
    return { wanted, warned, left }
  }, [proposal, all, byId, toCast, board])

  const q = query.trim().toLowerCase()
  const visible = (c: Character) => {
    const p = playerOf.get(c.id)
    if (onlyEmpty && (p || proposal?.has(c.id))) return false
    if (!q) return true
    const who = p ? playerName(p.data).toLowerCase() : ""
    return c.name.toLowerCase().includes(q) || who.includes(q)
  }

  const btn: React.CSSProperties = {
    display: "inline-flex", alignItems: "center", gap: 6, minHeight: 36, padding: "0 12px",
    backgroundColor: "transparent", border: "1px solid var(--c-border-mid)", borderRadius: 6,
    color: "var(--c-text)", fontSize: "0.82rem", cursor: "pointer", whiteSpace: "nowrap",
  }
  const primary: React.CSSProperties = { ...btn, backgroundColor: "var(--c-accent)", borderColor: "var(--c-accent)", color: "var(--ink-900)", fontWeight: 700 }
  const chip = (active: boolean): React.CSSProperties => ({
    minHeight: 32, padding: "0 12px", borderRadius: 16, cursor: "pointer", fontSize: "0.8rem",
    border: `1px solid ${active ? "var(--c-accent)" : "var(--c-border-mid)"}`,
    backgroundColor: active ? "color-mix(in srgb, var(--c-accent) 18%, transparent)" : "transparent",
    color: active ? "var(--c-text)" : "var(--c-text-muted)", fontWeight: active ? 700 : 400, whiteSpace: "nowrap",
  })

  return (
    <section>
      <div className="cast-summary">
        <div style={{ minWidth: 0, fontSize: "0.85rem", color: "var(--c-text-muted)", lineHeight: 1.45 }}>
          <span style={{ color: "var(--c-text)", fontWeight: 700 }}>Obsazeno {playerOf.size} z {all.length} postav</span>
          {" · "}{accepted} přijatých
          {" · "}{board.publishedAt
            ? <span style={{ color: "var(--c-success)", fontWeight: 700 }}>zveřejněno {new Date(board.publishedAt).toLocaleDateString("cs-CZ")}</span>
            : "hráči obsazení zatím nevidí"}
          {uncastMessage && <span style={{ display: "block", color: "var(--c-accent)" }}>{uncastMessage}</span>}
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {!proposal && (
            <button style={btn} onClick={propose} title="Doplní volné postavy volnými přijatými hráči podle jejich voleb v přihlášce">
              <IconSparkles size={14} /> Navrhnout obsazení
            </button>
          )}
          {board.publishedAt
            ? <button style={btn} disabled={pending === "publish"} onClick={() => onPublish(false)}><IconEyeOff size={14} /> Skrýt obsazení</button>
            : <button style={btn} disabled={pending === "publish" || playerOf.size === 0 || !!proposal} onClick={() => setConfirmPublish(true)}><IconEye size={14} /> Zveřejnit obsazení</button>}
        </div>
      </div>

      {proposal && proposalStats && (
        <div className="cast-proposal" role="status">
          <div style={{ minWidth: 0, fontSize: "0.85rem", lineHeight: 1.45 }}>
            <span style={{ fontWeight: 700, color: "var(--c-text)" }}>Návrh obsadí {proposal.size} postav</span>
            <span style={{ color: "var(--c-text-muted)" }}>
              {" · "}{proposalStats.wanted}× ★ chce
              {proposalStats.warned > 0 && <> · {proposalStats.warned}× ⚠ s výhradou</>}
              {proposalStats.left > 0 && <> · bez postavy by zůstalo {proposalStats.left} hráčů</>}
            </span>
            <span style={{ display: "block", fontSize: "0.78rem", color: "var(--c-text-faint)" }}>
              Ručně obsazené postavy návrh nemění. Odmítnuté postavy a jiný rod nenavrhuje. Jednotlivé návrhy jde vyškrtnout.
            </span>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button style={primary} disabled={pending === "suggest"} onClick={approve}>
              <IconCheck size={14} /> {pending === "suggest" ? "Ukládám…" : `Schválit návrh (${proposal.size})`}
            </button>
            <button style={btn} disabled={pending === "suggest"} onClick={() => setProposal(null)}><IconX size={14} /> Zahodit</button>
          </div>
        </div>
      )}

      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center", margin: "16px 0 12px" }}>
        <label style={{ position: "relative", flex: "1 1 200px", maxWidth: 260 }}>
          <span className="sr-only">Hledat postavu nebo hráče</span>
          <IconSearch size={14} color="var(--c-text-faint)" style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)" }} />
          <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Hledat postavu nebo hráče"
            style={{
              width: "100%", boxSizing: "border-box", minHeight: 34, padding: "0 10px 0 30px",
              backgroundColor: "var(--c-input)", border: "1px solid var(--c-input-border)", borderRadius: 6,
              color: "var(--c-text)", fontSize: "0.85rem",
            }} />
        </label>
        <button style={chip(!onlyEmpty)} onClick={() => setOnlyEmpty(false)}>Všechny ({all.length})</button>
        <button style={chip(onlyEmpty)} onClick={() => setOnlyEmpty(true)}>Bez hráče ({all.length - playerOf.size - (proposal?.size ?? 0)})</button>
      </div>

      <div className="char-table" role="table" aria-label="Hráči na postavách">
        {groups.map(g => {
          const rows = g.characters.filter(visible)
          if (rows.length === 0) return null
          const team = g.teamId ? TEAMS.find(t => t.id === g.teamId) : undefined
          return (
            <div key={g.key} role="rowgroup">
              <div className="char-group" role="row" style={{ borderLeftColor: team?.color ?? "var(--c-border-mid)" }}>
                {g.teamId && <TeamIcon teamId={g.teamId} size={14} />}
                <span style={{ fontWeight: 700 }}>{g.title}</span>
                <span style={{ color: "var(--c-text-faint)" }}>{g.label}</span>
              </div>
              {rows.map(c => {
                const cc = toCast(c)
                const proposed = proposal?.get(c.id)
                const pp = proposed !== undefined ? byId.get(proposed) : undefined
                const ppFit = pp && fitOf(pp, cc)
                return (
                  <div key={c.id} id={`postava-${c.id}`} className="cast-row" role="row" data-proposed={pp ? "true" : undefined}>
                    <span role="cell" style={{ minWidth: 0 }}>
                      <span style={{ fontWeight: 700, color: "var(--c-text)" }}>{c.name}</span>
                      <span className="cast-meta">{characterMeta(c)}</span>
                    </span>
                    <span role="cell" style={{ minWidth: 0 }}>
                      {pp && ppFit ? (
                        <span className="cast-proposed">
                          <span style={{ minWidth: 0 }}>
                            <span style={{ fontSize: "0.7rem", letterSpacing: "0.06em", color: "var(--c-accent)", display: "block" }}>NÁVRH</span>
                            {fitMark(ppFit) && <span aria-hidden>{fitMark(ppFit)} </span>}{playerName(pp.data)}
                            {ppFit.warnings.length > 0 && (
                              <span style={{ display: "block", fontSize: "0.74rem", color: "var(--c-accent)" }}>{ppFit.warnings.join(" · ")}</span>
                            )}
                          </span>
                          <button type="button" className="cast-drop" onClick={() => drop(c.id)} aria-label={`Vyškrtnout návrh pro ${c.name}`}>
                            <IconX size={14} />
                          </button>
                        </span>
                      ) : (
                        <PlayerSelect character={cc} board={board} characterName={characterName}
                          busy={pending === `cast:${c.id}` || pending === "suggest"} onAssign={id => onAssign(c.id, id)} />
                      )}
                    </span>
                  </div>
                )
              })}
            </div>
          )
        })}
        {groups.every(g => g.characters.filter(visible).length === 0) && (
          <p style={{ padding: 16, color: "var(--c-text-muted)", fontSize: "0.9rem", margin: 0 }}>Žádná postava neodpovídá filtru.</p>
        )}
      </div>

      <AlertDialog open={confirmPublish} onOpenChange={setConfirmPublish}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Zveřejnit obsazení {runName}?</AlertDialogTitle>
            <AlertDialogDescription>
              Obsazení hráči uvidí na odkazu své přihlášky svou postavu a stav platby a budou moct nahrát fotku.
              Fotky se objeví ve spisech spoluhráčů. Mail se tím neposílá, to jde v modulu Hráči.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Zrušit</AlertDialogCancel>
            <AlertDialogAction onClick={() => { setConfirmPublish(false); void onPublish(true) }}>Zveřejnit</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  )
}

/** Krátký popis postavy pro výběr hráče: specializace · původ · kruh. */
function characterMeta(c: Character): string {
  if (c.role === "teacher") return "dospělá postava"
  const spec = SPECIALIZATION_OPTIONS.find(o => o.value === c.specialization)?.label
  const origin = ORIGIN_OPTIONS.find(o => o.value === c.origin)?.label
  const circle = c.circleIds.length === 1 ? CIRCLES.find(x => x.id === c.circleIds[0])?.name : undefined
  return [spec, origin, circle].filter(Boolean).join(" · ")
}
