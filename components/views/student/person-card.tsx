"use client"

import type { ReactNode } from "react"
import { IconUser } from "@tabler/icons-react"

interface PersonCardProps {
  name: string
  isYou?: boolean
  badge: ReactNode
  /** dospělí: bez přezdívky a bez minWidth:0 na textovém bloku */
  compact?: boolean
}

export function PersonCard({ name, isYou, badge, compact }: PersonCardProps) {
  return (
    <div style={{ display:"flex", alignItems:"center", gap:12, backgroundColor:"var(--c-bg-card)", borderRadius:6, padding:"12px 16px", border: isYou ? "2px solid rgba(16,128,128,0.45)" : "2px solid var(--c-border-mid)", boxShadow:"var(--shadow-print-sm)", }}>
      <div style={{ width:40, height:40, borderRadius:"50%", flexShrink:0, backgroundColor: isYou ? "rgba(16,128,128,0.1)" : "var(--c-bg-section)", display:"flex", alignItems:"center", justifyContent:"center", }}>
        <IconUser size={20} color={isYou ? "var(--c-teal)" : "var(--c-text-muted)"} />
      </div>
      {compact ? (
        <div style={{ flex:1 }}><span style={{ fontWeight:700, fontSize:"0.95rem", color:"var(--c-text)" }}>{name}</span>        </div>
      ) : (
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ display:"flex", alignItems:"center", gap:6 }}>
            <span style={{ fontWeight:700, fontSize:"0.95rem", color:"var(--c-text)" }}>{name}</span>
            {isYou && <span style={{ fontSize:"0.65rem", color:"var(--c-teal)", backgroundColor:"rgba(16,128,128,0.1)", padding:"1px 7px", borderRadius:20 }}>ty</span>}
          </div>
        </div>
      )}
      {badge}
    </div>
  )
}