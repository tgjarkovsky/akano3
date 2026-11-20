// Maily aplikace přes Resend (HTTP API). Texty se upravují v Přípravě → E-maily.
// Bez RESEND_API_KEY se mail jen vypíše do logu.

import { MAIL_CONTACT, renderMail } from "@/lib/mail-templates"
import { getMail } from "@/lib/mail-store"

const FROM = process.env.PRIHLASKA_MAIL_FROM || `Akano3 <${MAIL_CONTACT}>`

/** Pošle mail podle šablony. Vrací true, když ho Resend přijal (nebo se bez klíče vypsal). */
export async function sendMail(templateId: string, to: string, vars: Record<string, string>): Promise<boolean> {
  const { subject, html, text } = renderMail(await getMail(templateId), { kontakt: MAIL_CONTACT, ...vars })
  const key = process.env.RESEND_API_KEY
  if (!key) { console.log(`[mail ${templateId}] (bez RESEND_API_KEY) komu: ${to}\n${subject}\n${text}`); return true }
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: FROM, to, reply_to: MAIL_CONTACT, subject, html, text }),
  })
  if (!res.ok) console.error(`[mail ${templateId}]`, res.status, await res.text())
  return res.ok
}

/** Potvrzení přihlášky. Nikdy nevyhodí: přihláška je už uložená a odkaz vidí hráč i na stránce. */
export async function sendConfirmation(to: string, name: string, link: string, until: string): Promise<void> {
  try {
    await sendMail("prihlaska-potvrzeni", to, { jmeno: name, odkaz: link, do: until })
  } catch (err) {
    console.error("[prihlaska mail]", err)
  }
}
