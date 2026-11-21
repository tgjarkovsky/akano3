import { requireAdmin } from "@/lib/admin-password"
import { requestedRunId, runParam, unknownRun } from "@/lib/run-param"
import { DOC_PLAYERS } from "@/lib/doc-ids"
import { assignRole, getRoleHolders } from "@/lib/role-holders-store"

export const dynamic = "force-dynamic"

// GET /api/priprava/role-holders?run=ID — kdo v běhu (bez ?run aktivním) drží kterou roli
export async function GET(req: Request) {
  const denied = await requireAdmin(req)
  if (denied) return denied
  try {
    const runId = await requestedRunId(runParam(req))
    if (runId === null) return unknownRun()
    return Response.json(await getRoleHolders(runId))
  } catch (err) {
    console.error("[priprava/role-holders GET]", err)
    return new Response("Server error", { status: 500 })
  }
}

// POST /api/priprava/role-holders { characterId, roleId: string | null, runId?, by? }
// Role postavy v běhu (bez runId aktivním); spoluhráč s tou rolí dostane dosavadní roli postavy.
export async function POST(req: Request) {
  const denied = await requireAdmin(req)
  if (denied) return denied
  try {
    const b = await req.json().catch(() => null) as { characterId?: unknown; roleId?: unknown; runId?: unknown; by?: unknown } | null
    if (typeof b?.characterId !== "string" || !DOC_PLAYERS.some(c => c.id === b.characterId)) return new Response("Neznámá postava", { status: 400 })
    if (b.roleId !== null && (typeof b.roleId !== "string" || !/^\d+$/.test(b.roleId))) return new Response("Neplatná role", { status: 400 })
    const runId = await requestedRunId(b.runId)
    if (runId === null) return unknownRun()
    const by = typeof b.by === "string" ? b.by.slice(0, 80) : null
    const error = await assignRole(runId, b.characterId, b.roleId as string | null, by)
    if (error) return new Response(error, { status: 409 })
    return Response.json(await getRoleHolders(runId))
  } catch (err) {
    console.error("[priprava/role-holders POST]", err)
    return new Response("Server error", { status: 500 })
  }
}
