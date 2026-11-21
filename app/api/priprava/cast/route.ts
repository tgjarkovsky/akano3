import { requireAdmin } from "@/lib/admin-password"
import { sql } from "@/lib/db"
import { requestedRunId, runParam, unknownRun } from "@/lib/run-param"
import { ensureDocTables } from "@/lib/docs-store"
import { assignCast, assignCastMany, getCastBoard, isCastable, setCastPublished } from "@/lib/cast-store"

export const dynamic = "force-dynamic"

// Obsazení hráčů na postavy v běhu (lib/cast-store.ts). Běh je ?run= u GET a runId
// v těle u POST; bez něj aktivní běh.

async function board(runId: number) {
  await ensureDocTables()
  const [b, meta] = await Promise.all([
    getCastBoard(runId),
    sql`SELECT character_id, gender FROM character_meta WHERE gender IN ('m', 'f')`,
  ])
  return { runId, ...b, gender: Object.fromEntries(meta.map(r => [r.character_id as string, r.gender as "m" | "f"])) }
}

// GET /api/priprava/cast?run=ID — přijatí hráči a náhradníci běhu, kdo hraje kterou postavu, rody postav
export async function GET(req: Request) {
  const denied = await requireAdmin(req)
  if (denied) return denied
  try {
    const runId = await requestedRunId(runParam(req))
    if (runId === null) return unknownRun()
    return Response.json(await board(runId), { headers: { "Cache-Control": "no-store" } })
  } catch (err) {
    console.error("[priprava/cast GET]", err)
    return new Response("Server error", { status: 500 })
  }
}

// POST /api/priprava/cast
//   { characterId, prihlaskaId: number | null, by? }   hráč na postavu (null = postava bez hráče)
//   { publish: boolean, by? }                           zveřejní / skryje obsazení hráčům
//   { assign: [{ characterId, prihlaskaId }], by? }     schválený návrh obsazení najednou
export async function POST(req: Request) {
  const denied = await requireAdmin(req)
  if (denied) return denied
  try {
    const b = await req.json().catch(() => null) as Record<string, unknown> | null
    if (!b) return new Response("Bad request", { status: 400 })
    const runId = await requestedRunId(b.runId)
    if (runId === null) return unknownRun()
    const by = typeof b.by === "string" ? b.by.slice(0, 80) : null

    if (typeof b.publish === "boolean") {
      await setCastPublished(runId, b.publish, by)
      return Response.json(await board(runId))
    }
    if (Array.isArray(b.assign)) {
      const pairs = b.assign as { characterId?: unknown; prihlaskaId?: unknown }[]
      if (pairs.length > 200 || !pairs.every(p => p && isCastable(p.characterId) && typeof p.prihlaskaId === "number" && Number.isInteger(p.prihlaskaId))) {
        return new Response("Neplatný návrh", { status: 400 })
      }
      const error = await assignCastMany(runId, pairs as { characterId: string; prihlaskaId: number }[], by)
      if (error) return new Response(error, { status: 409 })
      return Response.json(await board(runId))
    }
    if (!isCastable(b.characterId)) return new Response("Neznámá postava", { status: 400 })
    if (b.prihlaskaId !== null && (typeof b.prihlaskaId !== "number" || !Number.isInteger(b.prihlaskaId))) {
      return new Response("Neplatná přihláška", { status: 400 })
    }
    const error = await assignCast(runId, b.characterId, b.prihlaskaId as number | null, by)
    if (error) return new Response(error, { status: 409 })
    return Response.json(await board(runId))
  } catch (err) {
    console.error("[priprava/cast POST]", err)
    return new Response("Server error", { status: 500 })
  }
}
