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
         OR (table_name = 'runs' AND column_name IN ('starts_on', 'ends_on'))
    `
    const has = (t: string, c: string) => rows.some(r => r.table_name === t && r.column_name === c)
    if (!has("character_state", "origin")) await sql`ALTER TABLE character_state ADD COLUMN IF NOT EXISTS origin TEXT`
    if (!has("team_units", "triplet"))     await sql`ALTER TABLE team_units ADD COLUMN IF NOT EXISTS triplet TEXT`
    // Termín běhu (vždy vícedenní). Starší běhy ho mohou mít prázdný, než ho někdo doplní.
    if (!has("runs", "starts_on"))         await sql`ALTER TABLE runs ADD COLUMN IF NOT EXISTS starts_on DATE`
    if (!has("runs", "ends_on"))           await sql`ALTER TABLE runs ADD COLUMN IF NOT EXISTS ends_on DATE`
    await ensureRunKeys()
    // Pravidla obsazení (lib/assignment-rules.ts) platí ve všech bězích, proto bez run_id.
    await sql`
      CREATE TABLE IF NOT EXISTS assignment_rules (
        subject_type TEXT NOT NULL,
        subject_id   TEXT NOT NULL,
        property     TEXT NOT NULL,
        allowed      TEXT[] NOT NULL,
        updated_by   TEXT,
        updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        PRIMARY KEY (subject_type, subject_id, property)
      )
    `
    // Rozdělení rolí jednotek v běhu (lib/role-holders.ts). Pevné role z Pravidel sem nepatří.
    await sql`
      CREATE TABLE IF NOT EXISTS role_holders (
        run_id       INT  NOT NULL,
        role_id      INT  NOT NULL,
        character_id TEXT NOT NULL,
        updated_by   TEXT,
        updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        PRIMARY KEY (run_id, role_id),
        UNIQUE (run_id, character_id)
      )
    `
  })().catch(err => { ready = null; throw err })
  return ready
}

// Tabulky běhu vznikly bez run_id v klíči, takže druhý běh se do nich nevešel
// a založení běhu (POST /api/runs) padalo na duplicitě. Klíč dostane run_id;
// game_config byla singleton (id = 1) a jako alarm_state ji klíčuje run_id.
const RUN_KEYS: [table: string, columns: string][] = [
  ["character_state", "run_id, character_id"],
  ["team_units", "run_id, team_id"],
  ["circle_members", "run_id, circle_id, character_id"],
  ["team_points", "run_id, team_id"],
]

async function ensureRunKeys(): Promise<void> {
  const keys = await sql`
    SELECT t.relname AS table_name, pg_get_constraintdef(c.oid) AS def
    FROM pg_constraint c JOIN pg_class t ON t.oid = c.conrelid
    WHERE c.contype = 'p' AND t.relname IN ('character_state', 'team_units', 'circle_members', 'team_points', 'game_config')
  `
  const keyOf = (t: string) => keys.find(k => k.table_name === t)?.def as string | undefined
  for (const [table, columns] of RUN_KEYS) {
    const def = keyOf(table)
    if (def?.includes("run_id")) continue
    // Názvy tabulek a sloupců jsou pevné konstanty výše, ne vstup.
    await sql.transaction([
      sql.query(`ALTER TABLE ${table} DROP CONSTRAINT IF EXISTS ${table}_pkey`),
      sql.query(`ALTER TABLE ${table} ADD PRIMARY KEY (${columns})`),
    ])
  }
  if (keyOf("game_config")) {
    await sql.transaction([
      sql`ALTER TABLE game_config DROP CONSTRAINT IF EXISTS game_config_pkey`,
      sql`ALTER TABLE game_config DROP COLUMN IF EXISTS id`,
      sql`CREATE UNIQUE INDEX IF NOT EXISTS game_config_run_id_key ON game_config (run_id)`,
    ])
  }
  // Běhy, které kvůli kolizím přišly o výchozí řádky, je dostanou (bez kopírování obsazení).
  await sql`
    INSERT INTO game_config (run_id, lesson_window_active, lesson_window_end)
    SELECT id, false, null FROM runs WHERE id NOT IN (SELECT run_id FROM game_config)
  `
}
