import { requireAdmin } from "@/lib/admin-password"
import { findTemplate } from "@/lib/mail-templates"
import { listMails, saveMail, resetMail } from "@/lib/mail-store"

export const dynamic = "force-dynamic"

const MAX_SUBJECT = 200
const MAX_BODY = 20_000

// GET /api/priprava/mails — aktuální texty všech mailů
export async function GET(req: Request) {
  const denied = await requireAdmin(req)
  if (denied) return denied
  try {
    return Response.json(await listMails(), { headers: { "Cache-Control": "no-store" } })
  } catch (err) {
    console.error("[priprava/mails GET]", err)
    return new Response("Server error", { status: 500 })
  }
}

// PUT /api/priprava/mails — { id, subject, body } uloží, { id, reset: true } vrátí výchozí
export async function PUT(req: Request) {
  const denied = await requireAdmin(req)
  if (denied) return denied
  try {
    const b = (await req.json().catch(() => null)) as { id?: unknown; subject?: unknown; body?: unknown; reset?: unknown } | null
    if (typeof b?.id !== "string" || !findTemplate(b.id)) return new Response("Neznámý mail.", { status: 400 })
    if (b.reset === true) { await resetMail(b.id); return new Response(null, { status: 204 }) }
    if (typeof b.subject !== "string" || !b.subject.trim() || b.subject.length > MAX_SUBJECT)
      return new Response(`Předmět je povinný, nejvýš ${MAX_SUBJECT} znaků.`, { status: 400 })
    if (typeof b.body !== "string" || !b.body.trim() || b.body.length > MAX_BODY)
      return new Response(`Text je povinný, nejvýš ${MAX_BODY} znaků.`, { status: 400 })
    await saveMail(b.id, { subject: b.subject, body: b.body })
    return new Response(null, { status: 204 })
  } catch (err) {
    console.error("[priprava/mails PUT]", err)
    return new Response("Server error", { status: 500 })
  }
}
