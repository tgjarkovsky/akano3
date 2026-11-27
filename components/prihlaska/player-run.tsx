"use client"

import React, { useRef, useState } from "react"
import { PHOTO_MAX_BYTES } from "@/lib/cast"
import { MAIL_CONTACT } from "@/lib/mail-templates"

// Blok „Tvůj běh“ nad přihláškou: postava, stav platby a fotka hráče.
// Ukáže se jen po zveřejnění obsazení běhu (app/prihlaska/[token]/page.tsx).

export type PlayerRunInfo = {
  runName: string
  runDate?: string
  characterName: string
  motto?: string
  facts: [string, string][]
  paidAt: string | null
  photoAt: string | null
}

const MAX_SIDE = 800

/** Zmenší obrázek na nejvýš 800 px a převede na JPEG, ať je malý a bez EXIF. */
async function shrink(file: File): Promise<Blob> {
  const url = URL.createObjectURL(file)
  try {
    const img = await new Promise<HTMLImageElement>((ok, fail) => {
      const i = new Image()
      i.onload = () => ok(i)
      i.onerror = () => fail(new Error("Obrázek nejde otevřít. Zkus JPEG nebo PNG."))
      i.src = url
    })
    const scale = Math.min(1, MAX_SIDE / Math.max(img.naturalWidth, img.naturalHeight))
    const canvas = document.createElement("canvas")
    canvas.width = Math.round(img.naturalWidth * scale)
    canvas.height = Math.round(img.naturalHeight * scale)
    canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height)
    for (const q of [0.85, 0.7, 0.55]) {
      const blob = await new Promise<Blob | null>(ok => canvas.toBlob(ok, "image/jpeg", q))
      if (blob && blob.size <= PHOTO_MAX_BYTES) return blob
    }
    throw new Error("Fotka je i po zmenšení příliš velká.")
  } finally {
    URL.revokeObjectURL(url)
  }
}

export function PlayerRun({ token, info }: { token: string; info: PlayerRunInfo }) {
  const [photoAt, setPhotoAt] = useState(info.photoAt)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const input = useRef<HTMLInputElement>(null)
  const paid = info.paidAt && new Date(`${info.paidAt}T12:00:00`).toLocaleDateString("cs-CZ")

  const upload = async (file: File | undefined) => {
    if (!file) return
    setBusy(true); setError("")
    try {
      const blob = await shrink(file)
      const res = await fetch(`/api/prihlaska/${token}/foto`, { method: "PUT", headers: { "Content-Type": "image/jpeg" }, body: blob })
      if (!res.ok) throw new Error(await res.text() || "Fotku se nepodařilo nahrát.")
      setPhotoAt(new Date().toISOString())
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
      if (input.current) input.current.value = ""
    }
  }

  const remove = async () => {
    if (!window.confirm("Smazat nahranou fotku?")) return
    setBusy(true); setError("")
    try {
      const res = await fetch(`/api/prihlaska/${token}/foto`, { method: "DELETE" })
      if (!res.ok) throw new Error("Fotku se nepodařilo smazat.")
      setPhotoAt(null)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="pr-sheet pr-run" aria-labelledby="pr-run-title">
      <h2 style={{ fontSize: "1.5rem", marginBottom: 16 }}>Tvůj běh: {info.runName}{info.runDate ? `, ${info.runDate}` : ""}</h2>
      <div className="pr-run-grid">
        <div style={{ minWidth: 0 }}>
          <p className="pr-label">Tvoje postava</p>
          <h2 id="pr-run-title" style={{ fontSize: "2rem", margin: "4px 0 6px" }}>{info.characterName}</h2>
          {info.motto && <p className="pr-lead" style={{ fontStyle: "italic", margin: 0 }}>{info.motto}</p>}
          {info.facts.length > 0 && (
            <dl className="pr-run-facts">
              {info.facts.map(([k, v]) => <React.Fragment key={k}><dt>{k}</dt><dd>{v}</dd></React.Fragment>)}
            </dl>
          )}
          <p className="pr-label" style={{ marginTop: 18 }}>Platba</p>
          <p style={{ margin: "4px 0 0" }}>
            {paid
              ? <b>✓ Zaplaceno {paid}. Díky!</b>
              : <>Platbu zatím neevidujeme. Jestli už jsi zaplatil(a), napiš na <a href={`mailto:${MAIL_CONTACT}`}>{MAIL_CONTACT}</a>.</>}
          </p>
        </div>
        <div className="pr-run-photo">
          <p className="pr-label">Tvoje fotka</p>
          {photoAt
            // eslint-disable-next-line @next/next/no-img-element -- soukromá fotka přes tajný odkaz, bez optimalizace
            ? <img src={`/api/prihlaska/${token}/foto?v=${encodeURIComponent(photoAt)}`} alt="Tvoje fotka" />
            : <div className="pr-run-empty">Zatím bez fotky</div>}
          <p className="pr-hint" style={{ fontSize: "0.85rem" }}>
            Fotka obličeje, ať tě spoluhráči poznají. Uvidí ji organizátoři a hráči tvého běhu ve svých spisech.
          </p>
          <input ref={input} type="file" accept="image/*" hidden onChange={e => upload(e.target.files?.[0])} />
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
            <button type="button" className="pr-btn pr-btn-primary" disabled={busy} onClick={() => input.current?.click()}>
              {busy ? "Nahrávám…" : photoAt ? "Vyměnit fotku" : "Nahrát fotku"}
            </button>
            {photoAt && <button type="button" className="pr-btn" disabled={busy} onClick={remove}>Smazat</button>}
          </div>
          {error && <p role="alert" className="pr-warn" style={{ margin: "8px 0 0" }}>{error}</p>}
        </div>
      </div>
    </section>
  )
}
