import { timingSafeEqual } from "node:crypto"
import { verifyPassword } from "./password-hash.ts"

/**
 * Ověření hesla Přípravy (a /api/admin/*). Tenhle soubor nesahá na databázi,
 * aby šel testovat; uložený otisk mu předává lib/admin-password.ts.
 *
 * Heslo se posílá v hlavičce:
 *   x-admin-password  — z aplikace, zakódované encodeURIComponent (kvůli diakritice)
 *   x-admin-token     — ručně z curl, jako dřív
 *
 * Projde, když se shoduje s heslem uloženým v databázi, nebo s proměnnou
 * prostředí ADMIN_TOKEN, pokud je nastavená (záložní cesta pro curl).
 */

export type AdminCheck = "ok" | "unauthorized" | "unset"

export function readPresentedPassword(req: Request): string | null {
  const encoded = req.headers.get("x-admin-password")
  if (encoded) {
    try { return decodeURIComponent(encoded) } catch { return null }
  }
  return req.headers.get("x-admin-token") || null
}

function sameString(a: string, b: string): boolean {
  const x = Buffer.from(a), y = Buffer.from(b)
  return x.length === y.length && timingSafeEqual(x, y)
}

export async function checkAdmin(
  presented: string | null,
  { envToken, storedHash }: { envToken?: string | null; storedHash?: string | null },
): Promise<AdminCheck> {
  if (!storedHash && !envToken) return "unset"
  if (!presented) return "unauthorized"
  if (envToken && sameString(presented, envToken)) return "ok"
  if (storedHash && await verifyPassword(presented, storedHash)) return "ok"
  return "unauthorized"
}

/** Odpověď pro zamítnutý požadavek, null když je v pořádku. */
export function adminDenied(result: AdminCheck): Response | null {
  if (result === "ok") return null
  if (result === "unset") return new Response("Heslo Přípravy ještě není nastavené", { status: 503 })
  return new Response("Unauthorized", { status: 401 })
}
