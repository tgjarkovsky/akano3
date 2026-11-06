import { requireAdmin } from "@/lib/admin-password"
import { DOC_IDS } from "@/lib/doc-ids"
import { parseRunId, parseSpisAction } from "@/lib/spis-validation"
import { getSpisOverview, createMissingLinks, regenerateLink, setPublished, runExists } from "@/lib/spis-store"

export const dynamic = "force-dynamic"

// GET /api/priprava/spisy?run=ID — odkazy, zveřejnění a počty textů postav běhu
export async function GET(req: Request) {
  const denied = await requireAdmin(req)
  if (denied) return denied
  const runId = parseRunId(new URL(req.url).searchParams.get("run"))
  if (runId === null) return new Response("Neplatný běh", { status: 400 })
  try {
    const overview = await getSpisOverview(runId)
    if (!overview) return new Response("Běh neexistuje", { status: 404 })
    return Response.json(overview)
  } catch (err) {
    console.error("[priprava/spisy GET]", err)
    return new Response("Server error", { status: 500 })
  }
}

// POST /api/priprava/spisy { action: "create-links" | "regenerate" | "publish" | "unpublish", runId, characterId?, by? }
export async function POST(req: Request) {
  const denied = await requireAdmin(req)
  if (denied) return denied
  try {
    const parsed = parseSpisAction(await req.json().catch(() => null), DOC_IDS.characterIds)
    if (!parsed.ok) return new Response(parsed.error, { status: 400 })
    const a = parsed.value
    if (!(await runExists(a.runId))) return new Response("Běh neexistuje", { status: 404 })
    if (a.action === "create-links") await createMissingLinks(a.runId, a.by)
    else if (a.action === "regenerate") await regenerateLink(a.runId, a.characterId, a.by)
    else await setPublished(a.runId, a.action === "publish", a.by)
    return Response.json(await getSpisOverview(a.runId))
  } catch (err) {
    console.error("[priprava/spisy POST]", err)
    return new Response("Server error", { status: 500 })
  }
}
