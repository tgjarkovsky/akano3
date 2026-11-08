import { requireAdmin } from "@/lib/admin-password"
import { getActiveRunId } from "@/lib/runs"
import { DOC_PLAYERS } from "@/lib/doc-ids"
import { assignRole, getRoleHolders } from "@/lib/role-holders-store"

export const dynamic = "force-dynamic"

// GET /api/priprava/role-holders — kdo v aktivním běhu drží kterou roli
export async function GET(req: Request) {
  const denied = await requireAdmin(req)
  if (denied) return denied
  try {
    return Response.json(await getRoleHolders(await getActiveRunId()))
  } catch (err) {
    console.error("[priprava/role-holders GET]", err)
    return new Response("Server error", { status: 500 })
  }
}

// POST /api/priprava/role-holders { characterId, roleId: string | null, by? }
// Role postavy v aktivním běhu; spoluhráč s tou rolí dostane dosavadní roli postavy.
export async function POST(req: Request) {
  const denied = await requireAdmin(req)
  if (denied) return denied
  try {
    const b = await req.json().catch(() => null) as { characterId?: unknown; roleId?: unknown; by?: unknown } | null
    if (typeof b?.characterId !== "string" || !DOC_PLAYERS.some(c => c.id === b.characterId)) return new Response("Neznámá postava", { status: 400 })
    if (b.roleId !== null && (typeof b.roleId !== "string" || !/^\d+$/.test(b.roleId))) return new Response("Neplatná role", { status: 400 })
    const runId = await getActiveRunId()
    const by = typeof b.by === "string" ? b.by.slice(0, 80) : null
    const error = await assignRole(runId, b.characterId, b.roleId as string | null, by)
    if (error) return new Response(error, { status: 409 })
    return Response.json(await getRoleHolders(runId))
  } catch (err) {
    console.error("[priprava/role-holders POST]", err)
    return new Response("Server error", { status: 500 })
  }
}
