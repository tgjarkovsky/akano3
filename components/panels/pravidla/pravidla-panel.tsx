"use client"

import React, { useMemo, useState } from "react"
import { IconLock, IconSearch, IconX, IconCheck } from "@tabler/icons-react"
import { TEAMS, CHARACTERS, UNITS } from "@/lib/data"
import { getUnitName } from "@/lib/utils"
import { roleLabel, roleRuleOptions } from "@/lib/role-rules"
import { TeamIcon } from "@/components/shared/team-icon"
import { allowedValues, describeRule, PROPERTY_SUBJECT, type RuleKind, type RuleProperty } from "@/lib/assignment-rules"
import { ruleOptionsFor, PROPERTY_LABELS } from "@/lib/rule-options"
import { SectionTitle } from "@/components/panels/obsazeni/shared"
import { useRules } from "./rules-context"

// Pravidla obsazení: pro každou postavu (specializace, původ, kruh, role) a tým
// (jednotka) které hodnoty smí dostat. Platí ve všech bězích. Role jde jen
// napevno a s ní i jednotka a trojice týmu.

const PROPERTIES: RuleProperty[] = ["specialization", "origin", "circle", "role", "unit"]

const KIND_STYLE: Record<RuleKind, React.CSSProperties> = {
  any:    { color: "var(--c-text-faint)", borderColor: "var(--c-border)" },
  fixed:  { color: "var(--c-accent)", borderColor: "color-mix(in srgb, var(--c-accent) 55%, transparent)", fontWeight: 700 },
  except: { color: "var(--c-teal)", borderColor: "color-mix(in srgb, var(--c-teal) 55%, transparent)", fontWeight: 700 },
  some:   { color: "var(--c-teal)", borderColor: "color-mix(in srgb, var(--c-teal) 55%, transparent)", fontWeight: 700 },
}

type Subject = { id: string; name: string; sub?: string; teamId?: string }

