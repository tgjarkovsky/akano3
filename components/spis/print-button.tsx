"use client"

import { IconPrinter } from "@tabler/icons-react"

export function PrintButton({ label = "Vytisknout / uložit PDF" }: { label?: string }) {
  return (
    <button type="button" className="spis-btn spis-btn-primary" onClick={() => window.print()}>
      <IconPrinter size={18} /> {label}
    </button>
  )
}
