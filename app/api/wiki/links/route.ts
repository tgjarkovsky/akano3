import { sql } from "@/lib/db"
import { adminGuard } from "@/lib/admin-auth"
import type { WikiLinkAdmin } from "@/lib/types"

export const dynamic = "force-dynamic"

function rowToLink(r: Record<string, unknown>): WikiLinkAdmin {
  return {
    id: r.id, fromSlug: r.from_slug, toSlug: r.to_slug,
    label: r.label, kaichiRequired: r.kaichi_required,
  } as WikiLinkAdmin
}

async function missingSlugs(fromSlug: string, toSlug: string): Promise<string[]> {
  const rows = await sql`
    SELECT slug FROM wiki_articles WHERE slug = ANY(${[fromSlug, toSlug]})
  `
  const found = new Set(rows.map(r => r.slug as string))
  return [fromSlug, toSlug].filter(s => !found.has(s))
}

// GET /api/wiki/links — všechny vazby (Příprava, s heslem)
export async function GET(req: Request) {
  const denied = adminGuard(req)
  if (denied) return denied
  try {
    const rows = await sql`
      SELECT * FROM wiki_links ORDER BY from_slug, to_slug, id
    `
    return Response.json(rows.map(rowToLink))
  } catch (err) {
    console.error("[wiki-links GET]", err)
    return new Response(String(err), { status: 500 })
  }
}

// POST /api/wiki/links — create link
export async function POST(req: Request) {
  const denied = adminGuard(req)
  if (denied) return denied
  try {
    const body = await req.json() as {
      fromSlug: string; toSlug: string; label: string; kaichiRequired: number
    }
    const missing = await missingSlugs(body.fromSlug, body.toSlug)
    if (missing.length > 0) {
      return new Response(`Neznámé sluggy: ${missing.join(", ")}`, { status: 400 })
    }
    const [row] = await sql`
      INSERT INTO wiki_links (from_slug, to_slug, label, kaichi_required)
      VALUES (${body.fromSlug}, ${body.toSlug}, ${body.label}, ${body.kaichiRequired})
      RETURNING *
    `
    return Response.json(rowToLink(row), { status: 201 })
  } catch (err) {
    console.error("[wiki-links POST]", err)
    return new Response(String(err), { status: 500 })
  }
}
