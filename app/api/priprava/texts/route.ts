import { sql } from "@/lib/db"
import { requireAdmin } from "@/lib/admin-password"
import { isDocEntityType } from "@/lib/doc-fields"
import { parseTextSave, isKnownEntity } from "@/lib/doc-validation"
import { DOC_IDS } from "@/lib/doc-ids"
import { getOverview, getEntityTexts, saveText, ensureDocTables } from "@/lib/docs-store"

export const dynamic = "force-dynamic"

// GET /api/priprava/texts                          — přehled: stavy všech textů (bez těl), role, gendery
// GET /api/priprava/texts?entityType=X&entityId=Y  — plné texty jedné entity
export async function GET(req: Request) {
  const denied = await requireAdmin(req)
  if (denied) return denied
  try {
    const { searchParams } = new URL(req.url)
    const entityType = searchParams.get("entityType")
    const entityId = searchParams.get("entityId")
    if (entityType !== null || entityId !== null) {
      if (!isDocEntityType(entityType) || !isKnownEntity(entityType, entityId, DOC_IDS)) {
        return new Response("Neznámá entita", { status: 400 })
      }
      return Response.json(await getEntityTexts(entityType, entityId!))
    }
    return Response.json(await getOverview())
  } catch (err) {
    console.error("[priprava/texts GET]", err)
    return new Response("Server error", { status: 500 })
  }
}

// PUT /api/priprava/texts { entityType, entityId, field, body, expectedVersion, keepStatus?, by? }
// 200 → uložený záznam; 409 → { conflict } s aktuální verzí od někoho jiného
export async function PUT(req: Request) {
  const denied = await requireAdmin(req)
  if (denied) return denied
  try {
    const parsed = parseTextSave(await req.json().catch(() => null), DOC_IDS)
    if (!parsed.ok) return new Response(parsed.error, { status: 400 })
    const input = parsed.value
    if (input.entityType === "role") {
      await ensureDocTables()
      const [role] = await sql`SELECT id FROM unit_roles WHERE id = ${Number(input.entityId)}`
      if (!role) return new Response("Role neexistuje", { status: 404 })
    }
    const result = await saveText(input)
    if (result.ok) return Response.json(result.record)
    return Response.json({ conflict: result.conflict }, { status: 409 })
  } catch (err) {
    console.error("[priprava/texts PUT]", err)
    return new Response("Server error", { status: 500 })
  }
}
