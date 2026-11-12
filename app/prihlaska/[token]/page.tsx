import type { Metadata } from "next"
import { canEdit } from "@/lib/prihlaska"
import { getCatalog, getPrihlaskaByToken, isPrihlaskaToken } from "@/lib/prihlaska-store"
import { PrihlaskaForm } from "@/components/prihlaska/prihlaska-form"

// Úprava odeslané přihlášky přes tajný odkaz. Po konci přihlašování jen ke čtení.

export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: "Moje přihláška · Akano 3",
  robots: { index: false, follow: false },
  // tajný odkaz nesmí odejít v hlavičce Referer
  referrer: "no-referrer",
}

export default async function PrihlaskaEditPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const found = isPrihlaskaToken(token) ? await getPrihlaskaByToken(token) : null
  if (!found) {
    return (
      <main className="pr" style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div className="pr-sheet" style={{ maxWidth: 520, textAlign: "center" }}>
          <p className="pr-label">Akademie Akano</p>
          <h1 style={{ margin: "10px 0 14px", fontSize: "2rem" }}>Odkaz neplatí</h1>
          <p style={{ margin: 0 }}>Tahle přihláška neexistuje. Zkontroluj odkaz, nebo napiš organizátorům.</p>
        </div>
      </main>
    )
  }
  const catalog = await getCatalog()
  return <PrihlaskaForm catalog={catalog} initial={found.data} token={token} editable={canEdit()} />
}
