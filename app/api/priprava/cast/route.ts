import { requireAdmin } from "@/lib/admin-password"
import { sql } from "@/lib/db"
import { getActiveRunId } from "@/lib/runs"
import { ensureDocTables } from "@/lib/docs-store"
import { assignCast, getCastBoard, isCastable, setCastPublished } from "@/lib/cast-store"

export const dynamic = "force-dynamic"

// Obsazení hráčů na postavy v aktivním běhu (lib/cast-store.ts).

async function board(runId: number) {
  await ensureDocTables()
  const [b, meta] = await Promise.all([
    getCastBoard(runId),
    sql`SELECT character_id, gender FROM character_meta WHERE gender IN ('m', 'f')`,
  ])
  return { runId, ...b, gender: Object.fromEntries(meta.map(r => [r.character_id as string, r.gender as "m" | "f"])) }
}

// GET /api/priprava/cast — přijatí hráči a náhradníci aktivního běhu, kdo hraje kterou postavu, rody postav
export async function GET(req: Request) {
  const denied = await requireAdmin(req)
  if (denied) return denied
  try {
    return Response.json(await board(await getActiveRunId()), { headers: { "Cache-Control": "no-store" } })
  } catch (err) {
    console.error("[priprava/cast GET]", err)
    return new Response("Server error", { status: 500 })
  }
}

// POST /api/priprava/cast
//   { characterId, prihlaskaId: number | null, by? }   hráč na postavu (null = postava bez hráče)
//   { publish: boolean, by? }                           zveřejní / skryje obsazení hráčům
export async function POST(req: Request) {
  const denied = await requireAdmin(req)
  if (denied) return denied
  try {
    const b = await req.json().catch(() => null) as Record<string, unknown> | null
    if (!b) return new Response("Bad request", { status: 400 })
    const runId = await getActiveRunId()
    const by = typeof b.by === "string" ? b.by.slice(0, 80) : null

    if (typeof b.publish === "boolean") {
      await setCastPublished(runId, b.publish, by)
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
