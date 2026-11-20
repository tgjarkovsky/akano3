// Všechny maily, které aplikace posílá. Text se píše s proměnnými {{jmeno}}
// a jednoduchým formátováním (**tučně**, *kurzíva*, odstavce prázdným řádkem,
// řádek jen s odkazem = tlačítko). Z jednoho zdroje vzniká HTML i textová verze.
// Bez aliasů importů, ať jde testovat přímo přes node --test.

export const MAIL_CONTACT = "akano3@rolling.cz"

export type MailVar = { key: string; label: string; sample: string }
export type MailTemplate = {
  id: string
  label: string
  when: string
  vars: MailVar[]
  subject: string
  body: string
}
export type MailContent = { subject: string; body: string }

export const MAIL_TEMPLATES: MailTemplate[] = [
  {
    id: "prihlaska-potvrzeni",
    label: "Potvrzení přihlášky",
    when: "Hned po odeslání přihlášky z veřejného formuláře.",
    vars: [
      { key: "jmeno", label: "Přezdívka, jinak křestní jméno", sample: "Terka" },
      { key: "odkaz", label: "Tajný odkaz na úpravu přihlášky", sample: "https://akano3.cz/prihlaska/ukazkovy-odkaz-123456" },
      { key: "do", label: "Do kdy jde přihláška upravit", sample: "31. 1. 2027" },
      { key: "kontakt", label: "Kontaktní e-mail", sample: MAIL_CONTACT },
    ],
    subject: "Akano3: přihláška přijata",
    body: `Ahoj {{jmeno}},

tvoji přihlášku na Akano3 jsme dostali.

Upravit ji můžeš tady, do {{do}}:

{{odkaz}}

Odkaz si schovej a nikomu ho neposílej. Kdo ho má, může přihlášku měnit. Když ho ztratíš, napiš na {{kontakt}}.

Akano3`,
  },
  {
    id: "obsazeni-prijeti",
    label: "Oznámení o přijetí",
    when: "Ručně z Přípravy → Hráči, přijatým hráčům s postavou.",
    vars: [
      { key: "jmeno", label: "Přezdívka, jinak křestní jméno", sample: "Terka" },
      { key: "postava", label: "Jméno postavy", sample: "Aiko Takeda" },
      { key: "beh", label: "Běh a jeho termín", sample: "1. běh, 22.–25. července 2027" },
      { key: "odkaz", label: "Tajný odkaz přihlášky (postava, platba, fotka)", sample: "https://akano3.cz/prihlaska/ukazkovy-odkaz-123456" },
      { key: "kontakt", label: "Kontaktní e-mail", sample: MAIL_CONTACT },
    ],
    subject: "Akano3: jedeš! Tvoje postava je {{postava}}",
    body: `Ahoj {{jmeno}},

máme radost: na Akano3 jedeš, a to na **{{beh}}**. Tvoje postava je **{{postava}}**.

Na odkazu své přihlášky teď uvidíš svou postavu a stav platby a nahraješ tam svou fotku, ať tě spoluhráči poznají:

{{odkaz}}

Dotazy posílej na {{kontakt}}.

Akano3`,
  },
  {
    id: "upominka",
    label: "Upomínka",
    when: "Ručně z Přípravy → Hráči, přijatým hráčům, kterým něco chybí.",
    vars: [
      { key: "jmeno", label: "Přezdívka, jinak křestní jméno", sample: "Terka" },
      { key: "chybi", label: "Co chybí („zaplatit hru a nahrát fotku“)", sample: "zaplatit hru a nahrát fotku" },
      { key: "odkaz", label: "Tajný odkaz přihlášky", sample: "https://akano3.cz/prihlaska/ukazkovy-odkaz-123456" },
      { key: "kontakt", label: "Kontaktní e-mail", sample: MAIL_CONTACT },
    ],
    subject: "Akano3: ještě ti chybí {{chybi}}",
    body: `Ahoj {{jmeno}},

připomínáme, že před hrou ti ještě zbývá **{{chybi}}**.

Stav platby a nahrání fotky najdeš na odkazu své přihlášky:

{{odkaz}}

Jestli už je hotovo, nebo něco nejde, napiš na {{kontakt}}.

Akano3`,
  },
]

export const findTemplate = (id: string) => MAIL_TEMPLATES.find(t => t.id === id)

/** Dosadí proměnné. Neznámá proměnná zůstane vidět, ať si jí autor všimne. */
export function fillVars(source: string, vars: Record<string, string>): string {
  return source.replace(/\{\{\s*([a-z0-9_]+)\s*\}\}/gi, (whole, key: string) => vars[key] ?? whole)
}

const escapeHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;")

const URL_RE = /https?:\/\/[^\s<>"]+[^\s<>".,;:!?)]/g
const isLoneUrl = (line: string) => /^https?:\/\/\S+$/.test(line.trim())

function inlineHtml(line: string): string {
  return escapeHtml(line)
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(URL_RE, url => `<a href="${url}" style="color:#8a1c1c">${url}</a>`)
}

function button(url: string): string {
  const href = escapeHtml(url.trim())
  return `<p style="margin:0 0 16px"><a href="${href}" style="display:inline-block;padding:12px 22px;background:#8a1c1c;color:#ffffff;text-decoration:none;border-radius:6px;font-weight:600">Otevřít odkaz</a></p>`
    + `<p style="margin:0 0 16px;font-size:13px;color:#6b6b6b;word-break:break-all">${href}</p>`
}

function bodyHtml(text: string): string {
  return text.trim().split(/\n\s*\n/).map(block =>
    isLoneUrl(block) ? button(block)
      : `<p style="margin:0 0 16px">${block.split("\n").map(inlineHtml).join("<br>")}</p>`,
  ).join("\n")
}

/** Celé HTML mailu s jednoduchým rámem (inline styly kvůli poštovním klientům). */
export function mailHtml(subject: string, text: string): string {
  return `<!doctype html>
<html lang="cs"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(subject)}</title></head>
<body style="margin:0;padding:0;background:#f2efe9">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f2efe9"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:10px">
<tr><td style="padding:20px 28px;border-bottom:3px solid #8a1c1c;font:700 18px/1.2 Georgia,serif;letter-spacing:.08em;text-transform:uppercase;color:#1f1f1f">Akano3</td></tr>
<tr><td style="padding:24px 28px 8px;font:16px/1.55 Arial,Helvetica,sans-serif;color:#1f1f1f">
${bodyHtml(text)}
</td></tr>
<tr><td style="padding:16px 28px 22px;border-top:1px solid #e6e1d8;font:13px/1.5 Arial,Helvetica,sans-serif;color:#6b6b6b">Dotazy: <a href="mailto:${MAIL_CONTACT}" style="color:#6b6b6b">${MAIL_CONTACT}</a></td></tr>
</table></td></tr></table>
</body></html>`
}

/** Textová verze: bez formátovacích hvězdiček. */
export function mailText(text: string): string {
  return text.trim().replace(/\*\*(.+?)\*\*/g, "$1").replace(/\*(.+?)\*/g, "$1") + "\n"
}

export function renderMail(content: MailContent, vars: Record<string, string>): { subject: string; html: string; text: string } {
  const subject = fillVars(content.subject, vars).replace(/\s+/g, " ").trim()
  const body = fillVars(content.body, vars)
  return { subject, html: mailHtml(subject, body), text: mailText(body) }
}

export const sampleVars = (t: MailTemplate) => Object.fromEntries(t.vars.map(v => [v.key, v.sample]))
