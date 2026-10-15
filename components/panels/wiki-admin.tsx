"use client"

import React from "react"
import { IconPlus, IconEdit, IconTrash, IconX, IconCheck, IconBook } from "@tabler/icons-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { useAdminCrud } from "@/components/panels/use-admin-crud"
import { WikiLinksAdmin } from "@/components/panels/wiki-links-admin"
import { WikiArticle } from "@/lib/types"
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

type ArticleForm = {
  slug: string; title: string; content: string
  category: string; kaichiRequired: number; sortOrder: number
}

const EMPTY_FORM: ArticleForm = {
  slug: "", title: "", content: "", category: "", kaichiRequired: 0, sortOrder: 0,
}

function slugify(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")
}

export function WikiAdminPanel() {
  const {
    items: articles, loading, editing, creating, form, setForm,
    deleteTarget, setDeleteTarget, saving, error,
    startCreate, startEdit, cancelForm, saveForm, confirmDelete,
  } = useAdminCrud<WikiArticle, ArticleForm>({
    listUrl: "/api/wiki?admin=1",
    collectionUrl: "/api/wiki",
    itemUrl: id => `/api/wiki/${id}`,
    emptyForm: EMPTY_FORM,
    toForm: a => ({
      slug: a.slug, title: a.title, content: a.content,
      category: a.category, kaichiRequired: a.kaichiRequired, sortOrder: a.sortOrder,
    }),
    validate: f => (!f.title.trim() || !f.category.trim() || !f.slug.trim())
      ? "Název, kategorie a slug jsou povinné." : null,
  })

  function handleTitleChange(title: string) {
    setForm(f => ({
      ...f, title,
      slug: f.slug || slugify(title),
    }))
  }

  const categories = [...new Set(articles.map(a => a.category))]

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <p style={{ color: "var(--c-accent)", fontSize: "0.8rem", letterSpacing: "0.08em" }}>
          WIKI ČLÁNKŮ: {articles.length}
        </p>
        {!creating && !editing && (
          <Button onClick={startCreate} style={{
            backgroundColor: "var(--c-teal)", color: "#F4ECDF", fontSize: "0.875rem",
            display: "flex", alignItems: "center", gap: 6,
          }}>
            <IconPlus size={15} /> Nový článek
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
            {editing ? `Editace: ${editing.title}` : "Nový článek"}
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
            <div>
              <label style={labelStyle}>NÁZEV *</label>
              <Input value={form.title} onChange={e => handleTitleChange(e.target.value)}
                placeholder="Název článku" style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>SLUG *</label>
              <Input value={form.slug} onChange={e => setForm(f => ({ ...f, slug: e.target.value }))}
                placeholder="url-slug" style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>KATEGORIE *</label>
              <Input value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                placeholder="Frakce, Místa, Historie…" style={inputStyle} />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
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
              <div>
                <label style={labelStyle}>POŘADÍ</label>
                <Input type="number" value={form.sortOrder}
                  onChange={e => setForm(f => ({ ...f, sortOrder: Number(e.target.value) }))}
                  style={inputStyle} />
              </div>
            </div>
          </div>
          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>OBSAH</label>
            <div style={{
              backgroundColor: "rgba(212,160,23,0.06)", border: "1px solid rgba(212,160,23,0.2)",
              borderRadius: 6, padding: "8px 12px", marginBottom: 8, fontSize: "0.75rem",
              color: "var(--c-text-muted)", lineHeight: 1.7, fontFamily: "monospace",
            }}>
              <span style={{ color: "#d4a017", fontWeight: 700 }}>Syntax utajení:</span>
              {"  "}:::k2{"\n"}
              {"  "}Tento blok vidí jen Kaichi II+{"\n"}
              {"  "}:::
            </div>
            <textarea
              value={form.content}
              onChange={e => setForm(f => ({ ...f, content: e.target.value }))}
              rows={10}
              placeholder="Text článku…"
              style={{
                ...inputStyle, resize: "vertical", lineHeight: 1.6,
                fontFamily: "monospace", whiteSpace: "pre-wrap",
              }}
            />
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

      {/* Articles list grouped by category */}
      {loading ? (
        <p style={{ color: "var(--c-text-muted)", textAlign: "center", padding: "40px 0" }}>Načítám…</p>
      ) : articles.length === 0 ? (
        <div style={{
          textAlign: "center", padding: "60px 0",
          color: "var(--c-text-muted)", display: "flex", flexDirection: "column", alignItems: "center", gap: 12,
        }}>
          <IconBook size={40} strokeWidth={1.2} />
          <p style={{ fontSize: "0.9rem" }}>Žádné wiki články. Vytvoř první.</p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          {categories.map(cat => (
            <div key={cat}>
              <p style={{
                fontSize: "0.72rem", letterSpacing: "0.1em", fontWeight: 700,
                color: "var(--c-accent)", marginBottom: 10,
              }}>
                {cat.toUpperCase()}
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {articles.filter(a => a.category === cat).map(a => (
                  <div key={a.id} style={{
                    backgroundColor: "var(--c-bg-card)", border: "1px solid var(--c-border)",
                    borderRadius: 8, padding: "12px 16px",
                    display: "flex", alignItems: "center", gap: 12,
                  }}>
                    {a.kaichiRequired > 0 && (
                      <span style={{
                        width: 24, height: 24, borderRadius: "50%",
                        border: "1.5px solid #d4a017", backgroundColor: "#1a0a00",
                        display: "inline-flex", alignItems: "center", justifyContent: "center",
                        fontSize: "0.6rem", color: "#d4a017", fontFamily: "monospace", fontWeight: 700,
                        flexShrink: 0,
                      }}>
                        {romanNumeral(a.kaichiRequired)}
                      </span>
                    )}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontWeight: 700, color: "var(--c-text)", fontSize: "0.95rem", margin: 0 }}>
                        {a.title}
                      </p>
                      <p style={{ color: "var(--c-text-muted)", fontSize: "0.72rem", margin: "2px 0 0", fontFamily: "monospace" }}>
                        /{a.slug}
                      </p>
                    </div>
                    <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                      <button onClick={() => startEdit(a)} style={{
                        all: "unset", cursor: "pointer", padding: "6px 10px", borderRadius: 6,
                        backgroundColor: "rgba(16,128,128,0.12)", color: "var(--c-teal)",
                        display: "flex", alignItems: "center",
                      }}>
                        <IconEdit size={15} />
                      </button>
                      <button onClick={() => setDeleteTarget(a)} style={{
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
            </div>
          ))}
        </div>
      )}

      {!loading && <WikiLinksAdmin articles={articles} />}

      <AlertDialog open={!!deleteTarget} onOpenChange={open => { if (!open) setDeleteTarget(null) }}>
        <AlertDialogContent style={{ backgroundColor: "var(--c-bg)", border: "1px solid var(--c-border)" }}>
          <AlertDialogHeader>
            <AlertDialogTitle style={{ color: "var(--c-text)" }}>Smazat článek?</AlertDialogTitle>
            <AlertDialogDescription style={{ color: "var(--c-text-muted)" }}>
              Článek <strong style={{ color: "var(--c-text)" }}>{deleteTarget?.title}</strong> bude trvale smazán.
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
