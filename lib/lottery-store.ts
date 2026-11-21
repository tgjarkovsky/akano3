import { randomInt } from "node:crypto"
import { sql } from "@/lib/db"
import { ensureCastTables } from "@/lib/cast-store"
import { runLottery, acceptsTerms, NAKAMURA_ID, TERMS, type LotteryResult, type LotteryEntry, type Term } from "@/lib/lottery"
import { playerName, type CastCharacter } from "@/lib/cast"
import type { Prihlaska, RunChoice } from "@/lib/prihlaska"

// Společný los obou běhů (lib/lottery.ts): osudí z databáze, náhled se uloží
// do lotteries, použití zapíše stavy přihlášek a společné pořadí náhradníků.
// Náhradník s „je mi to jedno“ nemá běh (run_id NULL = oba běhy). Postavy los
// nepřiděluje, skupiny z losu využije návrh obsazení (castFromLottery).
//
//   lotteries.runs   {"first": id běhu | null, "second": id běhu | null}:
//                    na který běh v aplikaci se losuje který termín z přihlášky

export type LotteryCharacter = CastCharacter & { name: string }
export type LotteryRuns = Record<Term, number | null>

export type LotteryPerson = {
  name: string
  /** termín z přihlášky */
  run: RunChoice
  substitute: string
  vision: boolean
  paths: { adult: boolean; team: boolean; student: boolean }
  /** jede i bez týmu */
  solo: boolean
  teamGroup: number | null
}

export type StoredLottery = {
  id: number
  runs: LotteryRuns
  createdAt: string
  createdBy: string | null
  appliedAt: string | null
  result: LotteryResult
  /** lidé z osudí pro náhled */
  people: Record<number, LotteryPerson>
}

