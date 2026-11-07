"use client"

import React, { useEffect, useId, useRef, useState } from "react"
import { IconX } from "@tabler/icons-react"

// Dlaždice s náhledem. Myš: náhled se ukáže při najetí a zmizí po odjetí
// (i z náhledu). Klepnutí nebo Enter: náhled zůstane otevřený, zavře ho
// křížek, Esc nebo klik jinam. U okraje okna se otevře doleva nebo nad dlaždici.
// Sdílí ji nástěnka (ostatní skupiny) i vztahy postavy.

export function PeekTile({ label, title, tile, children }: {
  /** malý nadpis náhledu, např. „Jednotka“ */
  label: string
  title: string
  /** obsah dlaždice (pod názvem) */
  tile: React.ReactNode
  /** obsah náhledu: první je podtitul pod názvem, zbytek pod čarou */
  children: { sub?: React.ReactNode; body: React.ReactNode }
}) {
  const [open, setOpen] = useState<"hover" | "pinned" | null>(null)
  const [alignRight, setAlignRight] = useState(false)
  const [above, setAbove] = useState(false)
  const [maxH, setMaxH] = useState<number | undefined>(undefined)
  const wrap = useRef<HTMLDivElement>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const id = useId()

  const place = () => {
    const r = wrap.current?.getBoundingClientRect()
    if (!r) return
    setAlignRight(r.left + 380 > window.innerWidth)
    const below = window.innerHeight - r.bottom, top = r.top
    const up = below < 320 && top > below
    setAbove(up)
    // Náhled nesmí přetéct z okna: výška nejvýš místo nad nebo pod dlaždicí.
    setMaxH(Math.max(160, (up ? top : below) - 12))
  }
  const clear = () => { if (timer.current) clearTimeout(timer.current); timer.current = null }
  const hoverIn = (ev: React.PointerEvent) => {
    if (ev.pointerType !== "mouse") return
    clear()
    if (open) return
    timer.current = setTimeout(() => { place(); setOpen("hover") }, 180)
  }
  const hoverOut = (ev: React.PointerEvent) => {
    if (ev.pointerType !== "mouse") return
    clear()
    setOpen(o => (o === "hover" ? null : o))
  }

  useEffect(() => {
    if (open !== "pinned") return
    const onKey = (ev: KeyboardEvent) => { if (ev.key === "Escape") setOpen(null) }
    const onDown = (ev: PointerEvent) => { if (!wrap.current?.contains(ev.target as Node)) setOpen(null) }
    document.addEventListener("keydown", onKey)
    document.addEventListener("pointerdown", onDown)
    return () => { document.removeEventListener("keydown", onKey); document.removeEventListener("pointerdown", onDown) }
  }, [open])
  useEffect(() => clear, [])

  return (
    <div ref={wrap} className="kn-peek-wrap" onPointerEnter={hoverIn} onPointerLeave={hoverOut}>
      <button type="button" className="kn-tile" aria-expanded={open !== null} aria-controls={id}
        onClick={() => { clear(); place(); setOpen(o => (o === "pinned" ? null : "pinned")) }}>
        <span className="kn-tile-title">{title}</span>
        {tile}
      </button>
      {open && (
        <div id={id} role="dialog" aria-label={`${label} ${title}`}
          className={`kn-peek${alignRight ? " kn-peek-right" : ""}${above ? " kn-peek-above" : ""}`}
          style={maxH ? { maxHeight: `min(${maxH}px, 520px)` } : undefined}>
          <div className="kn-peek-head">
            <div>
              <p className="spis-label">{label}</p>
              <p className="kn-peek-title">{title}</p>
              {children.sub}
            </div>
            <button type="button" className="kn-peek-close" aria-label="Zavřít náhled" onClick={() => setOpen(null)}>
              <IconX size={16} />
            </button>
          </div>
          {children.body}
        </div>
      )}
    </div>
  )
}
