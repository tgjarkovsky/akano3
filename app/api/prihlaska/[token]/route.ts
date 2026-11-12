import { parsePrihlaska, canEdit } from "@/lib/prihlaska"
import { updatePrihlaska, isPrihlaskaToken, PRIHLASKA_IDS } from "@/lib/prihlaska-store"

export const dynamic = "force-dynamic"

const MAX_BODY = 64_000

// PUT /api/prihlaska/[token] — úprava odeslané přihlášky přes tajný odkaz, do konce přihlašování
export async function PUT(req: Request, { params }: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await params
    if (!isPrihlaskaToken(token)) return new Response("Odkaz neplatí.", { status: 404 })
    if (!canEdit()) return new Response("Přihlašování skončilo, přihlášku už nejde upravit. Napiš organizátorům.", { status: 403 })
    const raw = await req.text()
    if (raw.length > MAX_BODY) return new Response("Přihláška je příliš velká.", { status: 413 })
    const parsed = parsePrihlaska(JSON.parse(raw || "null"), PRIHLASKA_IDS)
    if (!parsed.ok) return new Response(parsed.error, { status: 400 })
    if (!(await updatePrihlaska(token, parsed.value))) return new Response("Odkaz neplatí.", { status: 404 })
    return Response.json({ ok: true })
  } catch (err) {
    if (err instanceof SyntaxError) return new Response("Neplatná přihláška.", { status: 400 })
    console.error("[prihlaska PUT]", err)
    return new Response("Server error", { status: 500 })
  }
}
