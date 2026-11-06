import { sql } from "@/lib/db"
import { requireAdmin } from "@/lib/admin-password"
import { validateWikiArticleInput } from "@/lib/wiki-validation"

// PUT /api/wiki/[id] — update article
export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireAdmin(req)
  if (denied) return denied
  try {
    const { id } = await params
    const numId = Number(id)
    if (!Number.isInteger(numId)) return new Response("Invalid id", { status: 400 })
    const parsed = validateWikiArticleInput(await req.json().catch(() => null))
    if (!parsed.ok) return new Response(parsed.error, { status: 400 })
    const body = parsed.value
    const [row] = await sql`
      UPDATE wiki_articles SET
        slug = ${body.slug},
        title = ${body.title},
        content = ${body.content},
        category = ${body.category},
        kaichi_required = ${body.kaichiRequired},
        sort_order = ${body.sortOrder},
        updated_at = NOW()
      WHERE id = ${numId}
      RETURNING *
    `
    if (!row) return new Response("Not found", { status: 404 })
    return Response.json(row)
  } catch (err) {
    console.error("[wiki PUT]", err)
    return new Response(String(err), { status: 500 })
  }
}

// DELETE /api/wiki/[id] — delete article
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireAdmin(req)
  if (denied) return denied
  try {
    const { id } = await params
    await sql`DELETE FROM wiki_articles WHERE id = ${Number(id)}`
    return new Response(null, { status: 204 })
  } catch (err) {
    console.error("[wiki DELETE]", err)
    return new Response(String(err), { status: 500 })
  }
}
