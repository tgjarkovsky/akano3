"use client"

import { useId } from "react"

// Pás s vlnami seigaiha (tradiční japonský geometrický vzor): bílá linka na
// petrolejové, jako vlny v logu. Manuál povoluje jeden japonský linkový vzor
// na vizuál, proto je jen na titulní straně spisu a na nástěnce. Je to
// geometrie v kódu, ne ilustrace; schválení od Aty zatím chybí.

const TEAL = "#14797C"
const WHITE = "#FFFFFF"
// Středy vln v dlaždici 40 × 20: dvě řady, spodní (vykreslená později) překrývá horní.
const CENTERS = [[0, 0], [40, 0], [20, 10], [0, 20], [40, 20], [20, 30]] as const
const RINGS = [19.5, 14.5, 9.5, 4.5]

export function SeigaihaBand() {
  const id = `seigaiha-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`
  return (
    <svg className="spis-band" aria-hidden="true" focusable="false">
      <defs>
        <pattern id={id} width="40" height="20" patternUnits="userSpaceOnUse" patternTransform="scale(0.7)">
          <rect width="40" height="20" fill={TEAL} />
          {CENTERS.map(([x, y]) => (
            <g key={`${x}-${y}`} stroke={WHITE} strokeWidth="1.4">
              {RINGS.map((r, i) => <circle key={r} cx={x} cy={y} r={r} fill={i === 0 ? TEAL : "none"} />)}
            </g>
          ))}
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill={`url(#${id})`} />
    </svg>
  )
}
