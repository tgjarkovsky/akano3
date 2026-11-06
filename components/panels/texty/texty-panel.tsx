"use client"

import React, { useEffect, useState } from "react"
import type { DocEntityType } from "@/lib/doc-fields"
import { TextyProvider, type Category } from "./texty-data"
import { TextMatrix } from "./matrix"
import { TextEditor } from "./editor"
import { ImportPanel } from "./import-panel"

// Sekce Texty v Přípravě: přehled postupu (matice) a editor.
// Kde člověk je, se pamatuje v záložce prohlížeče.

type Place = { category: Category; open: { type: DocEntityType; id: string; field: string } | null; importing?: boolean }

const KEY = "akano_texty_place"

function readPlace(): Place {
  try {
    const p = JSON.parse(sessionStorage.getItem(KEY) ?? "null") as Place | null
    if (p && typeof p.category === "string") return p
  } catch { /* začni od přehledu */ }
  return { category: "character", open: null }
}

export function TextyPanel() {
  const [place, setPlace] = useState<Place>({ category: "character", open: null })
  useEffect(() => { setPlace(readPlace()) }, [])
  const update = (p: Place) => {
    setPlace(p)
    try { sessionStorage.setItem(KEY, JSON.stringify(p)) } catch { /* jen se nezapamatuje */ }
  }

  return (
    <TextyProvider>
      {place.importing ? (
        <ImportPanel onBack={() => update({ ...place, importing: false })} />
      ) : place.open ? (
        <TextEditor
          entityType={place.open.type} entityId={place.open.id} field={place.open.field}
          onSelect={(type, id, field) => update({ category: type, open: { type, id, field } })}
          onBack={() => update({ ...place, open: null })}
        />
      ) : (
        <TextMatrix
          category={place.category}
          onCategory={c => update({ category: c, open: null })}
          onOpen={(e, field) => update({ category: e.type, open: { type: e.type, id: e.id, field } })}
          onImport={() => update({ ...place, importing: true })}
        />
      )}
    </TextyProvider>
  )
}
