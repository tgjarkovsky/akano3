import { requireAdmin } from "@/lib/admin-password"
import { parseStatusChange } from "@/lib/doc-validation"
import { DOC_IDS } from "@/lib/doc-ids"
import { changeStatus } from "@/lib/docs-store"

export const dynamic = "force-dynamic"

// POST /api/priprava/texts/status { entityType, entityId, field, action: done|approve|reopen, expectedVersion, by? }
export async function POST(req: Request) {
  const denied = await requireAdmin(req)
  if (denied) return denied
  try {
    const parsed = parseStatusChange(await req.json().catch(() => null), DOC_IDS)
    if (!parsed.ok) return new Response(parsed.error, { status: 400 })
    const result = await changeStatus(parsed.value)
    if (result.ok) return Response.json(result.record)
    if (result.error) return new Response(result.error, { status: 422 })
    return Response.json({ conflict: result.conflict }, { status: 409 })
  } catch (err) {
    console.error("[priprava/texts/status POST]", err)
    return new Response("Server error", { status: 500 })
  }
}
