import { parsePrihlaska, EDIT_UNTIL } from "@/lib/prihlaska"
import { sendConfirmation } from "@/lib/prihlaska-mail"
import { createPrihlaska, PRIHLASKA_IDS } from "@/lib/prihlaska-store"

export const dynamic = "force-dynamic"

const MAX_BODY = 64_000

// POST /api/prihlaska — veřejné odeslání přihlášky, vrací tajný odkaz na úpravy
export async function POST(req: Request) {
  try {
    const raw = await req.text()
    if (raw.length > MAX_BODY) return new Response("Přihláška je příliš velká.", { status: 413 })
    const parsed = parsePrihlaska(JSON.parse(raw || "null"), PRIHLASKA_IDS)
    if (!parsed.ok) return new Response(parsed.error, { status: 400 })
    const token = await createPrihlaska(parsed.value)
    const until = new Date(EDIT_UNTIL).toLocaleDateString("cs-CZ", { timeZone: "Europe/Prague" })
    await sendConfirmation(parsed.value.email, parsed.value.nickname || parsed.value.firstName, `${new URL(req.url).origin}/prihlaska/${token}`, until)
    return Response.json({ token }, { status: 201 })
  } catch (err) {
    if (err instanceof SyntaxError) return new Response("Neplatná přihláška.", { status: 400 })
    console.error("[prihlaska POST]", err)
    return new Response("Server error", { status: 500 })
  }
}
