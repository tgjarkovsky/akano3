import { requireAdmin } from "@/lib/admin-password"
import { getActiveRunId } from "@/lib/runs"
import { isCastable } from "@/lib/cast-store"
import { applyLottery, drawLottery, latestLottery, type LotteryCharacter } from "@/lib/lottery-store"
import { RUN_CHOICES, type RunChoice } from "@/lib/prihlaska"

export const dynamic = "force-dynamic"

// Losování obsazení aktivního běhu (lib/lottery.ts, lib/lottery-store.ts).
// GET                                    poslední los běhu (náhled nebo použitý), nebo null
// POST { draw: { choice, adults, students }, by? }   nový los z osudí (jen náhled)
// POST { apply: lotteryId }              použije los na prázdný běh

const isChoice = (v: unknown): v is RunChoice => RUN_CHOICES.some(c => c.value === v && v !== "any")

function parseCharacters(v: unknown, kind: "adult" | "player"): LotteryCharacter[] | null {
  if (!Array.isArray(v) || v.length > 60) return null
  const out: LotteryCharacter[] = []
  for (const c of v as Record<string, unknown>[]) {
    if (!c || !isCastable(c.id) || c.kind !== kind) return null
    const str = (x: unknown) => typeof x === "string" ? x.slice(0, 40) : undefined
    out.push({
      id: c.id, kind, name: str(c.name) ?? c.id,
      teamId: str(c.teamId), gender: c.gender === "m" || c.gender === "f" ? c.gender : null,
      unitId: str(c.unitId), circleId: str(c.circleId), specialization: str(c.specialization), origin: str(c.origin),
    })
  }
  return out
}

export async function GET(req: Request) {
  const denied = await requireAdmin(req)
  if (denied) return denied
  try {
    return Response.json(await latestLottery(await getActiveRunId()), { headers: { "Cache-Control": "no-store" } })
  } catch (err) {
    console.error("[priprava/losovani GET]", err)
    return new Response("Server error", { status: 500 })
  }
}

export async function POST(req: Request) {
  const denied = await requireAdmin(req)
  if (denied) return denied
  try {
    const b = await req.json().catch(() => null) as Record<string, unknown> | null
    if (!b) return new Response("Bad request", { status: 400 })
    const runId = await getActiveRunId()
    const by = typeof b.by === "string" ? b.by.slice(0, 80) : null
    if (typeof b.apply === "number" && Number.isInteger(b.apply)) {
      const error = await applyLottery(runId, b.apply)
      if (error) return new Response(error, { status: 409 })
      return Response.json(await latestLottery(runId))
    }
    const d = b.draw as Record<string, unknown> | undefined
    if (d && typeof d === "object") {
      if (!isChoice(d.choice)) return new Response("Vyber, z kterého běhu v přihláškách se losuje", { status: 400 })
      const adults = parseCharacters(d.adults, "adult"), students = parseCharacters(d.students, "player")
      if (!adults || !students) return new Response("Neplatné postavy", { status: 400 })
      return Response.json(await drawLottery(runId, d.choice, { adults, students }, by))
    }
    return new Response("Bad request", { status: 400 })
  } catch (err) {
    console.error("[priprava/losovani POST]", err)
    return new Response("Server error", { status: 500 })
  }
}
