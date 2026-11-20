import { isSpisToken } from "@/lib/character-doc"
import { publishedRunOfSpis } from "@/lib/spis-store"
import { castPrihlaskaOf, getPhoto, isCastable, photoResponse } from "@/lib/cast-store"

export const dynamic = "force-dynamic"

// GET /api/spis/[token]/foto/[characterId] — fotka hráče postavy ze stejného běhu.
// Jen ke zveřejněnému spisu a zveřejněnému obsazení běhu.
export async function GET(_req: Request, { params }: { params: Promise<{ token: string; characterId: string }> }) {
  try {
    const { token, characterId } = await params
    if (!isSpisToken(token) || !isCastable(characterId)) return new Response("Nenalezeno", { status: 404 })
    const runId = await publishedRunOfSpis(token)
    const prihlaskaId = runId && await castPrihlaskaOf(runId, characterId)
    const photo = prihlaskaId ? await getPhoto(prihlaskaId) : null
    return photo ? photoResponse(photo) : new Response("Nenalezeno", { status: 404 })
  } catch (err) {
    console.error("[spis foto GET]", err)
    return new Response("Server error", { status: 500 })
  }
}
