import { requireAdmin } from "@/lib/admin-password"
import { linkTeamGroups, teamEntries, unlinkTeam } from "@/lib/cast-store"
import { checkGroup, suggestGroups } from "@/lib/team-groups"

export const dynamic = "force-dynamic"

// Trojice z přihlášek (lib/team-groups.ts).
// GET  → návrh propojení nespárovaných týmových přihlášek podle jmen { groups, ambiguous }
// POST { link: number[][] }   propojí skupiny (návrh nebo ruční propojení)
// POST { unlink: number }     odpojí přihlášku od její trojice

export async function GET(req: Request) {
  const denied = await requireAdmin(req)
  if (denied) return denied
  try {
    const entries = (await teamEntries()).filter(e => e.teamGroup === null)
    return Response.json(suggestGroups(entries), { headers: { "Cache-Control": "no-store" } })
  } catch (err) {
    console.error("[priprava/prihlasky/trojice GET]", err)
    return new Response("Server error", { status: 500 })
  }
}

export async function POST(req: Request) {
  const denied = await requireAdmin(req)
  if (denied) return denied
  try {
    const b = await req.json().catch(() => null) as Record<string, unknown> | null
    if (!b) return new Response("Bad request", { status: 400 })
    if (typeof b.unlink === "number" && Number.isInteger(b.unlink)) {
      await unlinkTeam(b.unlink)
      return new Response(null, { status: 204 })
    }
    if (Array.isArray(b.link) && b.link.length <= 200
      && b.link.every(g => Array.isArray(g) && g.every(x => typeof x === "number" && Number.isInteger(x)))) {
      const groups = b.link as number[][]
      if (new Set(groups.flat()).size !== groups.flat().length) return new Response("Přihláška je ve dvou trojicích", { status: 400 })
      const entries = await teamEntries()
      for (const g of groups) {
        const error = checkGroup(g, entries)
        if (error) return new Response(error, { status: 400 })
      }
      await linkTeamGroups(groups)
      return new Response(null, { status: 204 })
    }
    return new Response("Bad request", { status: 400 })
  } catch (err) {
    console.error("[priprava/prihlasky/trojice POST]", err)
    return new Response("Server error", { status: 500 })
  }
}
