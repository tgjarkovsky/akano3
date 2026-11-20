"use client"

import { useEffect, useRef } from "react"

// Pozadí přihlášky ve stylu ukiyo-e: poryvy větru nesou rudé javorové listy,
// zlatá zrnka a plíšky zlaté fólie. Bez pohybu (prefers-reduced-motion)
// zůstane jediný nehybný snímek.

export function Backdrop() {
  return (
    <div className="pr-backdrop" aria-hidden="true">
      <WindCanvas />
    </div>
  )
}

const LEAF_REDS = ["#701010", "#8A1D18", "#A32B22", "#C24A3E"]

type Kind = "leaf" | "flake" | "grain"
type Bit = {
  kind: Kind; x: number; y: number; size: number; speed: number; fall: number
  spin: number; spinV: number; flip: number; flipV: number; phase: number
  color: string; corners?: number[]
}

// Javorový list: pět širokých zubatých laloků (spodní dva menší), v jednotkách ~1.
const LOBES: [number, number, number][] = [[-108, 0.62, 27], [-54, 0.92, 27], [0, 1, 27], [54, 0.92, 27], [108, 0.62, 27]]
const rad = (d: number) => ((d - 90) * Math.PI) / 180
const at = (deg: number, r: number) => [Math.cos(rad(deg)) * r, Math.sin(rad(deg)) * r] as const

function mapleLeaf(): Path2D {
  const p = new Path2D()
  p.moveTo(...at(-135, 0.3))
  for (const [a, L, h] of LOBES) {
    p.quadraticCurveTo(...at(a - h * 0.85, 0.5), ...at(a - h * 0.62, 0.74 * L))
    p.lineTo(...at(a - h * 0.42, 0.64 * L))
    p.lineTo(...at(a - h * 0.22, 0.86 * L))
    p.lineTo(...at(a, L))
    p.lineTo(...at(a + h * 0.22, 0.86 * L))
    p.lineTo(...at(a + h * 0.42, 0.64 * L))
    p.lineTo(...at(a + h * 0.62, 0.74 * L))
    p.quadraticCurveTo(...at(a + h * 0.85, 0.5), ...at(a + h, 0.36))
  }
  p.lineTo(...at(135, 0.3))
  p.quadraticCurveTo(0, 0.12, ...at(-135, 0.3))
  return p
}

/** Žilky do laloků a stopka. */
function mapleVeins(): Path2D {
  const p = new Path2D()
  for (const [a, L] of LOBES) { p.moveTo(0, 0.05); p.lineTo(...at(a, L * 0.85)) }
  p.moveTo(0, 0.05); p.lineTo(0.04, 0.62)
  return p
}

