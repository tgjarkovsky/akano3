import { requireAdmin } from "@/lib/admin-password"
import { parseRoleInput } from "@/lib/doc-validation"
import { DOC_IDS } from "@/lib/doc-ids"
import { createRole, updateRole, deleteRole } from "@/lib/docs-store"

export const dynamic = "force-dynamic"

const DUPLICATE = "Jednotka už má roli s tímhle klíčem"

// POST /api/priprava/roles { unitId, triplet, key, nameM, nameF } — nová role
export async function POST(req: Request) {
  const denied = await requireAdmin(req)
  if (denied) return denied
  try {
    const parsed = parseRoleInput(await req.json().catch(() => null), DOC_IDS.unitIds)
    if (!parsed.ok) return new Response(parsed.error, { status: 400 })
    const role = await createRole(parsed.value)
    if (role === "duplicate") return new Response(DUPLICATE, { status: 409 })
    return Response.json(role, { status: 201 })
  } catch (err) {
    console.error("[priprava/roles POST]", err)
    return new Response("Server error", { status: 500 })
  }
}

// PATCH /api/priprava/roles { id, unitId, triplet, key, nameM, nameF }
export async function PATCH(req: Request) {
  const denied = await requireAdmin(req)
  if (denied) return denied
  try {
    const raw = await req.json().catch(() => null) as { id?: unknown } | null
    const id = Number(raw?.id)
    if (!Number.isInteger(id) || id < 1) return new Response("Neplatné id", { status: 400 })
    const parsed = parseRoleInput(raw, DOC_IDS.unitIds)
    if (!parsed.ok) return new Response(parsed.error, { status: 400 })
    const role = await updateRole(id, parsed.value)
    if (role === "duplicate") return new Response(DUPLICATE, { status: 409 })
    if (role === "missing") return new Response("Role neexistuje", { status: 404 })
    return Response.json(role)
  } catch (err) {
    console.error("[priprava/roles PATCH]", err)
    return new Response("Server error", { status: 500 })
  }
}

// DELETE /api/priprava/roles?id=N — smaže roli i její osobní text
export async function DELETE(req: Request) {
  const denied = await requireAdmin(req)
  if (denied) return denied
  try {
    const id = Number(new URL(req.url).searchParams.get("id"))
    if (!Number.isInteger(id) || id < 1) return new Response("Neplatné id", { status: 400 })
    await deleteRole(id)
    return new Response(null, { status: 204 })
  } catch (err) {
    console.error("[priprava/roles DELETE]", err)
    return new Response("Server error", { status: 500 })
  }
}
