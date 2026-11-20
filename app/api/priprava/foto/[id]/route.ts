import { requireAdmin } from "@/lib/admin-password"
import { getPhoto, photoResponse } from "@/lib/cast-store"

export const dynamic = "force-dynamic"

// GET /api/priprava/foto/[id] — fotka hráče (id přihlášky) pro Přípravu
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireAdmin(req)
  if (denied) return denied
  try {
    const id = Number((await params).id)
    if (!Number.isInteger(id) || id <= 0) return new Response("Neplatná přihláška", { status: 400 })
    const photo = await getPhoto(id)
    return photo ? photoResponse(photo) : new Response("Bez fotky", { status: 404 })
  } catch (err) {
    console.error("[priprava/foto GET]", err)
    return new Response("Server error", { status: 500 })
  }
}
