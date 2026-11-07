import type { Metadata } from "next"
import { isSpisToken, forPlayer } from "@/lib/character-doc"
import { getSpisByToken } from "@/lib/spis-store"
import { SpisDocument } from "@/components/spis/spis-document"
import { Knihovna } from "@/components/spis/knihovna"

// Osobní knihovna a spis jedné postavy pro hráče. Odkaz je tajný a platí pro
// jeden běh; ukáže se, až ho organizátoři v Přípravě zveřejní. Na obrazovce je
// nástěnka s kartami, tisk vždy vytiskne celý spis.

export const dynamic = "force-dynamic"

// Titulek tiskne prohlížeč do záhlaví stránky a dává ho jako název PDF.
export async function generateMetadata({ params }: { params: Promise<{ token: string }> }): Promise<Metadata> {
  const { token } = await params
  const found = isSpisToken(token) ? await getSpisByToken(token) : null
  const name = found?.state === "ok" ? found.doc.character.name : undefined
  return {
    title: ["Akademie Akano", "Osobní spis", name].filter(Boolean).join(" · "),
    robots: { index: false, follow: false },
    // tajný odkaz nesmí odejít v hlavičce Referer
    referrer: "no-referrer",
  }
}

// Čísla stránek jen u jednoho spisu; při hromadném tisku by běžela přes všechny.
const PAGE_NUMBERS = `@media print {
  @page { @bottom-center { content: counter(page); font: 9pt serif; color: #5a534b; } }
  @page :first { @bottom-center { content: none; } }
}`

export default async function SpisPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const found = isSpisToken(token) ? await getSpisByToken(token) : { state: "missing" as const }

  if (found.state !== "ok") {
    return (
      <main className="spis-screen" style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div className="spis-sheet spis" style={{ maxWidth: 520, textAlign: "center", marginTop: 48 }}>
          <p className="spis-label">Akademie Akano</p>
          <h1 className="spis-chapter-title" style={{ margin: "10px 0 14px" }}>
            {found.state === "unpublished" ? "Spis se připravuje" : "Odkaz neplatí"}
          </h1>
          <p style={{ margin: 0 }}>
            {found.state === "unpublished"
              ? `Spis${found.name ? ` postavy ${found.name}` : ""} ještě není zveřejněný. Až ho organizátoři uvolní, najdeš ho na tomhle odkazu.`
              : "Tenhle odkaz na spis neexistuje nebo byl nahrazený novým. Napiš organizátorům."}
          </p>
        </div>
      </main>
    )
  }

  const doc = forPlayer(found.doc)
  return (
    <main className="spis-screen">
      <style>{PAGE_NUMBERS}</style>
      <div className="no-print">
        <Knihovna doc={doc} academy={found.academy} />
      </div>
      <div className="spis-print-only">
        <div className="spis-sheet">
          <SpisDocument doc={doc} />
        </div>
      </div>
    </main>
  )
}
