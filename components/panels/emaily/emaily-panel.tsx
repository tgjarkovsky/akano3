"use client"

import React, { useEffect, useMemo, useRef, useState } from "react"
import { IconDeviceFloppy, IconRestore } from "@tabler/icons-react"
import { adminFetch } from "@/lib/admin-client"
import { useGame } from "@/lib/game-context"
import { Input } from "@/components/ui/input"
import { MAIL_TEMPLATES, renderMail, sampleVars, type MailTemplate } from "@/lib/mail-templates"
import type { StoredMail } from "@/lib/mail-store"

// Texty mailů, které aplikace posílá, a náhled s ukázkovými daty.

export function EmailyPanel() {
  const { addToast } = useGame()
  const [mails, setMails] = useState<StoredMail[] | null>(null)
  const [error, setError] = useState("")
  const [selected, setSelected] = useState(MAIL_TEMPLATES[0].id)

  const load = () => adminFetch("/api/priprava/mails")
    .then(async r => r.ok ? r.json() : Promise.reject(new Error(await r.text())))
    .then(setMails)
    .catch(e => setError(e?.message || "Maily se nenačetly."))
  useEffect(() => { load() }, [])

  const template = MAIL_TEMPLATES.find(t => t.id === selected)!
  const stored = mails?.find(m => m.id === selected)

  const save = async (body: object, done: string) => {
    const r = await adminFetch("/api/priprava/mails", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: selected, ...body }) })
    if (!r.ok) { addToast(await r.text() || "Uložení selhalo", "error"); return }
    addToast(done, "success")
    await load()
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, maxWidth: 1200 }}>
      <p style={{ margin: 0, color: "var(--c-text-muted)", fontSize: "0.92rem", lineHeight: 1.55, maxWidth: 760 }}>
        Maily, které aplikace posílá hráčům. Proměnné ve složených závorkách se při odeslání nahradí skutečnými hodnotami.
        Formátování: **tučně**, *kurzíva*, prázdný řádek dělí odstavce, odkaz na samostatném řádku se v mailu ukáže jako tlačítko.
      </p>
      {MAIL_TEMPLATES.length > 1 && (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {MAIL_TEMPLATES.map(t => (
            <button key={t.id} className={`tool-btn${t.id === selected ? " tool-btn-primary" : ""}`} onClick={() => setSelected(t.id)}>{t.label}</button>
          ))}
        </div>
      )}
      {error && <p role="alert" className="conflict" style={{ margin: 0 }}>{error}</p>}
      {stored && <MailEditor key={`${stored.id}:${stored.updatedAt}`} template={template} stored={stored} onSave={save} />}
    </div>
  )
}

function MailEditor({ template, stored, onSave }: {
  template: MailTemplate
  stored: StoredMail
  onSave: (body: object, done: string) => Promise<void>
}) {
  const [subject, setSubject] = useState(stored.subject)
  const [body, setBody] = useState(stored.body)
  const [view, setView] = useState<"html" | "text">("html")
  const [busy, setBusy] = useState(false)
  const bodyRef = useRef<HTMLTextAreaElement>(null)

  const preview = useMemo(() => renderMail({ subject, body }, sampleVars(template)), [subject, body, template])
  const dirty = subject !== stored.subject || body !== stored.body
  const isDefault = stored.updatedAt === null && !dirty

  const insertVar = (key: string) => {
    const el = bodyRef.current
    const token = `{{${key}}}`
    if (!el) { setBody(b => b + token); return }
    const { selectionStart: s, selectionEnd: e } = el
    setBody(body.slice(0, s) + token + body.slice(e))
    requestAnimationFrame(() => { el.focus(); el.setSelectionRange(s + token.length, s + token.length) })
  }

  const run = async (body: object, done: string) => { setBusy(true); try { await onSave(body, done) } finally { setBusy(false) } }
  const reset = () => {
    if (confirm("Vrátit výchozí text? Vaše úpravy se smažou.")) run({ reset: true }, "Vrácen výchozí text")
  }

  return (
    <div className="emaily-grid">
      <section style={{ display: "flex", flexDirection: "column", gap: 12, minWidth: 0 }}>
        <div>
          <h2 style={{ margin: "0 0 4px", fontSize: "1.05rem", color: "var(--c-text)" }}>{template.label}</h2>
          <p style={{ margin: 0, fontSize: "0.82rem", color: "var(--c-text-muted)" }}>
            {template.when} {stored.updatedAt ? `Upraveno ${new Date(stored.updatedAt).toLocaleString("cs-CZ")}.` : "Výchozí text."}
          </p>
        </div>
        <label style={fieldLabel}>
          Předmět
          <Input value={subject} onChange={e => setSubject(e.target.value)} maxLength={200} />
        </label>
        <label style={fieldLabel}>
          Text
          <textarea ref={bodyRef} value={body} onChange={e => setBody(e.target.value)} rows={16} className="doc-textarea" style={{ minHeight: 320, fontSize: "0.95rem", lineHeight: 1.6 }} />
        </label>
        <div>
          <p style={{ ...fieldLabel, margin: "0 0 6px" }}>Proměnné (kliknutím vložíte na místo kurzoru)</p>
          <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 4 }}>
            {template.vars.map(v => (
              <li key={v.key} style={{ display: "flex", gap: 8, alignItems: "baseline", fontSize: "0.82rem", color: "var(--c-text-muted)" }}>
                <button className="tool-btn" style={{ fontFamily: "monospace", minHeight: 30, padding: "0 8px" }} onClick={() => insertVar(v.key)}>{`{{${v.key}}}`}</button>
                {v.label}
              </li>
            ))}
          </ul>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button className="tool-btn tool-btn-primary" disabled={!dirty || busy || !subject.trim() || !body.trim()} onClick={() => run({ subject, body }, "Mail uložen")}>
            <IconDeviceFloppy size={15} /> Uložit
          </button>
          <button className="tool-btn" disabled={!dirty || busy} onClick={() => { setSubject(stored.subject); setBody(stored.body) }}>Zahodit změny</button>
          <button className="tool-btn" disabled={isDefault || busy} onClick={reset}><IconRestore size={15} /> Vrátit výchozí</button>
        </div>
      </section>

      <section style={{ display: "flex", flexDirection: "column", gap: 8, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
          <span style={fieldLabel}>Náhled s ukázkovými daty</span>
          <div role="tablist" style={{ display: "flex", gap: 4 }}>
            {(["html", "text"] as const).map(v => (
              <button key={v} role="tab" aria-selected={view === v} className={`tool-btn${view === v ? " tool-btn-primary" : ""}`} style={{ minHeight: 30 }} onClick={() => setView(v)}>
                {v === "html" ? "HTML" : "Prostý text"}
              </button>
            ))}
          </div>
        </div>
        <p style={{ margin: 0, fontSize: "0.85rem", color: "var(--c-text)" }}><strong>Předmět:</strong> {preview.subject}</p>
        {view === "html"
          ? <iframe title="Náhled mailu" sandbox="" srcDoc={preview.html} className="emaily-preview" />
          : <pre className="emaily-preview emaily-preview-text">{preview.text}</pre>}
      </section>
    </div>
  )
}

const fieldLabel: React.CSSProperties = {
  display: "flex", flexDirection: "column", gap: 6, fontSize: "0.8rem", fontWeight: 600, color: "var(--c-text-muted)",
}
