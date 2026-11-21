// Stav „žádný aktivní běh“: mimo hraní (příprava v lednu) není aktivní žádný běh.
// Čistá logika bez databáze, ať jde testovat.

export const NO_ACTIVE_RUN = "Teď se nehraje žádný běh"

/** Odpověď herního zápisu (body, alarm, lekce, dary, kaichi…), když se nehraje. */
export const noActiveRun = () => new Response(NO_ACTIVE_RUN, { status: 409 })

/** Stav hry pro /api/game-state, když není aktivní žádný běh: výchozí, prázdný. */
export function idleGameState(runs: unknown[]) {
  return {
    activeRunId: null,
    runs,
    alarm: { active: false, type: "evacuation", message: "", color: "#c0392b" },
    config: { lesson_window_active: false, lesson_window_end: null },
    characterPoints: [],
    charState: [],
    circleMembers: [],
    teamUnits: [],
    pointLog: [],
    qrCodes: [],
  }
}

/** Z čeho nový běh přebírá rozvržení: aktivní běh, bez něj poslední založený. */
export function templateRunId(runs: { id: number; isActive: boolean; createdAt?: Date | string | null }[]): number | null {
  const active = runs.find(r => r.isActive)
  if (active) return active.id
  const time = (r: (typeof runs)[number]) => (r.createdAt ? new Date(r.createdAt).getTime() : 0)
  const last = [...runs].sort((a, b) => time(b) - time(a) || b.id - a.id)[0]
  return last?.id ?? null
}
