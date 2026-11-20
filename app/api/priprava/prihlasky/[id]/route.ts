import { requireAdmin } from "@/lib/admin-password"
import { parseStatusChange } from "@/lib/cast"
import { setPayment, setStatus } from "@/lib/cast-store"
import { isIsoDate } from "@/lib/character-doc"
import { runExists } from "@/lib/spis-store"

export const dynamic = "force-dynamic"

// POST /api/priprava/prihlasky/[id]
//   { status, runId }         stav přihlášky a běh (přijatý a náhradník běh mají, ostatní ne)
//   { paidAt, paymentNote }   platba hry (paidAt null = nezaplaceno)
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireAdmin(req)
  if (denied) return denied
  try {
    const { id: raw } = await params
    const id = Number(raw)
    if (!Number.isInteger(id) || id <= 0) return new Response("Neplatná přihláška", { status: 400 })
    const b = await req.json().catch(() => null) as Record<string, unknown> | null
    if (!b) return new Response("Bad request", { status: 400 })

    if ("status" in b) {
      const change = parseStatusChange(b.status, b.runId)
      if ("error" in change) return new Response(change.error, { status: 400 })
      if (change.runId !== null && !(await runExists(change.runId))) return new Response("Běh neexistuje", { status: 400 })
      if (!(await setStatus(id, change.status, change.runId))) return new Response("Přihláška neexistuje", { status: 404 })
      return new Response(null, { status: 204 })
    }
    if ("paidAt" in b) {
      if (b.paidAt !== null && !isIsoDate(b.paidAt)) return new Response("Neplatné datum platby", { status: 400 })
      const note = typeof b.paymentNote === "string" ? b.paymentNote.trim().slice(0, 500) || null : null
      if (!(await setPayment(id, b.paidAt as string | null, note))) return new Response("Přihláška neexistuje", { status: 404 })
      return new Response(null, { status: 204 })
    }
    return new Response("Bad request", { status: 400 })
  } catch (err) {
    console.error("[priprava/prihlasky/[id] POST]", err)
    return new Response("Server error", { status: 500 })
  }
}
