import { requireAdmin } from "@/lib/admin-password"
import { DOC_IDS } from "@/lib/doc-ids"
import { setGender } from "@/lib/docs-store"

export const dynamic = "force-dynamic"

// POST /api/priprava/character-meta { characterId, gender: "m" | "f" | null }
export async function POST(req: Request) {
  const denied = await requireAdmin(req)
  if (denied) return denied
  try {
    const b = await req.json().catch(() => null) as { characterId?: unknown; gender?: unknown } | null
    if (typeof b?.characterId !== "string" || !DOC_IDS.characterIds.includes(b.characterId)) {
      return new Response("Neznámá postava", { status: 400 })
    }
    if (b.gender !== "m" && b.gender !== "f" && b.gender !== null) return new Response("Gender musí být m, f nebo null", { status: 400 })
    await setGender(b.characterId, b.gender)
    return new Response(null, { status: 204 })
  } catch (err) {
    console.error("[priprava/character-meta POST]", err)
    return new Response("Server error", { status: 500 })
  }
}
