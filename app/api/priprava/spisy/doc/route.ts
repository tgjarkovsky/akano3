import { requireAdmin } from "@/lib/admin-password"
import { DOC_IDS } from "@/lib/doc-ids"
import { parseRunId } from "@/lib/spis-validation"
import { getRunDocs } from "@/lib/spis-store"

export const dynamic = "force-dynamic"

// GET /api/priprava/spisy/doc?run=ID[&character=ID] — spis jedné postavy nebo celého běhu (náhled a tisk)
export async function GET(req: Request) {
  const denied = await requireAdmin(req)
  if (denied) return denied
  const params = new URL(req.url).searchParams
  const runId = parseRunId(params.get("run"))
  if (runId === null) return new Response("Neplatný běh", { status: 400 })
  const characterId = params.get("character")
  if (characterId !== null && !DOC_IDS.characterIds.includes(characterId)) return new Response("Neznámá postava", { status: 400 })
  try {
    const docs = await getRunDocs(runId, characterId)
    if (!docs) return new Response("Běh neexistuje", { status: 404 })
    return Response.json(docs)
  } catch (err) {
    console.error("[priprava/spisy/doc GET]", err)
    return new Response("Server error", { status: 500 })
  }
}
