import { requireAdmin } from "@/lib/admin-password"
import { listPrihlasky } from "@/lib/prihlaska-store"
import { listAdminStates } from "@/lib/cast-store"

export const dynamic = "force-dynamic"

// GET /api/priprava/prihlasky — všechny přihlášky se stavem, během a platbou (osobní údaje, jen pro Přípravu)
export async function GET(req: Request) {
  const denied = await requireAdmin(req)
  if (denied) return denied
  try {
    const [rows, states] = await Promise.all([listPrihlasky(), listAdminStates()])
    const stateOf = new Map(states.map(s => [s.id, s]))
    const out = rows.map(r => {
      const s = stateOf.get(r.id)
      return { ...r, status: s?.status ?? "new", runId: s?.runId ?? null, paidAt: s?.paidAt ?? null, paymentNote: s?.paymentNote ?? null, rejectionSentAt: s?.rejectionSentAt ?? null, teamGroup: s?.teamGroup ?? null, substituteRank: s?.substituteRank ?? null }
    })
    return Response.json(out, { headers: { "Cache-Control": "no-store" } })
  } catch (err) {
    console.error("[priprava/prihlasky GET]", err)
    return new Response("Server error", { status: 500 })
  }
}
