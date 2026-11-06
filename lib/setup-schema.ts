import { sql } from "@/lib/db"

// Sloupce pro obsazení běhu, které přibyly po první migraci. Doplní se samy
// při prvním dotazu (a taky v /api/admin/migrate), aby nová verze fungovala
// hned po nasazení bez ručního spouštění migrace.

let ready: Promise<void> | null = null

export function ensureSetupColumns(): Promise<void> {
  ready ??= (async () => {
    const rows = await sql`
      SELECT table_name, column_name FROM information_schema.columns
      WHERE (table_name = 'character_state' AND column_name = 'origin')
         OR (table_name = 'team_units' AND column_name = 'triplet')
    `
    const has = (t: string, c: string) => rows.some(r => r.table_name === t && r.column_name === c)
    if (!has("character_state", "origin")) await sql`ALTER TABLE character_state ADD COLUMN IF NOT EXISTS origin TEXT`
    if (!has("team_units", "triplet"))     await sql`ALTER TABLE team_units ADD COLUMN IF NOT EXISTS triplet TEXT`
  })().catch(err => { ready = null; throw err })
  return ready
}