export function PravidlaPanel() {
  const { rules, index, roles, loaded, pending, saveRule } = useRules()
  const [property, setProperty] = useState<RuleProperty>("specialization")
  const [onlyRules, setOnlyRules] = useState(false)
  const [query, setQuery] = useState("")

  const subjectType = PROPERTY_SUBJECT[property]
  const options = useMemo(() => (property === "role" ? roleRuleOptions(roles, getUnitName) : ruleOptionsFor(property)), [property, roles])

  const counts = useMemo(() => {
    const m: Record<string, number> = {}
    for (const r of rules) m[r.property] = (m[r.property] ?? 0) + 1
    return m
  }, [rules])

  // Postavy po týmech, nebo týmy samotné (pro jednotku).
  const groups = useMemo((): { teamId: string | null; subjects: Subject[] }[] => {
    if (subjectType === "team") {
      return [{ teamId: null, subjects: TEAMS.map(t => ({ id: t.id, name: t.name, teamId: t.id })) }]
    }
    return TEAMS.map(t => ({
      teamId: t.id,
      subjects: CHARACTERS.filter(c => c.teamId === t.id && (c.role === "student" || c.role === "ruze"))
        .map(c => ({ id: c.id, name: c.name })),
    }))
  }, [subjectType])

  const q = query.trim().toLowerCase()
  const visible = (s: Subject) => {
    if (q && !`${s.name} ${s.sub ?? ""}`.toLowerCase().includes(q)) return false
    if (onlyRules && allowedValues(index, subjectType, s.id, property) === null) return false
    return true
  }

  const toggle = (s: Subject, value: string) => {
    const current = allowedValues(index, subjectType, s.id, property) ?? options.map(o => o.value)
    const next = current.includes(value) ? current.filter(v => v !== value) : [...current, value]
    if (next.length === 0) return
    saveRule(subjectType, s.id, property, next)
  }

  const tab = (active: boolean): React.CSSProperties => ({
    minHeight: 40, padding: "0 14px", cursor: "pointer", fontSize: "0.88rem", whiteSpace: "nowrap",
    border: "none", borderBottom: `2px solid ${active ? "var(--c-accent)" : "transparent"}`,
    background: "transparent", color: active ? "var(--c-text)" : "var(--c-text-muted)", fontWeight: active ? 700 : 500,
  })

  return (
    <div style={{ maxWidth: 1000 }}>
      <p style={{ color: "var(--c-text-muted)", fontSize: "0.92rem", lineHeight: 1.55, margin: "0 0 18px", maxWidth: 720 }}>
        Které hodnoty smí postava nebo tým dostat. Klikni na možnost a vypneš ji: všechny zapnuté znamenají
        <b> libovolná</b>, jedna zapnutá <b>napevno</b>, všechny kromě jedné <b>kterákoli až na</b>.
        Pravidla platí ve všech bězích a obsazení podle nich zamyká volby.
        {property === "role" && <> Roli jde dát jen <b>napevno</b>: tým postavy pak smí jen do jednotky a trojice té role.
          Role se zakládají v Texty → Role.</>}
      </p>

      <div role="tablist" aria-label="Vlastnost" style={{ display: "flex", gap: 4, borderBottom: "1px solid var(--c-border)", marginBottom: 16, overflowX: "auto" }}>
        {PROPERTIES.map(p => (
          <button key={p} role="tab" aria-selected={p === property} style={tab(p === property)} onClick={() => setProperty(p)}>
            {PROPERTY_LABELS[p]}{p === "unit" ? " týmu" : ""}
            {counts[p] ? <span style={{ marginLeft: 6, fontSize: "0.75rem", color: "var(--c-accent)" }}>{counts[p]}</span> : null}
          </button>
        ))}
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center", marginBottom: 14 }}>
        <label style={{ position: "relative", flex: "1 1 200px", maxWidth: 260 }}>
          <span className="sr-only">Hledat</span>
          <IconSearch size={14} color="var(--c-text-faint)" style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)" }} />
          <input value={query} onChange={e => setQuery(e.target.value)} placeholder={subjectType === "team" ? "Hledat tým" : "Hledat postavu"}
            style={{
              width: "100%", boxSizing: "border-box", minHeight: 34, padding: "0 10px 0 30px",
              backgroundColor: "var(--c-input)", border: "1px solid var(--c-input-border)", borderRadius: 6,
              color: "var(--c-text)", fontSize: "0.85rem",
            }} />
        </label>
        <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "0.85rem", color: "var(--c-text-muted)", cursor: "pointer" }}>
          <input type="checkbox" checked={onlyRules} onChange={e => setOnlyRules(e.target.checked)} />
          Jen s pravidlem
        </label>
      </div>

      {!loaded ? <p style={{ color: "var(--c-text-muted)" }}>Načítám pravidla…</p> : (
        <div className="rule-table">
          {groups.map(g => {
            const rows = g.subjects.filter(visible)
            if (rows.length === 0) return null
            const team = g.teamId ? TEAMS.find(t => t.id === g.teamId) : null
            return (
              <div key={g.teamId ?? "teams"}>
                {team && (
                  <div className="char-group" style={{ borderLeftColor: team.color }}>
                    <TeamIcon teamId={team.id} size={14} /> <span style={{ fontWeight: 700 }}>{team.name}</span>
                  </div>
                )}
                {rows.map(s => {
                  const allowed = allowedValues(index, subjectType, s.id, property)
                  const desc = describeRule(allowed, options)
                  const busy = pending === `${subjectType}:${s.id}:${property}`
                  return (
                    <div key={s.id} className="rule-row" style={{ opacity: busy ? 0.55 : 1 }}>
                      <span style={{ minWidth: 0, display: "flex", alignItems: "center", gap: 6 }}>
                        {s.teamId && <TeamIcon teamId={s.teamId} size={14} />}
                        <span>
                          <span style={{ fontWeight: 700, color: "var(--c-text)" }}>{s.name}</span>
                          {s.sub && <span style={{ display: "block", fontSize: "0.78rem", fontStyle: "italic", color: "var(--c-text-muted)" }}>„{s.sub}“</span>}
                        </span>
                      </span>
                      {property === "role" ? (
                        <RolePicker subjectId={s.id} subjectName={s.name} teamId={g.teamId} value={allowed?.[0] ?? ""} busy={busy}
                          onPick={v => saveRule(subjectType, s.id, property, v ? [v] : null)} />
                      ) : (
                      <span className="rule-chips" role="group" aria-label={`${PROPERTY_LABELS[property]} – povolené hodnoty pro ${s.name}`}>
                        {options.map(o => {
                          const on = allowed === null || allowed.includes(o.value)
                          const last = on && allowed !== null && allowed.length === 1
                          return (
                            <button key={o.value} type="button" aria-pressed={on} disabled={busy}
                              title={last ? "Aspoň jedna hodnota musí zůstat povolená" : on ? "Zakázat" : "Povolit"}
                              className={on ? "rule-chip rule-chip-on" : "rule-chip"}
                              onClick={() => { if (!last) toggle(s, o.value) }}>
                              {on ? <IconCheck size={12} aria-hidden /> : <IconX size={12} aria-hidden />} {o.label}
                            </button>
                          )
                        })}
                      </span>
                      )}
                      <span style={{ display: "flex", alignItems: "center", gap: 6, justifyContent: "flex-end", flexWrap: "wrap" }}>
                        <span className="rule-badge" style={KIND_STYLE[desc.kind]}>
                          {desc.kind === "fixed" && <IconLock size={12} aria-hidden />} {desc.text}
                        </span>
                        {property !== "role" && <select value="" disabled={busy} aria-label={`Nastavit ${s.name} napevno`} className="move-select" style={{ width: "auto" }}
                          onChange={e => { if (e.target.value) saveRule(subjectType, s.id, property, [e.target.value]) }}>
                          <option value="">Napevno…</option>
                          {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                        </select>}
                        {allowed !== null && (
                          <button type="button" disabled={busy} className="rule-reset" onClick={() => saveRule(subjectType, s.id, property, null)}
                            aria-label={`Zrušit pravidlo pro ${s.name}`} title="Zrušit pravidlo (libovolná)">
                            <IconX size={14} />
                          </button>
                        )}
                      </span>
                    </div>
                  )
                })}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// Výběr pevné role: role jednotek, které tým postavy smí dostat (pravidlo jednotky).
function RolePicker({ subjectId, subjectName, teamId, value, busy, onPick }: {
  subjectId: string; subjectName: string; teamId: string | null; value: string; busy: boolean
  onPick: (roleId: string | null) => void
}) {
  const { index, roles } = useRules()
  const units = teamId ? allowedValues(index, "team", teamId, "unit") : null
  const list = UNITS.filter(u => units === null || units.includes(u.id) || roles.some(r => String(r.id) === value && r.unitId === u.id))
  return (
    <span className="rule-chips">
      <select value={value} disabled={busy} className="move-select" style={{ width: "auto", minWidth: 220 }}
        aria-label={`Pevná role pro ${subjectName}`} data-subject={subjectId}
        onChange={e => onPick(e.target.value || null)}>
        <option value="">Libovolná role</option>
        {list.map(u => {
          const rs = roles.filter(r => r.unitId === u.id)
          if (rs.length === 0) return null
          return (
            <optgroup key={u.id} label={u.name}>
              {rs.map(r => <option key={r.id} value={String(r.id)}>{roleLabel(r)} · trojice {r.triplet}</option>)}
            </optgroup>
          )
        })}
      </select>
      {roles.length === 0 && <span style={{ fontSize: "0.8rem", color: "var(--c-text-faint)" }}>Zatím žádné role (Texty → Role)</span>}
    </span>
  )
}
