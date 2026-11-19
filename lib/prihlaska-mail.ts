// Potvrzení o odeslané přihlášce s odkazem na úpravy (Resend přes HTTP API).
// Bez RESEND_API_KEY se mail jen vypíše do logu (lokální vývoj).

const CONTACT = "akano3@rolling.cz"
const FROM = process.env.PRIHLASKA_MAIL_FROM || `Akano3 <${CONTACT}>`

export function confirmationMail(name: string, link: string, until: string): { subject: string; text: string } {
  return {
    subject: "Akano3: přihláška přijata",
    text: `Ahoj${name ? ` ${name}` : ""},

tvoji přihlášku na Akano3 jsme dostali.

Upravit ji můžeš tady, do ${until}:
${link}

Odkaz si schovej a nikomu ho neposílej. Kdo ho má, může přihlášku měnit. Když ho ztratíš, napiš na ${CONTACT}.

Akano3
`,
  }
}

/** Nikdy nevyhodí: přihláška je už uložená a odkaz vidí hráč i na stránce. */
export async function sendConfirmation(to: string, name: string, link: string, until: string): Promise<void> {
  const { subject, text } = confirmationMail(name, link, until)
  const key = process.env.RESEND_API_KEY
  if (!key) { console.log(`[prihlaska mail] (bez RESEND_API_KEY) komu: ${to}\n${subject}\n${text}`); return }
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: FROM, to, reply_to: CONTACT, subject, text }),
    })
    if (!res.ok) console.error("[prihlaska mail]", res.status, await res.text())
  } catch (err) {
    console.error("[prihlaska mail]", err)
  }
}
