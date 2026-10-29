"use client"

import React, { useState } from "react"
import { IconPlus } from "@tabler/icons-react"
import { TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { PointAssignmentForm } from "@/components/panels/point-assignment"

export function PointAssignmentSheet({ canCorrect }: { canCorrect?: boolean }) {
  const [sheetOpen, setSheetOpen] = useState(false)
  return (
    <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
      <SheetTrigger
        render={<button />}
        style={{ backgroundColor:"var(--c-teal)", color:"#F4ECDF", fontWeight:700,
          padding:"8px 16px", borderRadius:6, border:"none", cursor:"pointer",
          display:"flex", alignItems:"center", gap:6, fontSize:"0.875rem" }}
      >
        <IconPlus size={16} /> Zadat body
      </SheetTrigger>
      <SheetContent style={{ backgroundColor:"var(--c-bg)", borderLeft:"1px solid var(--c-border)", minWidth:380 }}>
        <SheetHeader>
          <SheetTitle style={{ color:"var(--c-text)" }}>Zadat body</SheetTitle>
        </SheetHeader>
        <div style={{ marginTop:20 }}>
          <PointAssignmentForm onClose={() => setSheetOpen(false)} canCorrect={canCorrect} />
        </div>
      </SheetContent>
    </Sheet>
  )
}

export type DashboardTab = { value: string; label: string; Icon: React.ElementType }

export function DashboardTabsList({ tabs, wrap }: { tabs: DashboardTab[]; wrap?: boolean }) {
  return (
    <TabsList style={{ backgroundColor:"var(--c-bg-section)", border:"1px solid var(--c-border)",
      marginBottom:20, ...(wrap && { flexWrap:"wrap", height:"auto", gap:2 }) }}>
      {tabs.map(({ value, label, Icon }) => (
        <TabsTrigger key={value} value={value}
          style={{ color:"var(--c-text-muted)", fontSize:"0.8rem", display:"flex", alignItems:"center", gap:5 }}>
          <Icon size={13} />
          {label}
        </TabsTrigger>
      ))}
    </TabsList>
  )
}

export function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ backgroundColor:"var(--c-bg-section)", border:"1px solid var(--c-border)", borderRadius:10, padding:20 }}>
      <p style={{ color:"var(--c-accent)", fontSize:"0.8rem", letterSpacing:"0.08em", marginBottom:12 }}>{title}</p>
      {children}
    </div>
  )
}
