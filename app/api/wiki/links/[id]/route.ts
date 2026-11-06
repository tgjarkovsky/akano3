import { sql } from "@/lib/db"
import { requireAdmin } from "@/lib/admin-password"

// PUT /api/wiki/links/[id] — update link
export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireAdmin(req)
  if (denied) return denied
  try {
    const { id } = await params
    const body = await req.json() as {
      fromSlug: string; toSlug: string; label: string; kaichiRequired: number
    }
    const rows = await sql`
      SELECT slug FROM wiki_articles WHERE slug = ANY(${[body.fromSlug, body.toSlug]})
    `
    const found = new Set(rows.map(r => r.slug as string))
    const missing = [body.fromSlug, body.toSlug].filter(s => !found.has(s))
    if (missing.length > 0) {
      return new Response(`Neznámé sluggy: ${missing.join(", ")}`, { status: 400 })
    }
    const [row] = await sql`
      UPDATE wiki_links SET
        from_slug = ${body.fromSlug},
        to_slug = ${body.toSlug},
        label = ${body.label},
        kaichi_required = ${body.kaichiRequired}
      WHERE id = ${Number(id)}
      RETURNING *
    `
    if (!row) return new Response("Not found", { status: 404 })
    return Response.json(row)
  } catch (err) {
    console.error("[wiki-links PUT]", err)
    return new Response(String(err), { status: 500 })
  }
}

// DELETE /api/wiki/links/[id] — delete link
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireAdmin(req)
  if (denied) return denied
  try {
    const { id } = await params
    await sql`DELETE FROM wiki_links WHERE id = ${Number(id)}`
    return new Response(null, { status: 204 })
  } catch (err) {
    console.error("[wiki-links DELETE]", err)
    return new Response(String(err), { status: 500 })
  }
}