function WindCanvas() {
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = ref.current
    const ctx = canvas?.getContext("2d")
    if (!canvas || !ctx) return
    const leafPath = mapleLeaf()
    const veinPath = mapleVeins()
    const still = window.matchMedia("(prefers-reduced-motion: reduce)")
    const rnd = (a: number, b: number) => a + Math.random() * (b - a)
    let W = 0, H = 0, bits: Bit[] = [], raf = 0, last = 0, t = 0

    const make = (kind: Kind, anywhere: boolean): Bit => {
      const size = kind === "leaf" ? rnd(13, 24) : kind === "flake" ? rnd(3, 6.5) : rnd(0.8, 1.9)
      return {
        kind, size,
        x: anywhere ? rnd(0, W) : rnd(-60, -10),
        y: anywhere ? rnd(0, H) : rnd(-0.1 * H, H),
        speed: kind === "grain" ? rnd(0.7, 1.3) : rnd(0.5, 1),
        fall: kind === "leaf" ? rnd(14, 26) : kind === "flake" ? rnd(8, 16) : rnd(4, 10),
        spin: rnd(0, Math.PI * 2), spinV: rnd(-0.8, 0.8),
        flip: rnd(0, Math.PI * 2), flipV: rnd(1.2, 2.6) * (kind === "flake" ? 1.6 : 1),
        phase: rnd(0, Math.PI * 2),
        color: LEAF_REDS[Math.floor(Math.random() * LEAF_REDS.length)],
        corners: kind === "flake" ? [0, 1, 2, 3].map(() => rnd(0.6, 1.1)) : undefined,
      }
    }

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      W = window.innerWidth; H = window.innerHeight
      canvas.width = W * dpr; canvas.height = H * dpr
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      const area = W * H
      const n = (k: Kind, per: number, min: number, max: number) =>
        Array.from({ length: Math.round(Math.min(max, Math.max(min, area / per))) }, () => make(k, true))
      bits = [...n("leaf", 45000, 8, 34), ...n("flake", 65000, 6, 22), ...n("grain", 11000, 28, 120)]
    }

    // Vítr: slabý stálý vánek, jednou za čas poryv (náběh a dozvuk několik sekund).
    let gustAt = 4, gustLen = 5
    const wind = () => {
      if (t > gustAt + gustLen) { gustAt = t + rnd(7, 15); gustLen = rnd(4, 6.5) }
      const g = (t - gustAt) / gustLen
      const gust = g > 0 && g < 1 ? Math.sin(Math.PI * g) ** 2 : 0
      return { base: 22 + gust * 150, gust }
    }

    const drawCurls = (gust: number) => {
      if (gust < 0.05) return
      ctx.strokeStyle = `rgba(16,128,128,${0.28 * gust})`
      ctx.lineWidth = 1.3
      ctx.lineCap = "round"
      for (let i = 0; i < 3; i++) {
        const y = H * (0.22 + i * 0.27) + Math.sin(t * 0.7 + i) * 12
        const x = ((t * 260 + i * 420) % (W + 400)) - 200
        ctx.beginPath()
        ctx.moveTo(x - 160, y + 6)
        ctx.bezierCurveTo(x - 90, y - 14, x - 30, y + 12, x + 24, y)
        ctx.arc(x + 24, y - 9, 9, Math.PI / 2, Math.PI * 2.15, true)
        ctx.stroke()
      }
    }

    const frame = (now: number) => {
      const dt = last ? Math.min(0.05, (now - last) / 1000) : 1 / 60
      last = now; t += dt
      const { base, gust } = wind()
      ctx.clearRect(0, 0, W, H)
      drawCurls(gust)

      for (let i = 0; i < bits.length; i++) {
        const b = bits[i]
        const sway = Math.sin(t * 0.9 + b.phase)
        b.x += (base * b.speed + sway * 10) * dt
        b.y += (b.fall * (1 - gust * 0.6) + Math.cos(t * 1.3 + b.phase) * 8) * dt
        b.spin += (b.spinV + gust * 2.2 * Math.sign(b.spinV || 1)) * dt
        b.flip += b.flipV * (1 + gust * 1.5) * dt
        if (b.x > W + 40 || b.y > H + 40) { bits[i] = make(b.kind, false); continue }
        if (b.x < -80) b.x = W + 30

        if (b.kind === "grain") {
          const tw = 0.45 + 0.45 * Math.sin(t * 3 + b.phase)
          ctx.fillStyle = `rgba(201,156,104,${tw})`
          ctx.beginPath(); ctx.arc(b.x, b.y, b.size, 0, Math.PI * 2); ctx.fill()
          continue
        }

        const face = Math.cos(b.flip)
        ctx.save()
        ctx.translate(b.x, b.y)
        ctx.rotate(b.spin)
        ctx.scale(b.size * (0.18 + 0.82 * Math.abs(face)), b.size)
        if (b.kind === "leaf") {
          ctx.globalAlpha = 0.9
          ctx.fillStyle = b.color
          ctx.fill(leafPath)
          ctx.strokeStyle = "rgba(40,0,0,.35)"
          ctx.lineWidth = 0.05
          ctx.stroke(veinPath)
        } else {
          // Plíšek fólie se při otáčení zablýskne: světlý lícem, tmavší hranou.
          const lit = Math.abs(face)
          ctx.fillStyle = `rgb(${150 + lit * 98},${112 + lit * 100},${48 + lit * 92})`
          const c = b.corners!
          ctx.beginPath()
          ctx.moveTo(-c[0], -c[0] * 0.7); ctx.lineTo(c[1], -c[1] * 0.8)
          ctx.lineTo(c[2] * 0.9, c[2]); ctx.lineTo(-c[3], c[3] * 0.6)
          ctx.closePath(); ctx.fill()
        }
        ctx.restore()
      }
      ctx.globalAlpha = 1
      if (!still.matches && !document.hidden) raf = requestAnimationFrame(frame)
    }

    const start = () => {
      cancelAnimationFrame(raf); last = 0
      if (still.matches) { t = 0; frame(performance.now()); return }
      if (!document.hidden) raf = requestAnimationFrame(frame)
    }

    resize(); start()
    const onResize = () => { resize(); if (still.matches) frame(performance.now()) }
    window.addEventListener("resize", onResize)
    document.addEventListener("visibilitychange", start)
    still.addEventListener("change", start)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener("resize", onResize)
      document.removeEventListener("visibilitychange", start)
      still.removeEventListener("change", start)
    }
  }, [])

  return <canvas ref={ref} className="pr-wind" />
}
