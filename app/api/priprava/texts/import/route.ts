import { requireAdmin } from "@/lib/admin-password"
import { parseImport } from "@/lib/doc-validation"
import { DOC_IDS } from "@/lib/doc-ids"
import { importTexts } from "@/lib/docs-store"

export const dynamic = "force-dynamic"

// POST /api/priprava/texts/import { texts: [...], genders?: [...], roles?: [...], by? }
// Přepíše texty ze souboru importu (viz parseImport). Vrací počty.
export async function POST(req: Request) {
  const denied = await requireAdmin(req)
  if (denied) return denied
  try {
    const raw = await req.json().catch(() => null) as { by?: unknown } | null
    const parsed = parseImport(raw, DOC_IDS)
    if (!parsed.ok) return new Response(parsed.error, { status: 400 })
    const by = typeof raw?.by === "string" ? raw.by.slice(0, 80) : null
    return Response.json(await importTexts(parsed.value.texts, parsed.value.genders, by, parsed.value.roles))
  } catch (err) {
    console.error("[priprava/texts/import]", err)
    // Jen za heslem Přípravy: skutečný text chyby pomůže, když import selže.
    return new Response(`Chyba serveru při importu: ${err instanceof Error ? err.message : String(err)}`, { status: 500 })
  }
}
