import { sql } from "@/lib/db"
import { getActiveRunId } from "@/lib/runs"
import { requireAdmin } from "@/lib/admin-password"
import { gateLinks, type RawLink } from "@/lib/wiki-links"
import { validateWikiArticleInput } from "@/lib/wiki-validation"
import type { WikiArticle } from "@/lib/types"

export const dynamic = "force-dynamic"

function rowToArticle(r: Record<string, unknown>): WikiArticle {
  return {
    id: r.id, slug: r.slug, title: r.title, content: r.content, category: r.category,
    kaichiRequired: r.kaichi_required, sortOrder: r.sort_order,
    createdAt: r.created_at, updatedAt: r.updated_at,
  } as WikiArticle
}

// GET /api/wiki?characterId=X  — { articles, links } podle kaichi postavy
// GET /api/wiki?kaichi=N        — { articles, links } pro zadaný stupeň (knihovní view)
// GET /api/wiki?admin=1         — všechny články (Příprava, s heslem)
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const admin = searchParams.get("admin") === "1"
    const characterId = searchParams.get("characterId")
    const kaichiParam = searchParams.get("kaichi")

    if (admin) {
      const denied = await requireAdmin(req)
      if (denied) return denied
      const rows = await sql`
        SELECT * FROM wiki_articles ORDER BY category, sort_order, id
      `
      return Response.json(rows.map(rowToArticle))
    }

    if (!characterId && kaichiParam === null) {
      return new Response("characterId required", { status: 400 })
    }

    let kaichiLevel: number
    if (kaichiParam !== null) {
      kaichiLevel = Math.max(0, Math.min(8, Number(kaichiParam) || 0))
    } else {
      const runId = await getActiveRunId()
      const [state] = await sql`
        SELECT kaichi_level FROM character_state
        WHERE character_id = ${characterId} AND run_id = ${runId}
      `
      kaichiLevel = (state?.kaichi_level as number) ?? 0
    }

    const rows = await sql`
      SELECT * FROM wiki_articles
      WHERE kaichi_required <= ${kaichiLevel}
      ORDER BY category, sort_order, id
    `
    const articles = rows.map(rowToArticle)
    const linkRows = await sql`
      SELECT from_slug, to_slug, label, kaichi_required FROM wiki_links
    `
    const links = gateLinks(linkRows as RawLink[], kaichiLevel, new Set(articles.map(a => a.slug)))
    return Response.json({ articles, links })
  } catch (err) {
    console.error("[wiki GET]", err)
    return new Response(String(err), { status: 500 })
  }
}

// POST /api/wiki — create article
export async function POST(req: Request) {
  const denied = await requireAdmin(req)
  if (denied) return denied
  try {
    const parsed = validateWikiArticleInput(await req.json().catch(() => null))
    if (!parsed.ok) return new Response(parsed.error, { status: 400 })
    const body = parsed.value
    const [row] = await sql`
      INSERT INTO wiki_articles (slug, title, content, category, kaichi_required, sort_order)
      VALUES (${body.slug}, ${body.title}, ${body.content}, ${body.category}, ${body.kaichiRequired}, ${body.sortOrder})
      RETURNING *
    `
    return Response.json(row, { status: 201 })
  } catch (err) {
    console.error("[wiki POST]", err)
    return new Response(String(err), { status: 500 })
  }
}
