"use client"

import React from "react"
import { IconArrowRight, IconCheck, IconEdit, IconPlus, IconTrash, IconX } from "@tabler/icons-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { useAdminCrud } from "@/components/panels/use-admin-crud"
import { WikiArticle, WikiLinkAdmin } from "@/lib/types"
import { romanNumeral } from "@/lib/utils"

const KAICHI_OPTIONS = [0,1,2,3,4,5,6,7,8]

const inputStyle: React.CSSProperties = {
  backgroundColor: "var(--c-bg-card)", border: "1px solid var(--c-border)",
  color: "var(--c-text)", borderRadius: 6, padding: "8px 12px",
  fontSize: "0.875rem", width: "100%",
}

const labelStyle: React.CSSProperties = {
  fontSize: "0.72rem", letterSpacing: "0.08em", color: "var(--c-text-muted)",
  marginBottom: 4, display: "block",
}

type LinkForm = { fromSlug: string; toSlug: string; label: string; kaichiRequired: number }
const EMPTY_FORM: LinkForm = { fromSlug: "", toSlug: "", label: "", kaichiRequired: 0 }

export function WikiLinksAdmin({ articles }: { articles: WikiArticle[] }) {
  const {
    items: links, loading, editing, creating, form, setForm,
    deleteTarget, setDeleteTarget, saving, error,
    startCreate, startEdit, cancelForm, saveForm, confirmDelete,
  } = useAdminCrud<WikiLinkAdmin, LinkForm>({
    listUrl: "/api/wiki/links",
    collectionUrl: "/api/wiki/links",
    itemUrl: id => `/api/wiki/links/${id}`,
    emptyForm: EMPTY_FORM,
    toForm: l => ({ fromSlug: l.fromSlug, toSlug: l.toSlug, label: l.label, kaichiRequired: l.kaichiRequired }),
    validate: f => {
      if (!f.fromSlug || !f.toSlug || !f.label.trim()) return "Oba články a popisek jsou povinné."
      if (f.fromSlug === f.toSlug) return "Vazba článku na sebe sama nedává smysl."
      return null
    },
  })

  const titleOf = (slug: string) => articles.find(a => a.slug === slug)?.title ?? slug

  const articleOptions = [...articles].sort((a, b) => a.title.localeCompare(b.title, "cs"))

  return (
    <div style={{ marginTop: 32 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <p style={{ color: "var(--c-accent)", fontSize: "0.8rem", letterSpacing: "0.08em" }}>
          VAZBY MEZI ČLÁNKY: {links.length}
        </p>
        {!creating && !editing && (
          <Button onClick={startCreate} style={{
            backgroundColor: "var(--c-teal)", color: "#F4ECDF", fontSize: "0.875rem",
            display: "flex", alignItems: "center", gap: 6,
          }}>
            <IconPlus size={15} /> Nová vazba
          </Button>
        )}
      </div>

      {/* Create / Edit form */}
      {(creating || editing) && (
        <div style={{
          backgroundColor: "var(--c-bg-section)", border: "1px solid var(--c-border)",
          borderRadius: 10, padding: 20, marginBottom: 24,
        }}>
          <p style={{ color: "var(--c-text)", fontWeight: 700, marginBottom: 16 }}>
            {editing ? "Editace vazby" : "Nová vazba"}
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
            <div>
              <label style={labelStyle}>Z ČLÁNKU *</label>
              <select value={form.fromSlug}
                onChange={e => setForm(f => ({ ...f, fromSlug: e.target.value }))}
                style={{ ...inputStyle, height: 40 }}>
                <option value="">— vyber —</option>
                {articleOptions.map(a => <option key={a.slug} value={a.slug}>{a.title}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>DO ČLÁNKU *</label>
              <select value={form.toSlug}
                onChange={e => setForm(f => ({ ...f, toSlug: e.target.value }))}
                style={{ ...inputStyle, height: 40 }}>
                <option value="">— vyber —</option>
                {articleOptions.map(a => <option key={a.slug} value={a.slug}>{a.title}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>POPISEK * (krátké sloveso, např. „zakázal“)</label>
              <Input value={form.label} onChange={e => setForm(f => ({ ...f, label: e.target.value }))}
                placeholder="vede k" style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>VYŽADUJE KAICHI</label>
              <select
                value={form.kaichiRequired}
                onChange={e => setForm(f => ({ ...f, kaichiRequired: Number(e.target.value) }))}
                style={{ ...inputStyle, height: 40 }}
              >
                {KAICHI_OPTIONS.map(k => (
                  <option key={k} value={k}>
                    {k === 0 ? "0 (všichni)" : `${k} (${romanNumeral(k)})`}
                  </option>
                ))}
              </select>
            </div>
          </div>
          {error && (
            <p style={{ color: "var(--destructive)", fontSize: "0.85rem", marginBottom: 12 }}>{error}</p>
          )}
          <div style={{ display: "flex", gap: 10 }}>
            <Button onClick={saveForm} disabled={saving} style={{
              backgroundColor: "var(--c-teal)", color: "#F4ECDF",
              display: "flex", alignItems: "center", gap: 6,
            }}>
              <IconCheck size={15} /> {saving ? "Ukládám…" : "Uložit"}
            </Button>
            <Button onClick={cancelForm} style={{
              backgroundColor: "transparent", border: "1px solid var(--c-border)",
              color: "var(--c-text-muted)", display: "flex", alignItems: "center", gap: 6,
            }}>
              <IconX size={15} /> Zrušit
            </Button>
          </div>
        </div>
      )}

      {/* Links list */}
      {loading ? (
        <p style={{ color: "var(--c-text-muted)", textAlign: "center", padding: "20px 0" }}>Načítám…</p>
      ) : links.length === 0 ? (
        <p style={{ color: "var(--c-text-muted)", textAlign: "center", padding: "20px 0", fontSize: "0.9rem" }}>
          Žádné vazby. Vytvoř první.
        </p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {links.map(l => (
            <div key={l.id} style={{
              backgroundColor: "var(--c-bg-card)", border: "1px solid var(--c-border)",
              borderRadius: 8, padding: "10px 16px",
              display: "flex", alignItems: "center", gap: 10,
            }}>
              {l.kaichiRequired > 0 && (
                <span style={{
                  width: 24, height: 24, borderRadius: "50%",
                  border: "1.5px solid #d4a017", backgroundColor: "#1a0a00",
                  display: "inline-flex", alignItems: "center", justifyContent: "center",
                  fontSize: "0.6rem", color: "#d4a017", fontFamily: "monospace", fontWeight: 700,
                  flexShrink: 0,
                }}>
                  {romanNumeral(l.kaichiRequired)}
                </span>
              )}
              <div style={{ flex: 1, minWidth: 0, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <span style={{ fontWeight: 700, color: "var(--c-text)", fontSize: "0.9rem" }}>{titleOf(l.fromSlug)}</span>
                <span style={{
                  color: "var(--c-text-muted)", fontSize: "0.78rem", fontStyle: "italic",
                  display: "inline-flex", alignItems: "center", gap: 4,
                }}>
                  {l.label} <IconArrowRight size={13} />
                </span>
                <span style={{ fontWeight: 700, color: "var(--c-text)", fontSize: "0.9rem" }}>{titleOf(l.toSlug)}</span>
              </div>
              <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                <button onClick={() => startEdit(l)} style={{
                  all: "unset", cursor: "pointer", padding: "6px 10px", borderRadius: 6,
                  backgroundColor: "rgba(16,128,128,0.12)", color: "var(--c-teal)",
                  display: "flex", alignItems: "center",
                }}>
                  <IconEdit size={15} />
                </button>
                <button onClick={() => setDeleteTarget(l)} style={{
                  all: "unset", cursor: "pointer", padding: "6px 10px", borderRadius: 6,
                  backgroundColor: "color-mix(in srgb, var(--destructive) 10%, transparent)", color: "var(--destructive)",
                  display: "flex", alignItems: "center",
                }}>
                  <IconTrash size={15} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <AlertDialog open={!!deleteTarget} onOpenChange={open => { if (!open) setDeleteTarget(null) }}>
        <AlertDialogContent style={{ backgroundColor: "var(--c-bg)", border: "1px solid var(--c-border)" }}>
          <AlertDialogHeader>
            <AlertDialogTitle style={{ color: "var(--c-text)" }}>Smazat vazbu?</AlertDialogTitle>
            <AlertDialogDescription style={{ color: "var(--c-text-muted)" }}>
              Vazba <strong style={{ color: "var(--c-text)" }}>
                {deleteTarget && `${titleOf(deleteTarget.fromSlug)} → ${titleOf(deleteTarget.toSlug)}`}
              </strong> bude trvale smazána.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel style={{ borderColor: "var(--c-border)", color: "var(--c-text-muted)" }}>Zpět</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} style={{ backgroundColor: "var(--destructive)", color: "#F4ECDF" }}>
              Smazat
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
