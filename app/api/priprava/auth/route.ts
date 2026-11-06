import { adminGuard } from "@/lib/admin-auth"

export const dynamic = "force-dynamic"

// POST /api/priprava/auth — ověří heslo Přípravy (hlavička x-admin-token).
// Nic nemění, slouží jen přihlašovací obrazovce, aby špatné heslo
// poznala hned a ne až při prvním uložení.
export async function POST(req: Request) {
  const denied = adminGuard(req)
  if (denied) return denied
  return new Response(null, { status: 204 })
}
