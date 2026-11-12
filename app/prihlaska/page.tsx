import type { Metadata } from "next"
import { getCatalog } from "@/lib/prihlaska-store"
import { PrihlaskaForm } from "@/components/prihlaska/prihlaska-form"

// Veřejná přihláška na hru. Medailonky se čtou z Přípravy → Texty.

export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: "Přihláška · Akano 3",
  description: "Přihláška na larp Akano 3 a výběr postavy.",
}

export default async function PrihlaskaPage() {
  const catalog = await getCatalog()
  return <PrihlaskaForm catalog={catalog} />
}
