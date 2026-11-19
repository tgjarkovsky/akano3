import { sql } from "@/lib/db"
import { MAIL_TEMPLATES, findTemplate, type MailContent } from "@/lib/mail-templates"

// Upravené texty mailů z Přípravy. Bez řádku platí výchozí text z lib/mail-templates.ts.

let ready: Promise<unknown> | null = null

function ensureMailTable() {
  ready ??= sql`
    CREATE TABLE IF NOT EXISTS mail_templates (
      id         TEXT PRIMARY KEY,
      subject    TEXT NOT NULL,
      body       TEXT NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `.catch(err => { ready = null; throw err })
  return ready
}

export type StoredMail = MailContent & { id: string; updatedAt: string | null }

export async function listMails(): Promise<StoredMail[]> {
  await ensureMailTable()
  const rows = await sql`SELECT id, subject, body, updated_at FROM mail_templates`
  const saved = new Map(rows.map(r => [r.id as string, r]))
  return MAIL_TEMPLATES.map(t => {
    const r = saved.get(t.id)
    return r
      ? { id: t.id, subject: r.subject as string, body: r.body as string, updatedAt: new Date(r.updated_at as string).toISOString() }
      : { id: t.id, subject: t.subject, body: t.body, updatedAt: null }
  })
}

/** Text k odeslání. Když databáze neodpoví, pošle se výchozí text. */
export async function getMail(id: string): Promise<MailContent> {
  const t = findTemplate(id)
  if (!t) throw new Error(`Neznámý mail ${id}`)
  try {
    await ensureMailTable()
    const [r] = await sql`SELECT subject, body FROM mail_templates WHERE id = ${id}`
    if (r) return { subject: r.subject as string, body: r.body as string }
  } catch (err) {
    console.error("[mail-store]", err)
  }
  return { subject: t.subject, body: t.body }
}

export async function saveMail(id: string, content: MailContent): Promise<void> {
  await ensureMailTable()
  await sql`
    INSERT INTO mail_templates (id, subject, body) VALUES (${id}, ${content.subject}, ${content.body})
    ON CONFLICT (id) DO UPDATE SET subject = EXCLUDED.subject, body = EXCLUDED.body, updated_at = NOW()
  `
}

export async function resetMail(id: string): Promise<void> {
  await ensureMailTable()
  await sql`DELETE FROM mail_templates WHERE id = ${id}`
}
