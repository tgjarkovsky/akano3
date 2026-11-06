"use client"

import React, { useState } from "react"
import { IconPlus, IconTrash, IconArrowRight, IconDeviceFloppy } from "@tabler/icons-react"
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { roleKeyFrom } from "@/lib/doc-validation"
import { STATUS_LABELS, type DocStatus } from "@/lib/doc-status"
import type { UnitRole } from "@/lib/docs-store"
import type { Triplet } from "@/lib/types"
import { StatusDot, useTexty } from "./texty-data"

// Role jednotky ve dvou trojicích. Každá role má název v mužském a ženském
// tvaru a klíč pro šablony ({@klic}). Osobní text role se píše v kategorii Role.

export function RolesEditor({ unitId, onOpenRole, metaStatus }: {
  unitId: string
  onOpenRole: (id: number) => void
  metaStatus: (roleId: number) => DocStatus
}) {
  const { roles } = useTexty()
  const [confirmDelete, setConfirmDelete] = useState<UnitRole | null>(null)
  const { deleteRole } = useTexty()

  return (
    <section style={{ marginTop: 32, paddingTop: 20, borderTop: "1px solid var(--c-border-mid)" }}>
      <h3 style={{
        fontFamily: "var(--font-display)", textTransform: "uppercase", letterSpacing: "0.06em",
        fontSize: "1rem", color: "var(--c-accent)", margin: "0 0 4px",
      }}>Role v jednotce</h3>
      <p style={{ margin: "0 0 14px", fontSize: "0.85rem", color: "var(--c-text-muted)", lineHeight: 1.5 }}>
        Každá trojice má tři role. Tým, který trojici v běhu obsadí, si je rozdělí. Klíč se používá v šablonách jako <code>{"{@klic}"}</code>.
      </p>
      <div className="roles-grid">
        {(["A", "B"] as Triplet[]).map(t => {
          const list = roles.filter(r => r.unitId === unitId && r.triplet === t)
          return (
            <div key={t} className="roles-col">
              <p style={{ margin: "0 0 8px", fontWeight: 700, color: "var(--c-text)", display: "flex", justifyContent: "space-between" }}>
                Trojice {t}
                <span style={{ fontWeight: 400, fontSize: "0.8rem", color: list.length === 3 ? "var(--c-success)" : "var(--c-text-faint)" }}>
                  {list.length} ze 3
                </span>
              </p>
              {list.map(r => (
                <RoleRow key={r.id} role={r} status={metaStatus(r.id)} onOpen={() => onOpenRole(r.id)} onDelete={() => setConfirmDelete(r)} />
              ))}
              <NewRole unitId={unitId} triplet={t} />
            </div>
          )
        })}
      </div>

      <AlertDialog open={confirmDelete !== null} onOpenChange={o => { if (!o) setConfirmDelete(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Smazat roli {confirmDelete?.nameM}?</AlertDialogTitle>
            <AlertDialogDescription>Smaže se i její osobní text. Nejde to vrátit.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Zrušit</AlertDialogCancel>
            <AlertDialogAction onClick={() => { if (confirmDelete) deleteRole(confirmDelete.id); setConfirmDelete(null) }}>Smazat</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  )
}

function RoleRow({ role, status, onOpen, onDelete }: { role: UnitRole; status: DocStatus; onOpen: () => void; onDelete: () => void }) {
  const { saveRole } = useTexty()
  const [nameM, setNameM] = useState(role.nameM)
  const [nameF, setNameF] = useState(role.nameF)
  const [key, setKey] = useState(role.key)
  const [error, setError] = useState("")
  const [busy, setBusy] = useState(false)
  const changed = nameM !== role.nameM || nameF !== role.nameF || key !== role.key

  const submit = async () => {
    setBusy(true)
    const err = await saveRole({ id: role.id, unitId: role.unitId, triplet: role.triplet, key, nameM, nameF })
    setBusy(false)
    setError(err ?? "")
  }

  return (
    <div className="role-card">
      <div className="role-names">
        <label><span>muž</span><input value={nameM} onChange={e => setNameM(e.target.value)} className="role-input" /></label>
        <label><span>žena</span><input value={nameF} onChange={e => setNameF(e.target.value)} className="role-input" /></label>
        <label><span>klíč</span><input value={key} onChange={e => setKey(e.target.value)} className="role-input" style={{ fontFamily: "var(--font-mono)", fontSize: "0.8rem" }} /></label>
      </div>
      {error && <p role="alert" style={{ color: "var(--destructive)", fontSize: "0.8rem", margin: "6px 0 0" }}>{error}</p>}
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
        <button className="tool-btn" onClick={onOpen} title="Otevřít osobní text role">
          <StatusDot status={status} /> Osobní text: {STATUS_LABELS[status]} <IconArrowRight size={14} />
        </button>
        <span style={{ flex: 1 }} />
        {changed && <button className="tool-btn tool-btn-primary" disabled={busy} onClick={submit}><IconDeviceFloppy size={14} /> Uložit</button>}
        <button className="tool-btn" onClick={onDelete} aria-label={`Smazat roli ${role.nameM}`}><IconTrash size={14} /></button>
      </div>
    </div>
  )
}

function NewRole({ unitId, triplet }: { unitId: string; triplet: Triplet }) {
  const { saveRole } = useTexty()
  const [nameM, setNameM] = useState("")
  const [nameF, setNameF] = useState("")
  const [key, setKey] = useState("")
  const [keyTouched, setKeyTouched] = useState(false)
  const [error, setError] = useState("")
  const [busy, setBusy] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!nameM.trim() || !nameF.trim()) { setError("Vyplň oba tvary názvu."); return }
    setBusy(true)
    const err = await saveRole({ unitId, triplet, key: key || roleKeyFrom(nameM), nameM, nameF })
    setBusy(false)
    if (err) { setError(err); return }
    setNameM(""); setNameF(""); setKey(""); setKeyTouched(false); setError("")
  }

  return (
    <form onSubmit={submit} className="role-card role-new">
      <div className="role-names">
        <label><span>muž</span><input value={nameM} placeholder="kapitán" className="role-input"
          onChange={e => { setNameM(e.target.value); if (!keyTouched) setKey(roleKeyFrom(e.target.value)); setError("") }} /></label>
        <label><span>žena</span><input value={nameF} placeholder="kapitánka" className="role-input"
          onChange={e => { setNameF(e.target.value); setError("") }} /></label>
        <label><span>klíč</span><input value={key} placeholder="kapitan" className="role-input" style={{ fontFamily: "var(--font-mono)", fontSize: "0.8rem" }}
          onChange={e => { setKey(e.target.value); setKeyTouched(true); setError("") }} /></label>
      </div>
      {error && <p role="alert" style={{ color: "var(--destructive)", fontSize: "0.8rem", margin: "6px 0 0" }}>{error}</p>}
      <button type="submit" className="tool-btn" disabled={busy} style={{ marginTop: 8 }}>
        <IconPlus size={14} /> Přidat roli do trojice {triplet}
      </button>
    </form>
  )
}
