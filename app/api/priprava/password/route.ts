import { requireAdmin, getStoredHash, setInitialPassword, changePassword } from "@/lib/admin-password"
import { validateNewPassword } from "@/lib/password-hash"

export const dynamic = "force-dynamic"

// POST /api/priprava/password { newPassword }
// - heslo ještě není nastavené: nastaví ho (první, kdo přijde; jen jednou)
// - heslo nastavené je: změní ho, ale jen s platným současným heslem v hlavičce
export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null) as { newPassword?: unknown } | null
    const invalid = validateNewPassword(body?.newPassword)
    if (invalid) return new Response(invalid, { status: 400 })
    const newPassword = body!.newPassword as string

    const isSet = (await getStoredHash()) !== null || !!process.env.ADMIN_TOKEN
    if (!isSet) {
      const created = await setInitialPassword(newPassword)
      if (!created) return new Response("Heslo už mezitím někdo nastavil", { status: 409 })
      return new Response(null, { status: 201 })
    }

    const denied = await requireAdmin(req)
    if (denied) return denied
    await changePassword(newPassword)
    return new Response(null, { status: 204 })
  } catch (err) {
    console.error("[priprava/password POST]", err)
    return new Response("Server error", { status: 500 })
  }
}
