"use client"

import React, { useEffect, useState } from "react"
import Image from "next/image"
import { useRouter } from "next/navigation"
import { IconUser, IconCircleX, IconPlayerPause } from "@tabler/icons-react"
import { Button, buttonVariants } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Separator } from "@/components/ui/separator"
import { useGame } from "@/lib/game-context"
import { NO_ACTIVE_RUN } from "@/lib/run-status"

/** Hraje se? null = ještě nevíme. Při chybě sítě přihlášení nezamykáme, hru hlídá i server. */
function usePlaying(): boolean | null {
  const [playing, setPlaying] = useState<boolean | null>(null)
  useEffect(() => {
    let cancelled = false
    const check = () => fetch("/api/runs")
      .then(r => r.ok ? r.json() : Promise.reject())
      .then((runs: { is_active: boolean }[]) => { if (!cancelled) setPlaying(runs.some(r => r.is_active)) })
      .catch(() => { if (!cancelled) setPlaying(p => p ?? true) })
    check()
    // Až organizátoři spustí běh, otevře se přihlášení samo.
    const t = setInterval(check, 10000)
    return () => { cancelled = true; clearInterval(t) }
  }, [])
  return playing
}

export function LoginScreen() {
  const { login } = useGame()
  const router = useRouter()
  const [code,    setCode]    = useState("")
  const [error,   setError]   = useState("")
  const [loading, setLoading] = useState(false)
  const playing = usePlaying()

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!code.trim()) return
    setLoading(true)
    setTimeout(() => {
      const char = login(code)
      if (!char) {
        setError("Neplatný kód. Zkontroluj zápis a zkus znovu.")
        setLoading(false)
      } else {
        router.push(`/character/${char.id}`)
      }
    }, 400)
  }

  return (
    <div className="dark" style={{
      minHeight:"100vh", display:"flex", alignItems:"center", justifyContent:"center",
      backgroundColor:"#3A0808",   // DS flat oxblood night ground — bold poster, no pastel
      padding:24,
    }}>
      <div style={{ position:"absolute", inset:0, overflow:"hidden", pointerEvents:"none" }}>
        {[10,25,75,90].map(pct => (
          <div key={pct} style={{
            position:"absolute", top:0, bottom:0, left:`${pct}%`,
            width:1, background:"linear-gradient(to bottom, transparent, rgba(244,236,223,0.06), transparent)",
          }} />
        ))}
      </div>

      <div style={{ width:"100%", maxWidth:400, position:"relative", zIndex:1 }}>
        <div style={{ display:"flex", justifyContent:"center", marginBottom:20 }}>
          <Image
            src="/logo.png" alt="AKANO"
            width={520} height={640}
            style={{ objectFit:"contain", width:"auto", height:96, userSelect:"none" }}
            priority
          />
        </div>

        <div style={{
          backgroundColor:"var(--c-bg-card)",
          border:"2px solid var(--c-border-mid)", borderRadius:"var(--radius)",
          padding:32, boxShadow:"var(--shadow-print-lg)",
        }}>
          {playing === null ? (
            <p style={{ color:"var(--c-text-muted)", fontSize:"0.85rem", textAlign:"center", margin:0 }}>Načítám…</p>
          ) : !playing ? (
            <div role="status" style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:12, textAlign:"center" }}>
              <IconPlayerPause size={36} color="var(--c-text-muted)" aria-hidden />
              <h2 className="ds-label" style={{ color:"var(--c-text)", fontSize:"1.15rem", margin:0 }}>{NO_ACTIVE_RUN}</h2>
              <p style={{ color:"var(--c-text-muted)", fontSize:"0.85rem", lineHeight:1.5, margin:0 }}>
                Přihlášení kódem postavy se otevře, až organizátoři spustí běh.
              </p>
              <Separator style={{ margin:"8px 0" }} />
              <p style={{ color:"rgba(244,236,223,0.6)", fontSize:"0.8rem", margin:0 }}>Chceš hrát na dalším běhu?</p>
              <a href="/prihlaska" className={buttonVariants()} style={{ width:"100%" }}>Přihláška na hru</a>
            </div>
          ) : (<>
          <h2 className="ds-label" style={{ color:"var(--c-text)", fontSize:"1.15rem", marginBottom:6, textAlign:"center" }}>
            Přihlášení
          </h2>
          <p style={{ color:"var(--c-text-muted)", fontSize:"0.8rem", textAlign:"center", marginBottom:24 }}>
            Zadej svůj kód postavy
          </p>

          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom:16 }}>
              <Label htmlFor="code" className="ds-label" style={{ color:"var(--c-accent)", fontSize:"0.75rem" }}>
                Kód postavy
              </Label>
              <Input
                id="code"
                value={code}
                onChange={e => { setCode(e.target.value); setError("") }}
                placeholder="např. GM-001, STU-007, SCREEN-A"
                autoFocus
                autoComplete="off"
                style={{
                  marginTop:6,
                  letterSpacing:"0.1em",
                  fontFamily:"var(--font-mono)",
                  fontSize:"1rem",
                  color:"var(--c-text)",
                }}
              />
            </div>

            {error && (
              <Alert variant="destructive" style={{ marginBottom:16, color:"#E0897D" }}>
                <IconCircleX size={14} />
                <AlertDescription style={{ color:"#E0897D" }}>{error}</AlertDescription>
              </Alert>
            )}

            <Button
              type="submit"
              disabled={loading || !code.trim()}
              style={{ width:"100%" }}
            >
              {loading ? "Ověřuji…" : "Vstoupit"}
            </Button>
          </form>

          <Separator style={{ margin:"20px 0" }} />

          <p style={{ color:"rgba(244,236,223,0.6)", fontSize:"0.72rem", textAlign:"center" }}>
            <IconUser size={11} style={{ display:"inline", marginRight:4 }} />
            Kód ti dá organizátor
          </p>

          <div style={{ marginTop:16, padding:12, backgroundColor:"var(--c-bg-section)", borderRadius:"var(--radius)", border:"1px solid var(--c-border)" }}>
            <p className="ds-overline" style={{ color:"rgba(244,236,223,0.6)", fontSize:"0.62rem", marginBottom:8 }}>
              Demo kódy
            </p>
            <div style={{ display:"flex", flexWrap:"wrap", gap:6 }}>
              {[
                ["GM-001","GM"], ["TCH-001","Učitel"], ["STU-007","Student"],
                ["SCREEN-A","Display"], ["RUZE-001","Růže"], ["KNIHOVNA","Knihovna"],
              ].map(([c, label]) => (
                <button key={c} onClick={() => setCode(c)} style={{
                  backgroundColor:"var(--c-bg-section)", border:"1px solid var(--c-border-mid)",
                  color:"var(--c-accent)", padding:"2px 8px", borderRadius:4,
                  fontSize:"0.7rem", cursor:"pointer", fontFamily:"var(--font-mono)",
                }}>
                  {c} <span style={{ opacity:.6 }}>({label})</span>
                </button>
              ))}
            </div>
          </div>
          </>)}
        </div>
      </div>
    </div>
  )
}
