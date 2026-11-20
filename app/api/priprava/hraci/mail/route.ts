import { requireAdmin } from "@/lib/admin-password"
import { getMailTargets, getRunInfo, logMail } from "@/lib/cast-store"
import { greetingName, missingText, getsRejection, substituteText } from "@/lib/cast"
import { sendMail } from "@/lib/prihlaska-mail"
import { formatRunDate } from "@/lib/character-doc"
import { CHARACTERS } from "@/lib/data"

export const dynamic = "force-dynamic"

const TEMPLATES = ["obsazeni-prijeti", "upominka", "neprijeti"]
const MAX = 200

// POST /api/priprava/hraci/mail { templateId, prihlaskaIds[], by? }
// Oznámení o přijetí jde jen přijatým s postavou, upomínka jen přijatým, kterým něco chybí,
// nepřijetí jen náhradníkům a odmítnutým (bez oslovení jménem).
export async function POST(req: Request) {
  const denied = await requireAdmin(req)
  if (denied) return denied
  try {
    const b = await req.json().catch(() => null) as { templateId?: unknown; prihlaskaIds?: unknown; by?: unknown } | null
    if (typeof b?.templateId !== "string" || !TEMPLATES.includes(b.templateId)) return new Response("Neznámý mail", { status: 400 })
    const ids = Array.isArray(b.prihlaskaIds) ? b.prihlaskaIds.filter((x): x is number => Number.isInteger(x)) : []
    if (ids.length === 0 || ids.length > MAX) return new Response("Vyber hráče", { status: 400 })
    const by = typeof b.by === "string" ? b.by.slice(0, 80) : null
    const origin = new URL(req.url).origin
    const runs = new Map<number, Awaited<ReturnType<typeof getRunInfo>>>()

    let sent = 0, skipped = 0, failed = 0
    for (const t of await getMailTargets(ids)) {
      const runId = t.runId
      const vars: Record<string, string> = { jmeno: greetingName(t.data), odkaz: `${origin}/prihlaska/${t.token}` }
      if (b.templateId === "neprijeti") {
        if (!getsRejection(t.status)) { skipped++; continue }
        vars.nahradnik = substituteText(t.data.substitute)
      } else if (runId === null || t.status !== "accepted") { skipped++; continue }
      else if (b.templateId === "obsazeni-prijeti") {
        if (!t.characterId) { skipped++; continue }
        if (!runs.has(runId)) runs.set(runId, await getRunInfo(runId))
        const run = runs.get(runId)
        const date = run && formatRunDate(run.startsOn, run.endsOn)
        vars.postava = CHARACTERS.find(c => c.id === t.characterId)?.name ?? t.characterId
        vars.beh = [run?.name, date].filter(Boolean).join(", ")
      } else {
        const chybi = missingText({ paid: !!t.paidAt, photo: t.hasPhoto })
        if (!chybi) { skipped++; continue }
        vars.chybi = chybi
      }
      try {
        if (await sendMail(b.templateId, t.data.email, vars)) { sent++; await logMail(t.id, b.templateId, runId, by) }
        else failed++
      } catch (err) {
        console.error("[hraci mail]", err)
        failed++
      }
    }
    skipped += ids.length - sent - skipped - failed
    return Response.json({ sent, skipped, failed })
  } catch (err) {
    console.error("[priprava/hraci/mail POST]", err)
    return new Response("Server error", { status: 500 })
  }
}
