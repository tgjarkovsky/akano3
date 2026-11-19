// Potvrzení o odeslané přihlášce s odkazem na úpravy (Resend přes HTTP API).
// Text se upravuje v Přípravě → E-maily. Bez RESEND_API_KEY se mail jen vypíše do logu.

import { MAIL_CONTACT, renderMail } from "@/lib/mail-templates"
import { getMail } from "@/lib/mail-store"

const FROM = process.env.PRIHLASKA_MAIL_FROM || `Akano3 <${MAIL_CONTACT}>`

/** Nikdy nevyhodí: přihláška je už uložená a odkaz vidí hráč i na stránce. */
export async function sendConfirmation(to: string, name: string, link: string, until: string): Promise<void> {
  try {
    const { subject, html, text } = renderMail(await getMail("prihlaska-potvrzeni"), { jmeno: name, odkaz: link, do: until, kontakt: MAIL_CONTACT })
    const key = process.env.RESEND_API_KEY
    if (!key) { console.log(`[prihlaska mail] (bez RESEND_API_KEY) komu: ${to}\n${subject}\n${text}`); return }
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: FROM, to, reply_to: MAIL_CONTACT, subject, html, text }),
    })
    if (!res.ok) console.error("[prihlaska mail]", res.status, await res.text())
  } catch (err) {
    console.error("[prihlaska mail]", err)
  }
}
