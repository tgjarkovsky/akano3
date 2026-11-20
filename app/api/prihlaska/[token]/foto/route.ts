import { isPrihlaskaToken } from "@/lib/prihlaska-store"
import { deletePhoto, getPhoto, getPlayerRun, photoResponse, savePhoto } from "@/lib/cast-store"
import { checkPhoto, PHOTO_MAX_BYTES } from "@/lib/cast"

export const dynamic = "force-dynamic"

// Fotka hráče přes tajný odkaz přihlášky. Jen když je hráč přijatý, obsazený
// a obsazení běhu je zveřejněné (lib/cast-store.ts → getPlayerRun).

async function playerOf(params: Promise<{ token: string }>) {
  const { token } = await params
  return isPrihlaskaToken(token) ? getPlayerRun(token) : null
}

// GET — vlastní fotka
export async function GET(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  try {
    const run = await playerOf(params)
    if (!run) return new Response("Nenalezeno", { status: 404 })
    const photo = await getPhoto(run.prihlaskaId)
    return photo ? photoResponse(photo) : new Response("Bez fotky", { status: 404 })
  } catch (err) {
    console.error("[prihlaska foto GET]", err)
    return new Response("Server error", { status: 500 })
  }
}

// PUT — nahrání nebo výměna; tělo jsou rovnou bajty obrázku (JPEG, PNG, WebP)
export async function PUT(req: Request, { params }: { params: Promise<{ token: string }> }) {
  try {
    const run = await playerOf(params)
    if (!run) return new Response("Fotku teď nejde nahrát.", { status: 403 })
    if (Number(req.headers.get("content-length") ?? 0) > PHOTO_MAX_BYTES) return new Response("Fotka je příliš velká.", { status: 413 })
    const bytes = new Uint8Array(await req.arrayBuffer())
    const check = checkPhoto(bytes)
    if ("error" in check) return new Response(check.error, { status: check.status })
    await savePhoto(run.prihlaskaId, check.mime, bytes)
    return new Response(null, { status: 204 })
  } catch (err) {
    console.error("[prihlaska foto PUT]", err)
    return new Response("Server error", { status: 500 })
  }
}

// DELETE — smazání vlastní fotky
export async function DELETE(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  try {
    const run = await playerOf(params)
    if (!run) return new Response("Nenalezeno", { status: 404 })
    await deletePhoto(run.prihlaskaId)
    return new Response(null, { status: 204 })
  } catch (err) {
    console.error("[prihlaska foto DELETE]", err)
    return new Response("Server error", { status: 500 })
  }
}