let ready: Promise<void> | null = null
function ensureLotteryTable(): Promise<void> {
  ready ??= (async () => {
    await ensureCastTables()
    await sql`
      CREATE TABLE IF NOT EXISTS lotteries (
        id          SERIAL PRIMARY KEY,
        runs        JSONB NOT NULL,
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

type PoolRow = LotteryEntry & { updatedAt: string }

const termsOf = (runs: LotteryRuns): Term[] => TERMS.filter(t => runs[t] != null)

/** Osudí: nové přihlášky na losované termíny nebo s „je mi to jedno“. */
async function loadPool(terms: Term[]): Promise<PoolRow[]> {
  const rows = await sql`
    SELECT id, data, team_group, updated_at FROM prihlasky
    WHERE status = 'new' AND data->>'run' = ANY(${[...terms, "any"]})
    ORDER BY id
  `
  return rows.map(r => ({
    id: r.id as number, data: r.data as Prihlaska, teamGroup: (r.team_group as number | null) ?? null,
    updatedAt: new Date(r.updated_at as string).toISOString(),
  }))
}

/** Otisk osudí: když se mezi náhledem a použitím změní přihláška nebo trojice, los neplatí. */
const fingerprint = (pool: PoolRow[]) => pool.map(p => `${p.id}:${p.updatedAt}:${p.teamGroup ?? ""}`).join("|")

const toStored = (r: Record<string, unknown>): StoredLottery => ({
  id: r.id as number, runs: r.runs as LotteryRuns,
  createdAt: new Date(r.created_at as string).toISOString(), createdBy: (r.created_by as string | null) ?? null,
  appliedAt: r.applied_at ? new Date(r.applied_at as string).toISOString() : null,
  result: r.result as LotteryResult, people: r.people as StoredLottery["people"],
})

/** Poslední los (náhled nebo použitý), nebo null. */
export async function latestLottery(): Promise<StoredLottery | null> {
  await ensureLotteryTable()
  const [r] = await sql`SELECT * FROM lotteries WHERE result->>'version' = '3' ORDER BY id DESC LIMIT 1`
  return r ? toStored(r) : null
}

/** Nový los (náhled). Nic kromě záznamu losu nemění. Vrací chybu jako text. */
export async function drawLottery(runs: LotteryRuns, characters: { adults: LotteryCharacter[]; students: LotteryCharacter[] }, by: string | null): Promise<StoredLottery | string> {
  await ensureLotteryTable()
  const terms = termsOf(runs)
  if (terms.length === 0) return "Vyber aspoň jeden běh"
  if (runs.first != null && runs.first === runs.second) return "Každý termín musí mít jiný běh"
  const ids = terms.map(t => runs[t]!)
  const [{ n }] = await sql`SELECT count(*)::int AS n FROM runs WHERE id = ANY(${ids})`
  if (n !== ids.length) return "Běh neexistuje"
  const pool = await loadPool(terms)
  const seed = randomInt(1, 2 ** 31)
  const result = runLottery({
    entries: pool, terms, adultSlots: characters.adults.length, studentSlots: characters.students.length,
    nakamura: characters.adults.find(c => c.id === NAKAMURA_ID) ?? null, seed,
  })
  const people: Record<number, LotteryPerson> = Object.fromEntries(pool.map(p => [p.id, {
    name: playerName(p.data), run: p.data.run, substitute: p.data.substitute,
    vision: !!p.data.visionImpaired, paths: p.data.paths, solo: !!p.data.team?.solo, teamGroup: p.teamGroup,
  }]))
  const [r] = await sql`
    INSERT INTO lotteries (runs, seed, fingerprint, result, people, created_by)
    VALUES (${JSON.stringify(runs)}::jsonb, ${seed}, ${fingerprint(pool)}, ${JSON.stringify(result)}::jsonb, ${JSON.stringify(people)}::jsonb, ${by})
    RETURNING *
  `
  return toStored(r)
}

/**
 * Použije los: vylosovaní jsou přijatí na svůj běh, ostatní z osudí náhradníci
 * ve společném pořadí (s „je mi to jedno“ pro oba běhy), kdo náhradníkem být
 * nechce, nejede. Postavy se nemění. Vrací chybu, nebo null.
 */
export async function applyLottery(lotteryId: number): Promise<string | null> {
  await ensureLotteryTable()
  const [row] = await sql`SELECT * FROM lotteries WHERE id = ${lotteryId}`
  if (!row) return "Los neexistuje"
  const lot = toStored(row)
  if (lot.appliedAt) return "Tenhle los už je použitý"
  const terms = termsOf(lot.runs)
  const runIds = terms.map(t => lot.runs[t]!)
  const applied = (await sql`SELECT runs FROM lotteries WHERE applied_at IS NOT NULL`).map(r => r.runs as LotteryRuns)
  if (applied.some(r => TERMS.some(t => r[t] != null && runIds.includes(r[t]!)))) return "Na tyhle běhy už je použitý los. Nejdřív ho vrať."
  const pool = await loadPool(terms)
  if (fingerprint(pool) !== row.fingerprint) return "Od losu se změnily přihlášky nebo trojice. Losuj znovu."

  const byId = new Map(pool.map(p => [p.id, p]))
  const chosenIds = lot.result.selected.map(s => s.id)
  const chosenRuns = lot.result.selected.map(s => lot.runs[s.term]!)
  const subs = lot.result.substitutes
  // Náhradník s jedním možným během patří k němu, s oběma k žádnému (NULL = oba běhy).
  const subRuns = subs.map(id => { const a = acceptsTerms(byId.get(id)!.data, terms); return a.length === 1 ? lot.runs[a[0]] : null })
  await sql.transaction([
    sql`
      UPDATE prihlasky p SET status = 'accepted', run_id = t.run, substitute_rank = NULL
      FROM unnest(${chosenIds}::int[], ${chosenRuns}::int[]) AS t(id, run) WHERE p.id = t.id
    `,
    sql`
      UPDATE prihlasky p SET status = 'substitute', run_id = t.run, substitute_rank = t.rank
      FROM unnest(${subs}::int[], ${subRuns}::int[]) WITH ORDINALITY AS t(id, run, rank) WHERE p.id = t.id
    `,
    sql`UPDATE prihlasky SET status = 'declined', run_id = NULL, substitute_rank = NULL WHERE id = ANY(${lot.result.declined})`,
    sql`UPDATE lotteries SET applied_at = NOW() WHERE id = ${lotteryId}`,
  ])
  return null
}

/**
 * Vrátí použitý los: lidi, kterým los nastavil stav a ten se od té doby
 * nezměnil, vrátí mezi nové, smaže jim postavy v losovaných bězích a smaže
 * los i nepoužité náhledy. Vrací chybu, nebo null.
 */
export async function revertLottery(lotteryId: number): Promise<string | null> {
  await ensureLotteryTable()
  const [row] = await sql`SELECT * FROM lotteries WHERE id = ${lotteryId}`
  if (!row) return "Los neexistuje"
  const lot = toStored(row)
  if (!lot.appliedAt) return "Los ještě není použitý"
  const runIds = termsOf(lot.runs).map(t => lot.runs[t]!)
  const chosen = lot.result.selected.map(s => s.id)
  await sql.transaction([
    sql`DELETE FROM run_cast WHERE run_id = ANY(${runIds}) AND prihlaska_id = ANY(${chosen})`,
    sql`
      UPDATE prihlasky SET status = 'new', run_id = NULL, substitute_rank = NULL
      WHERE (id = ANY(${chosen}) AND status = 'accepted' AND run_id = ANY(${runIds}))
         OR (id = ANY(${lot.result.substitutes}) AND status = 'substitute')
         OR (id = ANY(${lot.result.declined}) AND status = 'declined')
    `,
    sql`DELETE FROM lotteries WHERE id = ${lotteryId} OR applied_at IS NULL`,
  ])
  return null
}
