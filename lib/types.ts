import type { CSSProperties, ComponentType } from "react"

export type Role = "gm" | "teacher" | "ruze" | "student" | "display" | "library"
export type Specialization = "combat" | "tactical" | "support"
// Původ podle evidence Shin Junkinu (článek knihovny „Původ“)
export type Origin = "mistni" | "pribuzni" | "cizi"
export type Triplet = "A" | "B"
export type ActionType =
  | "mission_success" | "mission_fail" | "lesson" | "shidosei"
  | "informant" | "monster" | "simulation" | "qr_quest"
  | "peer_gift" | "correction"

export interface Team {
  id: string; name: string; unitId: string
  memberIds: string[]; points: number; color: string
  /** Trojice v jednotce pro aktivní běh; undefined = ještě nepřiřazeno */
  triplet?: Triplet
}
export interface Character {
  id: string; code: string; name: string
  role: Role; teamId?: string; unitId?: string; circleIds: string[]
  specialization?: Specialization; origin?: Origin; kaichiLevel: number
  points: number; peerPointPool: number; lessonClaimedThisWindow: boolean
}
export interface Circle  { id: string; name: string; memberIds: string[] }
export interface Unit    { id: string; name: string; teamIds: [string, string] }
export interface PointEntry {
  id: string; timestamp: Date; sourceRole: Role
  sourceCharacterId: string; targetType: "team" | "unit" | "circle" | "student"
  targetId: string; resolvedTeamIds: string[]; resolvedCharacterIds?: string[]
  amount: number; actionType: ActionType; note?: string
}
export interface QRCode {
  id: string; token: string; label: string
  targetType: "team" | "unit" | "circle"; targetId: string
  points: number; validity: "once" | "timed" | "repeat"
  validUntil?: Date; timesScanned: number
  status: "active" | "expired" | "used"; createdAt: Date
}
export interface AlarmState {
  active: boolean
  type: "evacuation" | "battle" | "assembly" | "custom"
  message: string; color: string
}
export interface Toast { id: string; message: string; type: "success" | "error" | "info" }

export type TablerIcon = ComponentType<{ size?: number; color?: string; strokeWidth?: number; style?: CSSProperties }>

export interface RunSummary {
  id: number
  name: string
  isActive: boolean
  createdAt: Date
  /** YYYY-MM-DD; starší běhy ho mohou mít prázdný */
  startsOn: string | null
  endsOn: string | null
}

export interface WikiArticle {
  id: number
  slug: string
  title: string
  content: string
  category: string
  kaichiRequired: number
  sortOrder: number
  createdAt: Date
  updatedAt: Date
}

export interface WikiLink {
  fromSlug: string
  toSlug: string
  label: string | null // null = zamčeno
  locked: boolean
}

export interface WikiLinkAdmin {
  id: number
  fromSlug: string
  toSlug: string
  label: string
  kaichiRequired: number
}
