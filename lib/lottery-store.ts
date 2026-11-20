import { randomInt } from "node:crypto"
import { sql } from "@/lib/db"
import { TEAMS } from "@/lib/data"
import { ensureCastTables } from "@/lib/cast-store"
import { runLottery, type LotteryResult, type LotteryEntry } from "@/lib/lottery"
import { playerName, type CastCharacter } from "@/lib/cast"
import type { Prihlaska, RunChoice } from "@/lib/prihlaska"

// Losování obsazení běhu (lib/lottery.ts): osudí z databáze, náhled se uloží
// do run_lotteries, použití zapíše stavy přihlášek, pořadí náhradníků a obsazení.

export type LotteryCharacter = CastCharacter & { name: string }

export type StoredLottery = {
  id: number
  runId: number
  choice: RunChoice
  createdAt: string
  createdBy: string | null
  appliedAt: string | null
  result: LotteryResult
  /** jména a stav lidí z osudí pro náhled */
  people: Record<number, { name: string; substitute: string; fromRun: number | null }>
}

let ready: Promise<void> | null = null
function ensureLotteryTable(): Promise<void> {
  ready ??= (async () => {
    await ensureCastTables()
    await sql`
      CREATE TABLE IF NOT EXISTS run_lotteries (
        id          SERIAL PRIMARY KEY,
        run_id      INT  NOT NULL,
        choice      TEXT NOT NULL,
        seed        BIGINT NOT NULL,
        fingerprint TEXT NOT NULL,
        result      JSONB NOT NULL,
        people      JSONB NOT NULL,
        created_by  TEXT,
        created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        applied_at  TIMESTAMPTZ
      )
    `
  })().catch(err => { ready = null; throw err })
  return ready
}

type PoolRow = LotteryEntry & { status: string; runId: number | null; updatedAt: string }

/**
 * Osudí běhu: nové přihlášky, které chtějí tenhle běh nebo „je mi to jedno“,
 * a náhradníci jiných běhů s „je mi to jedno“ (nikde nejsou přijatí).
 */
async function loadPool(runId: number, choice: RunChoice): Promise<PoolRow[]> {
  const rows = await sql`
    SELECT id, data, team_group, status, run_id, updated_at FROM prihlasky
    WHERE (status = 'new' AND data->>'run' IN (${choice}, 'any'))
       OR (status = 'substitute' AND run_id IS DISTINCT FROM ${runId} AND data->>'run' = 'any')
    ORDER BY id
  `
  return rows.map(r => ({
    id: r.id as number, data: r.data as Prihlaska, teamGroup: (r.team_group as number | null) ?? null,
    status: r.status as string, runId: (r.run_id as number | null) ?? null, updatedAt: new Date(r.updated_at as string).toISOString(),
  }))
}

/** Otisk osudí: když se mezi náhledem a použitím změní přihláška, stav nebo trojice, los neplatí. */
const fingerprint = (pool: PoolRow[]) => pool.map(p => `${p.id}:${p.updatedAt}:${p.teamGroup ?? ""}:${p.status}:${p.runId ?? ""}`).join("|")

const toStored = (r: Record<string, unknown>): StoredLottery => ({
  id: r.id as number, runId: r.run_id as number, choice: r.choice as RunChoice,
  createdAt: new Date(r.created_at as string).toISOString(), createdBy: (r.created_by as string | null) ?? null,
  appliedAt: r.applied_at ? new Date(r.applied_at as string).toISOString() : null,
  result: r.result as LotteryResult, people: r.people as StoredLottery["people"],
})

/** Poslední los běhu (náhled nebo použitý), nebo null. */
export async function latestLottery(runId: number): Promise<StoredLottery | null> {
  await ensureLotteryTable()
  const [r] = await sql`SELECT * FROM run_lotteries WHERE run_id = ${runId} ORDER BY id DESC LIMIT 1`
  return r ? toStored(r) : null
}

/** Nový los (náhled). Nic kromě záznamu losu nemění. */
export async function drawLottery(runId: number, choice: RunChoice, characters: { adults: LotteryCharacter[]; students: LotteryCharacter[] }, by: string | null): Promise<StoredLottery> {
  await ensureLotteryTable()
  const pool = await loadPool(runId, choice)
  const seed = randomInt(1, 2 ** 31)
  const result = runLottery({
    entries: pool, adults: characters.adults, students: characters.students,
    teams: TEAMS.map(t => ({ id: t.id, name: t.name, memberIds: t.memberIds })),
    // Jména prvků slouží jen do textu varování, skóre je nepotřebuje.
    nakamuraId: "TCH2", seed, nameOf: (_kind, id) => id,
  })
  const people = Object.fromEntries(pool.map(p => [p.id, { name: playerName(p.data), substitute: p.data.substitute, fromRun: p.status === "substitute" ? p.runId : null }]))
  const [r] = await sql`
    INSERT INTO run_lotteries (run_id, choice, seed, fingerprint, result, people, created_by)
    VALUES (${runId}, ${choice}, ${seed}, ${fingerprint(pool)}, ${JSON.stringify(result)}::jsonb, ${JSON.stringify(people)}::jsonb, ${by})
    RETURNING *
  `
  return toStored(r)
}

/**
 * Použije los: vylosovaní jsou přijatí na běh s postavou, ostatní z osudí
 * náhradníci v pořadí (náhradníci jiných běhů zůstávají, kde byli), kdo
 * náhradníkem být nechce, nejede. Vrací chybu, nebo null.
 */
export async function applyLottery(runId: number, lotteryId: number): Promise<string | null> {
  await ensureLotteryTable()
  const [row] = await sql`SELECT * FROM run_lotteries WHERE id = ${lotteryId} AND run_id = ${runId}`
  if (!row) return "Los neexistuje"
  const lot = toStored(row)
  if (lot.appliedAt) return "Tenhle los už je použitý"
  const [{ n }] = await sql`SELECT count(*)::int AS n FROM run_cast WHERE run_id = ${runId}`
  if (n > 0) return "Běh už má obsazení. Los jde použít jen na prázdný běh."
  const pool = await loadPool(runId, lot.choice)
  if (fingerprint(pool) !== row.fingerprint) return "Od losu se změnily přihlášky nebo trojice. Losuj znovu."

  const fromOther = new Set(pool.filter(p => p.status === "substitute").map(p => p.id))
  const subs = lot.result.substitutes.filter(id => !fromOther.has(id))
  const declined = lot.result.declined.filter(id => !fromOther.has(id))
  const castIds = lot.result.cast.map(c => c.prihlaskaId)
  const chars = lot.result.cast.map(c => c.characterId)
  await sql.transaction([
    sql`UPDATE prihlasky SET status = 'accepted', run_id = ${runId}, substitute_rank = NULL WHERE id = ANY(${castIds})`,
    sql`
      UPDATE prihlasky p SET status = 'substitute', run_id = ${runId}, substitute_rank = t.rank
      FROM unnest(${subs}::int[]) WITH ORDINALITY AS t(id, rank) WHERE p.id = t.id
    `,
    sql`UPDATE prihlasky SET status = 'declined', run_id = NULL, substitute_rank = NULL WHERE id = ANY(${declined})`,
    sql`DELETE FROM run_cast WHERE prihlaska_id = ANY(${castIds})`,
    sql`
      INSERT INTO run_cast (run_id, character_id, prihlaska_id, updated_by)
      SELECT ${runId}, c, p, 'losování' FROM unnest(${chars}::text[], ${castIds}::int[]) AS t(c, p)
    `,
    sql`UPDATE run_lotteries SET applied_at = NOW() WHERE id = ${lotteryId}`,
  ])
  return null
}
