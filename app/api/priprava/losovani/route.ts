import { requireAdmin } from "@/lib/admin-password"
import { isCastable } from "@/lib/cast-store"
import { applyLottery, drawLottery, latestLottery, revertLottery, type LotteryCharacter } from "@/lib/lottery-store"

export const dynamic = "force-dynamic"

// Společný los obou běhů (lib/lottery.ts, lib/lottery-store.ts).
// GET                                    poslední los (náhled nebo použitý), nebo null
// POST { draw: { runs: { first, second }, adults, students }, by? }
//                                        nový los z osudí (jen náhled); runs = který běh
//                                        v aplikaci odpovídá termínu z přihlášky (null = nelosuje se)
// POST { apply: lotteryId }              použije los: stavy přihlášek a pořadí náhradníků
// POST { revert: lotteryId }             vrátí použitý los (lidi zpět mezi nové)

const runId = (v: unknown): number | null | undefined =>
  v === null || v === undefined ? null : typeof v === "number" && Number.isInteger(v) && v > 0 ? v : undefined

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
    return Response.json(await latestLottery(), { headers: { "Cache-Control": "no-store" } })
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
    const by = typeof b.by === "string" ? b.by.slice(0, 80) : null
    if (typeof b.apply === "number" && Number.isInteger(b.apply)) {
      const error = await applyLottery(b.apply)
      if (error) return new Response(error, { status: 409 })
      return Response.json(await latestLottery())
    }
    if (typeof b.revert === "number" && Number.isInteger(b.revert)) {
      const error = await revertLottery(b.revert)
      if (error) return new Response(error, { status: 409 })
      return Response.json(await latestLottery())
    }
    const d = b.draw as Record<string, unknown> | undefined
    if (d && typeof d === "object") {
      const runs = d.runs as Record<string, unknown> | undefined
      const first = runId(runs?.first), second = runId(runs?.second)
      if (first === undefined || second === undefined) return new Response("Neplatný běh", { status: 400 })
      const adults = parseCharacters(d.adults, "adult"), students = parseCharacters(d.students, "player")
      if (!adults || !students) return new Response("Neplatné postavy", { status: 400 })
      const lot = await drawLottery({ first, second }, { adults, students }, by)
      if (typeof lot === "string") return new Response(lot, { status: 400 })
      return Response.json(lot)
    }
    return new Response("Bad request", { status: 400 })
  } catch (err) {
    console.error("[priprava/losovani POST]", err)
    return new Response("Server error", { status: 500 })
  }
}
