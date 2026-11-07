import { requireAdmin, requireAdminOrImport } from "@/lib/admin-password"
import { parseImport } from "@/lib/doc-validation"
import { DOC_IDS, DOC_PLAYERS } from "@/lib/doc-ids"
import { unknownGenderNames } from "@/lib/gender-markup"
import { createDraft, listDrafts, resolveDraft } from "@/lib/import-drafts"

export const dynamic = "force-dynamic"

const str = (v: unknown, max: number) => typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null

const isPlayer = (who: string) => {
  const w = who.toLocaleLowerCase("cs")
  return DOC_PLAYERS.some(p => p.id.toLowerCase() === w || p.name.toLocaleLowerCase("cs") === w)
}

// GET /api/priprava/drafts — čekající návrhy importu a posledních 20 vyřízených
export async function GET(req: Request) {
  const { denied } = await requireAdminOrImport(req)
  if (denied) return denied
  try {
    return Response.json(await listDrafts())
  } catch (err) {
    console.error("[priprava/drafts GET]", err)
    return new Response("Server error", { status: 500 })
  }
}

// POST /api/priprava/drafts { title, source?, notes?, by?, texts, genders?, roles? }
// Uloží návrh importu ke schválení v Texty → Import. Nic nepřepíše.
// Vrací návrh a varování (např. neznámá jména v rodových značkách).
export async function POST(req: Request) {
  const { denied, via } = await requireAdminOrImport(req)
  if (denied) return denied
  try {
    const raw = await req.json().catch(() => null) as Record<string, unknown> | null
    const title = str(raw?.title, 120)
    if (!title) return new Response("Návrh potřebuje název (title)", { status: 400 })
    const parsed = parseImport(raw, DOC_IDS)
    if (!parsed.ok) return new Response(parsed.error, { status: 400 })
    const p = parsed.value
    if (p.texts.length + p.genders.length + p.roles.length === 0) return new Response("Návrh je prázdný", { status: 400 })
    const warnings = [...p.texts, ...p.roles].flatMap(t => {
      const where = "field" in t ? `${t.entityType}:${t.entityId}:${t.field}` : `role ${t.unitId}:${t.key}`
      return unknownGenderNames(t.body, isPlayer).map(n => `${where}: rodová značka s neznámým jménem „${n}“`)
    })
    const draft = await createDraft({
      title, source: str(raw?.source, 300), notes: str(raw?.notes, 4000), payload: p,
      by: str(raw?.by, 80) ?? (via === "import" ? "Claude" : null),
    })
    return Response.json({ draft: { id: draft.id, title: draft.title, createdAt: draft.createdAt }, counts: { texts: p.texts.length, genders: p.genders.length, roles: p.roles.length }, warnings }, { status: 201 })
  } catch (err) {
    console.error("[priprava/drafts POST]", err)
    return new Response("Server error", { status: 500 })
  }
}

// PATCH /api/priprava/drafts { id, status: "applied" | "discarded", by? } — jen Příprava
export async function PATCH(req: Request) {
  const denied = await requireAdmin(req)
  if (denied) return denied
  try {
    const raw = await req.json().catch(() => null) as Record<string, unknown> | null
    const id = Number(raw?.id)
    if (!Number.isInteger(id) || id < 1) return new Response("Neplatné id", { status: 400 })
    if (raw?.status !== "applied" && raw?.status !== "discarded") return new Response("Neplatný stav", { status: 400 })
    const ok = await resolveDraft(id, raw.status, str(raw.by, 80))
    if (!ok) return new Response("Návrh neexistuje nebo už je vyřízený", { status: 404 })
    return new Response(null, { status: 204 })
  } catch (err) {
    console.error("[priprava/drafts PATCH]", err)
    return new Response("Server error", { status: 500 })
  }
}
