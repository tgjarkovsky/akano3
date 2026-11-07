"use client"

import React, { useMemo, useState } from "react"
import { IconLock, IconSearch, IconX, IconCheck } from "@tabler/icons-react"
import { TEAMS, CHARACTERS, UNITS } from "@/lib/data"
import { getUnitName } from "@/lib/utils"
import { roleLabel, roleRuleOptions } from "@/lib/role-rules"
import { TeamIcon } from "@/components/shared/team-icon"
import { allowedValues, describeRule, type RuleKind, type RuleProperty, type RuleSubject } from "@/lib/assignment-rules"
import { ruleOptionsFor, PROPERTY_LABELS } from "@/lib/rule-options"
import { SectionTitle } from "@/components/panels/obsazeni/shared"
import { useRules } from "./rules-context"

// Pravidla obsazení: pro každou postavu (specializace, původ, kruh, role) a tým
// (jednotka) které hodnoty smí dostat. Platí ve všech bězích. Jednotka a role
// jsou v jedné záložce: u týmu jeho jednotka, pod ním pevné role členů.
// Role jde jen napevno a s ní i jednotka a trojice týmu.

type Tab = "specialization" | "origin" | "circle" | "unit"
const TABS: { key: Tab; label: string; properties: RuleProperty[] }[] = [
  { key: "specialization", label: PROPERTY_LABELS.specialization, properties: ["specialization"] },
  { key: "origin", label: PROPERTY_LABELS.origin, properties: ["origin"] },
  { key: "circle", label: PROPERTY_LABELS.circle, properties: ["circle"] },
  { key: "unit", label: "Jednotka a role", properties: ["unit", "role"] },
]

const KIND_STYLE: Record<RuleKind, React.CSSProperties> = {
  any:    { color: "var(--c-text-faint)", borderColor: "var(--c-border)" },
  fixed:  { color: "var(--c-accent)", borderColor: "color-mix(in srgb, var(--c-accent) 55%, transparent)", fontWeight: 700 },
  except: { color: "var(--c-teal)", borderColor: "color-mix(in srgb, var(--c-teal) 55%, transparent)", fontWeight: 700 },
  some:   { color: "var(--c-teal)", borderColor: "color-mix(in srgb, var(--c-teal) 55%, transparent)", fontWeight: 700 },
}

type Subject = { id: string; name: string; sub?: string; teamId?: string; subjectType: RuleSubject; property: RuleProperty }

