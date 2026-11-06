"use client"

import React from "react"
import { TooltipProvider } from "@/components/ui/tooltip"
import { usePathname } from "next/navigation"
import { GameProvider } from "@/lib/game-context"

class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { error: Error | null }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props)
    this.state = { error: null }
  }
  static getDerivedStateFromError(error: Error) { return { error } }
  render() {
    if (this.state.error) {
      return (
        <div style={{
          minHeight:"100vh", display:"flex", flexDirection:"column", alignItems:"center",
          justifyContent:"center", backgroundColor:"#F4ECDF", color:"#701010",
          gap:16, padding:32,
        }}>
          <p style={{ fontWeight:700, fontSize:"1.1rem" }}>Nastala neočekávaná chyba</p>
          <pre style={{ fontSize:"0.75rem", opacity:0.6, maxWidth:480, whiteSpace:"pre-wrap", wordBreak:"break-word" }}>
            {(this.state.error as Error).message}
          </pre>
          <button onClick={() => this.setState({ error: null })} style={{
            padding:"8px 20px", backgroundColor:"#701010", color:"#F4ECDF",
            border:"none", borderRadius:6, cursor:"pointer",
          }}>
            Zkusit znovu
          </button>
        </div>
      )
    }
    return this.props.children
  }
}

export function Providers({ children }: { children: React.ReactNode }) {
  // Spis hráče nepotřebuje stav hry, nemá se proto každé 2 s ptát serveru.
  const pathname = usePathname()
  if (pathname?.startsWith("/spis/")) return <ErrorBoundary>{children}</ErrorBoundary>
  return (
    <ErrorBoundary>
      <TooltipProvider>
        <GameProvider>{children}</GameProvider>
      </TooltipProvider>
    </ErrorBoundary>
  )
}
