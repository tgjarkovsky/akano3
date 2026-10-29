"use client"

import React, { useMemo } from "react"
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip as RechartsTooltip, ResponsiveContainer,
} from "recharts"
import { IconShield } from "@tabler/icons-react"
import { useGame } from "@/lib/game-context"
import { teamTimeline, formatTimeOnly } from "@/lib/team-timeline"
import { TEAM_ICONS } from "@/lib/data"
import type { Team } from "@/lib/types"

function EndLabel({ cx, cy, index, lastIndex, team }: {
  cx?: number; cy?: number; index?: number; lastIndex: number; team: Team
}) {
  if (index !== lastIndex || cx == null || cy == null) return null
  const Icon = TEAM_ICONS[team.id] ?? IconShield
  return (
    <g transform={`translate(${cx + 8}, ${cy - 9})`}>
      <Icon size={18} color={team.color} strokeWidth={2} />
      <text x={22} y={9} fill={team.color} fontSize={13} fontWeight={600} fontFamily="monospace" dominantBaseline="middle">
        {team.name}
      </text>
    </g>
  )
}

export function ChartsPanel({ singleTeamId }: { singleTeamId?: string }) {
  const { teams, pointLog } = useGame()

  const timeData = useMemo(() => teamTimeline(teams, pointLog), [teams, pointLog])

  const displayTeams = singleTeamId ? teams.filter(t => t.id === singleTeamId) : teams
  const lastIndex = timeData.length - 1

  return (
    <div>
      <div style={{
        backgroundColor:"var(--c-bg-section)", border:"1px solid var(--c-border)",
        borderRadius:10, padding:20, marginBottom:20,
      }}>
        <p style={{ color:"var(--c-accent)", fontSize:"0.8rem", letterSpacing:"0.08em", marginBottom:16 }}>VÝVOJ BODŮ V ČASE</p>
        <ResponsiveContainer width="100%" height={320}>
          <LineChart data={timeData} margin={{ top: 10, right: 160, bottom: 40, left: 10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--c-border)" />
            <XAxis
              dataKey="time"
              tick={{ fill:"var(--c-text-muted)", fontSize:12, fontFamily:"monospace" }}
              angle={-40}
              textAnchor="end"
              interval={Math.max(0, Math.floor(timeData.length / 6))}
              tickFormatter={formatTimeOnly}
              height={60}
            />
            <YAxis
              tick={{ fill:"var(--c-text-muted)", fontSize:13, fontFamily:"monospace" }}
              width={45}
              tickLine={false}
              domain={["auto", "auto"]}
            />
            <RechartsTooltip
              contentStyle={{ backgroundColor:"var(--c-bg-card)", border:"1px solid var(--c-border-mid)", color:"var(--c-text)", fontSize:13 }}
            />
            {displayTeams.map(t => (
              <Line key={t.id} type="monotone" dataKey={t.id} name={t.name}
                stroke={t.color} strokeWidth={3}
                dot={(props: any) => <EndLabel {...props} lastIndex={lastIndex} team={t} />}
                activeDot={{ r: 5, stroke: t.color, fill: t.color }}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
