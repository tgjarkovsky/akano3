import { requireAdmin, getStoredHash } from "@/lib/admin-password"

export const dynamic = "force-dynamic"

// GET /api/priprava/auth — je heslo Přípravy už nastavené? { passwordSet }
// Přihlašovací obrazovka podle toho ukáže přihlášení, nebo první nastavení.
export async function GET() {
  try {
    return Response.json({ passwordSet: (await getStoredHash()) !== null || !!process.env.ADMIN_TOKEN })
  } catch (err) {
    console.error("[priprava/auth GET]", err)
    return new Response("Server error", { status: 500 })
  }
}

// POST /api/priprava/auth — ověří heslo z hlavičky. Nic nemění, jen dá
// přihlašovací obrazovce vědět hned, a ne až při prvním uložení.
export async function POST(req: Request) {
  const denied = await requireAdmin(req)
  if (denied) return denied
  return new Response(null, { status: 204 })
}