export function PravidlaPanel() {
  const { rules, index, roles, loaded, pending, saveRule } = useRules()
  const [tabKey, setTabKey] = useState<Tab>("specialization")
  const [onlyRules, setOnlyRules] = useState(false)
  const [query, setQuery] = useState("")

  const roleOptions = useMemo(() => roleRuleOptions(roles, getUnitName), [roles])
  const optionsOf = (p: RuleProperty) => (p === "role" ? roleOptions : ruleOptionsFor(p))

  const counts = useMemo(() => {
    const m: Record<string, number> = {}
    for (const r of rules) m[r.property] = (m[r.property] ?? 0) + 1
    return m
  }, [rules])

  // Postavy po týmech; u jednotky nejdřív řádek týmu, pod ním role členů.
  const groups = useMemo((): { teamId: string; subjects: Subject[] }[] => TEAMS.map(t => {
    const members = CHARACTERS.filter(c => c.teamId === t.id && (c.role === "student" || c.role === "ruze"))
    if (tabKey === "unit") {
      // Pevná role jde vybrat jen v týmu s jednotkou napevno. Postava s pevnou rolí
      // se ukáže vždy, ať jde pravidlo zrušit.
      const unitFixed = allowedValues(index, "team", t.id, "unit")?.length === 1
      return {
        teamId: t.id,
        subjects: [
          { id: t.id, name: "Jednotka týmu", teamId: t.id, subjectType: "team" as const, property: "unit" as const },
          ...members.filter(c => unitFixed || allowedValues(index, "character", c.id, "role") !== null)
            .map(c => ({ id: c.id, name: c.name, subjectType: "character" as const, property: "role" as const })),
        ],
      }
    }
    return { teamId: t.id, subjects: members.map(c => ({ id: c.id, name: c.name, subjectType: "character" as const, property: tabKey })) }
  }), [tabKey, index])

  const q = query.trim().toLowerCase()
  const visible = (s: Subject) => {
    const team = TEAMS.find(t => t.id === s.teamId)?.name ?? ""
    if (q && !`${s.name} ${s.sub ?? ""} ${team}`.toLowerCase().includes(q)) return false
    if (onlyRules && allowedValues(index, s.subjectType, s.id, s.property) === null) return false
    return true
  }

  const toggle = (s: Subject, value: string) => {
    const current = allowedValues(index, s.subjectType, s.id, s.property) ?? optionsOf(s.property).map(o => o.value)
    const next = current.includes(value) ? current.filter(v => v !== value) : [...current, value]
    if (next.length === 0) return
    saveRule(s.subjectType, s.id, s.property, next)
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
        {tabKey === "unit" && <> U týmu nastavíš jednotku. Když je <b>napevno</b>, objeví se pod ní členové a můžeš jim
          dát pevnou roli v té jednotce; tým pak smí jen do trojice té role. Role se zakládají v Texty → Role.</>}
      </p>

      <div role="tablist" aria-label="Vlastnost" style={{ display: "flex", gap: 4, borderBottom: "1px solid var(--c-border)", marginBottom: 16, overflowX: "auto" }}>
        {TABS.map(t => {
          const n = t.properties.reduce((sum, p) => sum + (counts[p] ?? 0), 0)
          return (
            <button key={t.key} role="tab" aria-selected={t.key === tabKey} style={tab(t.key === tabKey)} onClick={() => setTabKey(t.key)}>
              {t.label}
              {n ? <span style={{ marginLeft: 6, fontSize: "0.75rem", color: "var(--c-accent)" }}>{n}</span> : null}
            </button>
          )
        })}
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center", marginBottom: 14 }}>
        <label style={{ position: "relative", flex: "1 1 200px", maxWidth: 260 }}>
          <span className="sr-only">Hledat</span>
          <IconSearch size={14} color="var(--c-text-faint)" style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)" }} />
          <input value={query} onChange={e => setQuery(e.target.value)} placeholder={tabKey === "unit" ? "Hledat tým nebo postavu" : "Hledat postavu"}
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
            const team = TEAMS.find(t => t.id === g.teamId)
            return (
              <div key={g.teamId}>
                {team && (
                  <div className="char-group" style={{ borderLeftColor: team.color }}>
                    <TeamIcon teamId={team.id} size={14} /> <span style={{ fontWeight: 700 }}>{team.name}</span>
                  </div>
                )}
                {rows.map(s => {
                  const { subjectType, property } = s
                  const options = optionsOf(property)
                  const allowed = allowedValues(index, subjectType, s.id, property)
                  const desc = describeRule(allowed, options)
                  const busy = pending === `${subjectType}:${s.id}:${property}`
                  return (
                    <div key={`${subjectType}:${s.id}`} className="rule-row" style={{ opacity: busy ? 0.55 : 1 }}>
                      <span style={{ minWidth: 0, display: "flex", alignItems: "center", gap: 6 }}>
                        <span>
                          <span style={subjectType === "team"
                            ? { fontWeight: 600, color: "var(--c-text-muted)", fontSize: "0.85rem" }
                            : { fontWeight: 700, color: "var(--c-text)" }}>{s.name}</span>
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
  // Jen role pevné jednotky týmu (a případně dosavadní pevná role, ať jde vidět a zrušit).
  const units = teamId ? allowedValues(index, "team", teamId, "unit") : null
  const fixedUnit = units?.length === 1 ? units[0] : null
  const list = UNITS.filter(u => u.id === fixedUnit || roles.some(r => String(r.id) === value && r.unitId === u.id))
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
      {fixedUnit && !roles.some(r => r.unitId === fixedUnit) &&
        <span style={{ fontSize: "0.8rem", color: "var(--c-text-faint)" }}>Jednotka zatím nemá role (Texty → Role)</span>}
      {!fixedUnit && <span style={{ fontSize: "0.8rem", color: "var(--destructive)" }}>Tým nemá jednotku napevno</span>}
    </span>
  )
}
