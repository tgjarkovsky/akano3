import { sql } from "@/lib/db"
import { requireAdmin } from "@/lib/admin-password"

export const dynamic = "force-dynamic"

// One-time migration: add runs table and run_id columns to all per-run tables.
// Safe to call multiple times (IF NOT EXISTS / WHERE run_id IS NULL).
export async function POST(req: Request) {
  const denied = await requireAdmin(req)
  if (denied) return denied

  try {
    await sql`
      CREATE TABLE IF NOT EXISTS runs (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        is_active BOOLEAN NOT NULL DEFAULT FALSE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `

    // Seed "Běh 1" only if table is empty
    await sql`
      INSERT INTO runs (name, is_active)
      SELECT 'Běh 1', TRUE
      WHERE NOT EXISTS (SELECT 1 FROM runs)
    `

    // Add run_id columns (idempotent)
    await sql`ALTER TABLE team_points     ADD COLUMN IF NOT EXISTS run_id INT`
    await sql`ALTER TABLE character_state ADD COLUMN IF NOT EXISTS run_id INT`
    await sql`ALTER TABLE alarm_state     ADD COLUMN IF NOT EXISTS run_id INT`
    await sql`ALTER TABLE game_config     ADD COLUMN IF NOT EXISTS run_id INT`
    await sql`ALTER TABLE circle_members  ADD COLUMN IF NOT EXISTS run_id INT`
    await sql`ALTER TABLE team_units      ADD COLUMN IF NOT EXISTS run_id INT`
    await sql`ALTER TABLE point_log       ADD COLUMN IF NOT EXISTS run_id INT`

    // Assign existing rows to run id=1
    await sql`UPDATE team_points     SET run_id = 1 WHERE run_id IS NULL`
    await sql`UPDATE character_state SET run_id = 1 WHERE run_id IS NULL`
    await sql`UPDATE alarm_state     SET run_id = 1 WHERE run_id IS NULL`
    await sql`UPDATE game_config     SET run_id = 1 WHERE run_id IS NULL`
    await sql`UPDATE circle_members  SET run_id = 1 WHERE run_id IS NULL`
    await sql`UPDATE team_units      SET run_id = 1 WHERE run_id IS NULL`
    await sql`UPDATE point_log       SET run_id = 1 WHERE run_id IS NULL`

    // Make columns NOT NULL
    await sql`ALTER TABLE team_points     ALTER COLUMN run_id SET NOT NULL`
    await sql`ALTER TABLE character_state ALTER COLUMN run_id SET NOT NULL`
    await sql`ALTER TABLE alarm_state     ALTER COLUMN run_id SET NOT NULL`
    await sql`ALTER TABLE game_config     ALTER COLUMN run_id SET NOT NULL`
    await sql`ALTER TABLE circle_members  ALTER COLUMN run_id SET NOT NULL`
    await sql`ALTER TABLE team_units      ALTER COLUMN run_id SET NOT NULL`
    await sql`ALTER TABLE point_log       ALTER COLUMN run_id SET NOT NULL`

    // Individual student points (team total is derived by summing members)
    await sql`
      CREATE TABLE IF NOT EXISTS character_points (
        character_id TEXT NOT NULL,
        run_id INT NOT NULL,
        points INT NOT NULL DEFAULT 0,
        PRIMARY KEY (character_id, run_id)
      )
    `
    // Point attribution now records the individual recipients too
    await sql`ALTER TABLE point_log ADD COLUMN IF NOT EXISTS resolved_character_ids TEXT[]`

    // alarm_state bývala singleton (id PK DEFAULT 1) — druhý běh se do ní nevešel.
    // Klíčem je teď run_id; doplň řádky běhům, které o ně kolizí přišly.
    await sql`ALTER TABLE alarm_state DROP CONSTRAINT IF EXISTS alarm_state_pkey`
    await sql`ALTER TABLE alarm_state DROP COLUMN IF EXISTS id`
    await sql`CREATE UNIQUE INDEX IF NOT EXISTS alarm_state_run_id_key ON alarm_state (run_id)`
    await sql`
      INSERT INTO alarm_state (run_id, active, type, message, color)
      SELECT id, false, 'evacuation', '', '#c0392b' FROM runs
      WHERE id NOT IN (SELECT run_id FROM alarm_state)
    `

    await sql`
      CREATE TABLE IF NOT EXISTS wiki_articles (
        id SERIAL PRIMARY KEY,
        slug TEXT UNIQUE NOT NULL,
        title TEXT NOT NULL,
        content TEXT NOT NULL,
        category TEXT NOT NULL DEFAULT 'Obecné',
        kaichi_required INTEGER NOT NULL DEFAULT 0,
        sort_order INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `

    await sql`
      CREATE TABLE IF NOT EXISTS wiki_links (
        id SERIAL PRIMARY KEY,
        from_slug TEXT NOT NULL,
        to_slug TEXT NOT NULL,
        label TEXT NOT NULL,
        kaichi_required INTEGER NOT NULL DEFAULT 0
      )
    `

    // Obsazení běhu: původ postavy a trojice A/B týmu v jednotce
    await sql`ALTER TABLE character_state ADD COLUMN IF NOT EXISTS origin TEXT`
    await sql`ALTER TABLE team_units      ADD COLUMN IF NOT EXISTS triplet TEXT`

    return Response.json({ ok: true, message: "Migrace dokončena" })
  } catch (err) {
    console.error("[migrate]", err)
    return new Response(String(err), { status: 500 })
  }
}
