import { requireAdminOrImport } from "@/lib/admin-password"
import { TEAMS, UNITS, CIRCLES } from "@/lib/data"
import { DOC_FIELDS } from "@/lib/doc-fields"
import { DOC_PLAYERS, TRAIT_ENTITIES } from "@/lib/doc-ids"
import { getOverview } from "@/lib/docs-store"

export const dynamic = "force-dynamic"

const nameOf = (id: string) => DOC_PLAYERS.find(c => c.id === id)?.name ?? id

const GUIDE = [
  "Import: texty se posílají jako návrh (POST /api/priprava/drafts), Příprava je potvrdí v Texty → Import.",
  "Pole a jejich význam viz fields; texty jsou markdown (## nadpis, ### jméno ve vztazích, > citát, - odrážky).",
  "Rodové značky: {byl|byla} = rod čtenáře spisu (ve sdíleném textu týmu, jednotky či kruhu taky čtenář);",
  "{Skála: byl|byla} = rod jmenované postavy (jméno z characters nebo id). Mužský tvar první.",
  "Jen změněná část slova: přiš{el|la}, člen{|ka}, vysmál{|a}. Bez známého rodu se ukáže byl/byla.",
  "Role v textu: {@ctitel} = jméno držitele role v běhu (klíč z roles, v jednotce textu; bez držitele název role);",
  "{@ctitel: zranil|zranila} = rod držitele role.",
  "Rod postavy, kterou dokument jasně určuje, patří do genders; jinak ho nevyplňuj.",
  "Role jednotek se posílají v roles (unitId, triplet A/B, key, nameM, nameF, body); existující role se pozná podle jednotky a klíče.",
].join("\n")

// GET /api/priprava/catalog — entity, pole, role a rody pro přípravu importu
// (čte i token importu). Bez těl textů; ta vrací GET /api/priprava/texts?entityType=&entityId=.
export async function GET(req: Request) {
  const { denied } = await requireAdminOrImport(req)
  if (denied) return denied
  try {
    const overview = await getOverview()
    return Response.json({
      guide: GUIDE,
      fields: Object.fromEntries(Object.entries(DOC_FIELDS).map(([type, fs]) => [type, fs.map(f => ({ key: f.key, label: f.label, hint: f.hint, visibility: f.visibility }))])),
      characters: DOC_PLAYERS.map(c => ({ id: c.id, name: c.name, team: TEAMS.find(t => t.memberIds.includes(c.id))?.id ?? null, gender: overview.genders[c.id] ?? null })),
      teams: TEAMS.map(t => ({ id: t.id, name: t.name, members: t.memberIds.map(nameOf) })),
      units: UNITS.map(u => ({ id: u.id, name: u.name })),
      circles: CIRCLES.map(c => ({ id: c.id, name: c.name })),
      traits: TRAIT_ENTITIES,
      roles: overview.roles,
      texts: overview.texts.map(t => ({ entityType: t.entityType, entityId: t.entityId, field: t.field, length: t.length, status: t.status, version: t.version })),
    })
  } catch (err) {
    console.error("[priprava/catalog GET]", err)
    return new Response("Server error", { status: 500 })
  }
}
