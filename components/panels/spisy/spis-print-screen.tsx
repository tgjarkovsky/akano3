"use client"

import React, { useEffect, useState } from "react"
import { IconArrowLeft } from "@tabler/icons-react"
import { adminFetch } from "@/lib/admin-client"
import type { CharacterDoc } from "@/lib/character-doc"
import { SpisDocument } from "@/components/spis/spis-document"
import { PrintButton } from "@/components/spis/print-button"
import type { PrintJob } from "./spisy-panel"

// Náhled a tisk spisů z Přípravy. Nahradí celé rozhraní Přípravy, takže se
// tiskne jen papír. Každý spis začíná na nové stránce.

export function SpisPrintScreen({ job, onClose }: { job: PrintJob; onClose: () => void }) {
  const [docs, setDocs] = useState<CharacterDoc[] | null>(null)
  const [error, setError] = useState("")

  useEffect(() => {
    let cancelled = false
    const q = `run=${job.runId}${job.characterId ? `&character=${encodeURIComponent(job.characterId)}` : ""}`
    adminFetch(`/api/priprava/spisy/doc?${q}`)
      .then(async r => r.ok ? r.json() : Promise.reject(new Error(await r.text())))
      .then(d => { if (!cancelled) setDocs(d) })
      .catch(e => { if (!cancelled) setError(e?.message || "Spisy se nenačetly.") })
    return () => { cancelled = true }
  }, [job])

  useEffect(() => { window.scrollTo(0, 0) }, [])

  // Titulek jde do záhlaví tisku a do názvu PDF.
  useEffect(() => {
    const prev = document.title
    const who = job.characterId ? docs?.[0]?.character.name : "Spisy běhu"
    document.title = ["Akademie Akano", "Osobní spis", who].filter(Boolean).join(" · ")
    return () => { document.title = prev }
  }, [docs, job.characterId])

  const title = docs && (job.characterId ? `Spis · ${docs[0]?.character.name ?? ""}` : `Spisy běhu · ${docs.length} postav`)

  return (
    <main className="spis-screen">
      <div className="spis-toolbar">
        <button type="button" className="spis-btn" onClick={onClose}><IconArrowLeft size={18} /> Zpět do Přípravy</button>
        <span className="spis-toolbar-title">{title ?? "Načítám…"}</span>
        {docs && docs.length > 0 && <PrintButton label={job.characterId ? "Vytisknout / uložit PDF" : `Vytisknout všech ${docs.length}`} />}
      </div>
      <p className="spis-hint">
        Náhled ukazuje i neschválené texty se žlutou poznámkou; ta se netiskne.
        {docs && docs[0] && <> Běh: {docs[0].runName}{docs[0].runDate ? `, ${docs[0].runDate}` : " (bez termínu, doplň ho v Obsazení)"}.</>}
      </p>
      {error && <p className="spis-hint" role="alert" style={{ color: "#a40000" }}>{error}</p>}
      {docs?.map(d => (
        <div key={d.character.id} className="spis-sheet">
          <SpisDocument doc={d} showStatus />
        </div>
      ))}
    </main>
  )
}
