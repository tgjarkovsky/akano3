import { requireAdmin } from "@/lib/admin-password"
import { CHARACTERS, TEAMS } from "@/lib/data"
import { validateRuleInput, normalizeAllowed, type RuleProperty, type RuleSubject } from "@/lib/assignment-rules"
import { ruleOptionsFor } from "@/lib/rule-options"
import { getRules, saveRule } from "@/lib/rules-store"

export const dynamic = "force-dynamic"

// GET /api/priprava/rules — všechna pravidla obsazení
export async function GET(req: Request) {
  const denied = await requireAdmin(req)
  if (denied) return denied
  try {
    return Response.json(await getRules())
  } catch (err) {
    console.error("[priprava/rules GET]", err)
    return new Response("Server error", { status: 500 })
  }
}

// POST /api/priprava/rules { subjectType, subjectId, property, allowed: string[] | null, by? }
// allowed = null nebo všechny možnosti → pravidlo se smaže (libovolná).
export async function POST(req: Request) {
  const denied = await requireAdmin(req)
  if (denied) return denied
  try {
    const body = await req.json().catch(() => null)
    const players = CHARACTERS.filter(c => c.role === "student" || c.role === "ruze").map(c => c.id)
    const error = validateRuleInput(body, { characterIds: players, teamIds: TEAMS.map(t => t.id) }, ruleOptionsFor)
    if (error) return new Response(error, { status: 400 })
    const b = body as { subjectType: RuleSubject; subjectId: string; property: RuleProperty; allowed: string[] | null; by?: unknown }
    const allowed = b.allowed === null ? null : normalizeAllowed(b.allowed, ruleOptionsFor(b.property))
    const by = typeof b.by === "string" ? b.by.slice(0, 80) : null
    await saveRule(b.subjectType, b.subjectId, b.property, allowed, by)
    return Response.json(await getRules())
  } catch (err) {
    console.error("[priprava/rules POST]", err)
    return new Response("Server error", { status: 500 })
  }
}
