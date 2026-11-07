import { requireAdmin } from "@/lib/admin-password"
import { CHARACTERS, TEAMS } from "@/lib/data"
import { validateRuleInput, normalizeAllowed, indexRules, type RuleProperty, type RuleSubject } from "@/lib/assignment-rules"
import { ruleOptionsFor } from "@/lib/rule-options"
import { fixedRole, fixedRoleConflict, roleLabel, roleRuleOptions } from "@/lib/role-rules"
import { getRules, saveRule } from "@/lib/rules-store"
import { getRoles } from "@/lib/docs-store"
import { getCharName, getUnitName } from "@/lib/utils"

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
// Role jen napevno: [id role]. Pevná role nesmí kolidovat s jinými pravidly (409).
export async function POST(req: Request) {
  const denied = await requireAdmin(req)
  if (denied) return denied
  try {
    const body = await req.json().catch(() => null)
    const players = CHARACTERS.filter(c => c.role === "student" || c.role === "ruze")
    const roles = (body as { property?: unknown } | null)?.property === "role" || (body as { property?: unknown } | null)?.property === "unit"
      ? await getRoles() : []
    const optionsFor = (p: RuleProperty) => (p === "role" ? roleRuleOptions(roles, getUnitName) : ruleOptionsFor(p))
    const error = validateRuleInput(body, { characterIds: players.map(c => c.id), teamIds: TEAMS.map(t => t.id) }, optionsFor)
    if (error) return new Response(error, { status: 400 })
    const b = body as { subjectType: RuleSubject; subjectId: string; property: RuleProperty; allowed: string[] | null; by?: unknown }
    const allowed = b.allowed === null ? null : b.property === "role" ? b.allowed : normalizeAllowed(b.allowed, optionsFor(b.property))

    if (b.property === "unit" && allowed === null) {
      // Zrušení pravidla jednotky = libovolná jednotka; s pevnými rolemi členů nejde.
      const index = indexRules(await getRules())
      const holder = players.find(c => c.teamId === b.subjectId && fixedRole(index, roles, c.id))
      if (holder) return new Response(`${holder.name} má v týmu pevnou roli, nejdřív ji zruš`, { status: 409 })
    }
    if (allowed !== null && (b.property === "role" || b.property === "unit")) {
      const index = indexRules(await getRules())
      if (b.property === "role") {
        const ch = players.find(c => c.id === b.subjectId)
        const conflict = fixedRoleConflict({
          index, roles, characterId: b.subjectId, roleId: allowed[0], teamId: ch?.teamId,
          teammateIds: players.filter(c => c.teamId && c.teamId === ch?.teamId).map(c => c.id),
          allCharacterIds: players.map(c => c.id), name: getCharName, unitName: getUnitName,
        })
        if (conflict) return new Response(conflict, { status: 409 })
      } else {
        // Pevné role členů drží jednotku týmu napevno; jinou nebo volnější nejde nastavit.
        for (const c of players.filter(c => c.teamId === b.subjectId)) {
          const r = fixedRole(index, roles, c.id)
          if (r && (allowed.length !== 1 || allowed[0] !== r.unitId)) {
            return new Response(`${c.name} má napevno roli ${roleLabel(r)} v jednotce ${getUnitName(r.unitId)}, nejdřív ji zruš`, { status: 409 })
          }
        }
      }
    }

    const by = typeof b.by === "string" ? b.by.slice(0, 80) : null
    await saveRule(b.subjectType, b.subjectId, b.property, allowed, by)
    return Response.json(await getRules())
  } catch (err) {
    console.error("[priprava/rules POST]", err)
    return new Response("Server error", { status: 500 })
  }
}
