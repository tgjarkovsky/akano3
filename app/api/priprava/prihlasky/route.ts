import { requireAdmin } from "@/lib/admin-password"
import { listPrihlasky } from "@/lib/prihlaska-store"

export const dynamic = "force-dynamic"

// GET /api/priprava/prihlasky — všechny přihlášky (osobní údaje, jen pro Přípravu)
export async function GET(req: Request) {
  const denied = await requireAdmin(req)
  if (denied) return denied
  try {
    return Response.json(await listPrihlasky(), { headers: { "Cache-Control": "no-store" } })
  } catch (err) {
    console.error("[priprava/prihlasky GET]", err)
    return new Response("Server error", { status: 500 })
  }
}
