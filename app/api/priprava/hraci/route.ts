import { requireAdmin } from "@/lib/admin-password"
import { getRoster } from "@/lib/cast-store"

export const dynamic = "force-dynamic"

// GET /api/priprava/hraci?run=ID — soupiska běhu: přijatí a náhradníci, postava, platba, fotka, odeslané maily
export async function GET(req: Request) {
  const denied = await requireAdmin(req)
  if (denied) return denied
  try {
    const runId = Number(new URL(req.url).searchParams.get("run"))
    if (!Number.isInteger(runId) || runId <= 0) return new Response("Chybí běh", { status: 400 })
    const roster = await getRoster(runId)
    if (!roster) return new Response("Běh neexistuje", { status: 404 })
    return Response.json(roster, { headers: { "Cache-Control": "no-store" } })
  } catch (err) {
    console.error("[priprava/hraci GET]", err)
    return new Response("Server error", { status: 500 })
  }
}
