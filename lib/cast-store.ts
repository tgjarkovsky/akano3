import { sql } from "@/lib/db"
import { CHARACTERS } from "@/lib/data"
import { ensurePrihlaskaTables } from "@/lib/prihlaska-store"
import { canBeCast, isCastStatus, type CastStatus } from "@/lib/cast"
import type { Prihlaska } from "@/lib/prihlaska"

// Obsazení hráčů na postavy v běhu, stav přihlášek, platby, fotky a odeslané maily.
// Logika bez databáze je v lib/cast.ts.
//
//   prihlasky.status/run_id   stav přihlášky a běh, na který je přijatá (jeden člověk = nejvýš jeden běh)
//   prihlasky.paid_at/payment_note  platba hry
//   prihlasky.team_group      trojice, se kterou se hráč hlásil (číslo skupiny ze sekvence team_group_seq)
//   prihlasky.substitute_rank pořadí náhradníka z losování (1 = první na řadě)
//   run_lotteries             losování obsazení běhu: seed, výsledek a protokol
//   run_cast                  kdo v běhu hraje kterou postavu
//   player_photos             fotka hráče (v databázi, ven jen přes ověřené endpointy)
//   runs.cast_published_at    obsazení běhu je zveřejněné, hráč vidí postavu a nahrává fotku
//   mail_log                  komu a kdy šel který mail z modulu Hráči

let ready: Promise<void> | null = null

export function ensureCastTables(): Promise<void> {
  ready ??= (async () => {
    await ensurePrihlaskaTables()
    await sql`ALTER TABLE prihlasky ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'new'`
    await sql`ALTER TABLE prihlasky ADD COLUMN IF NOT EXISTS run_id INT`
    await sql`ALTER TABLE prihlasky ADD COLUMN IF NOT EXISTS paid_at DATE`
    await sql`ALTER TABLE prihlasky ADD COLUMN IF NOT EXISTS payment_note TEXT`
    await sql`ALTER TABLE prihlasky ADD COLUMN IF NOT EXISTS team_group INT`
    await sql`CREATE SEQUENCE IF NOT EXISTS team_group_seq`
    await sql`ALTER TABLE prihlasky ADD COLUMN IF NOT EXISTS substitute_rank INT`
    await sql`ALTER TABLE runs ADD COLUMN IF NOT EXISTS cast_published_at TIMESTAMPTZ`
    await sql`ALTER TABLE runs ADD COLUMN IF NOT EXISTS cast_published_by TEXT`
    await sql`
      CREATE TABLE IF NOT EXISTS run_cast (
        run_id       INT  NOT NULL,
        character_id TEXT NOT NULL,
        prihlaska_id INT  NOT NULL,
        updated_by   TEXT,
        updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        PRIMARY KEY (run_id, character_id),
        UNIQUE (run_id, prihlaska_id)
      )
    `
    await sql`
      CREATE TABLE IF NOT EXISTS player_photos (
        prihlaska_id INT PRIMARY KEY,
        mime         TEXT NOT NULL,
        bytes        BYTEA NOT NULL,
        uploaded_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `
    await sql`
      CREATE TABLE IF NOT EXISTS mail_log (
        id           SERIAL PRIMARY KEY,
        prihlaska_id INT  NOT NULL,
        template_id  TEXT NOT NULL,
        run_id       INT,
        sent_by      TEXT,
        sent_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `
  })().catch(err => { ready = null; throw err })
  return ready
}

/** Postavy, na které se obsazují hráči: studenti, Růže a dospělí. */
export const CASTABLE = CHARACTERS.filter(c => c.role === "student" || c.role === "ruze" || c.role === "teacher")
export const isCastable = (id: unknown): id is string => typeof id === "string" && CASTABLE.some(c => c.id === id)

const iso = (v: unknown) => v ? new Date(v as string).toISOString() : null

// ── Stav přihlášky a platba ────────────────────────────────────────────

export type AdminState = {
  id: number; status: CastStatus; runId: number | null; paidAt: string | null; paymentNote: string | null
  rejectionSentAt: string | null; teamGroup: number | null; substituteRank: number | null
}

/** Stav, běh a platba všech přihlášek (k řádkům z listPrihlasky). */
export async function listAdminStates(): Promise<AdminState[]> {
  await ensureCastTables()
  const rows = await sql`
    SELECT id, status, run_id, to_char(paid_at, 'YYYY-MM-DD') AS paid_at, payment_note, team_group, substitute_rank,
      (SELECT max(sent_at) FROM mail_log m WHERE m.prihlaska_id = p.id AND m.template_id = 'neprijeti') AS rejection_sent_at
    FROM prihlasky p
  `
  return rows.map(r => ({
    id: r.id as number,
    status: isCastStatus(r.status) ? r.status : "new",
    runId: (r.run_id as number | null) ?? null,
    paidAt: (r.paid_at as string | null) ?? null,
    paymentNote: (r.payment_note as string | null) ?? null,
    rejectionSentAt: r.rejection_sent_at ? new Date(r.rejection_sent_at as string).toISOString() : null,
    teamGroup: (r.team_group as number | null) ?? null,
    substituteRank: (r.substitute_rank as number | null) ?? null,
  }))
}

// ── Trojice ────────────────────────────────────────────────────────────

/** Týmové údaje všech přihlášek pro kontrolu skupin (lib/team-groups.ts). */
export async function teamEntries(): Promise<{ id: number; teamGroup: number | null; data: Prihlaska }[]> {
  await ensureCastTables()
  const rows = await sql`SELECT id, team_group, data FROM prihlasky`
  return rows.map(r => ({ id: r.id as number, teamGroup: (r.team_group as number | null) ?? null, data: r.data as Prihlaska }))
}

/**
 * Propojí přihlášky do trojic. Každá skupina dostane nové číslo, takže se nesmíchá
 * se zbytkem staré skupiny; skupina, ve které zbyl jeden člověk, zanikne.
 */
export async function linkTeamGroups(groups: number[][]): Promise<void> {
  await ensureCastTables()
  const ids = groups.flat()
  if (ids.length === 0) return
  await sql.transaction([
    sql`UPDATE prihlasky SET team_group = NULL WHERE id = ANY(${ids})`,
    ...groups.map(g => sql`UPDATE prihlasky SET team_group = (SELECT nextval('team_group_seq')) WHERE id = ANY(${g})`),
    dissolveSingles(),
  ])
}

/** Odpojí přihlášku od trojice. */
export async function unlinkTeam(id: number): Promise<void> {
  await ensureCastTables()
  await sql.transaction([sql`UPDATE prihlasky SET team_group = NULL WHERE id = ${id}`, dissolveSingles()])
}

const dissolveSingles = () => sql`
  UPDATE prihlasky SET team_group = NULL WHERE team_group IN (
    SELECT team_group FROM prihlasky WHERE team_group IS NOT NULL GROUP BY team_group HAVING count(*) < 2
  )
`

/** Změní stav a běh přihlášky. Kdo přestane být přijatý na běh, přijde o postavu v něm. */
export async function setStatus(id: number, status: CastStatus, runId: number | null): Promise<boolean> {
  await ensureCastTables()
  // Pořadí z losování platí jen pro náhradníka v tom běhu.
  const rows = await sql`
    UPDATE prihlasky SET status = ${status}, run_id = ${runId},
      substitute_rank = CASE WHEN ${status}::text = 'substitute' AND run_id IS NOT DISTINCT FROM ${runId}::int THEN substitute_rank END
    WHERE id = ${id} RETURNING id
  `
  if (rows.length === 0) return false
  await sql`
    DELETE FROM run_cast WHERE prihlaska_id = ${id}
      AND (${status}::text <> 'accepted' OR run_id IS DISTINCT FROM ${runId}::int)
  `
  return true
}

export async function setPayment(id: number, paidAt: string | null, note: string | null): Promise<boolean> {
  await ensureCastTables()
  const rows = await sql`UPDATE prihlasky SET paid_at = ${paidAt}, payment_note = ${note} WHERE id = ${id} RETURNING id`
  return rows.length > 0
}

// ── Obsazení postav v běhu ─────────────────────────────────────────────

export type CastCandidate = {
  id: number
  status: CastStatus
  data: Prihlaska
  /** postava, kterou v běhu hraje, nebo null */
  characterId: string | null
}

/** Přijatí hráči a náhradníci běhu s postavou, kterou v něm hrají. */
export async function getCastBoard(runId: number): Promise<{ candidates: CastCandidate[]; publishedAt: string | null }> {
  await ensureCastTables()
  const [rows, run] = await Promise.all([
    sql`
      SELECT p.id, p.status, p.data, c.character_id
      FROM prihlasky p LEFT JOIN run_cast c ON c.prihlaska_id = p.id AND c.run_id = ${runId}
      WHERE p.run_id = ${runId} AND p.status IN ('accepted', 'substitute')
      ORDER BY p.data->>'lastName', p.data->>'firstName'
    `,
    sql`SELECT cast_published_at FROM runs WHERE id = ${runId}`,
  ])
  return {
    candidates: rows.map(r => ({
      id: r.id as number,
      status: r.status as CastStatus,
      data: r.data as Prihlaska,
      characterId: (r.character_id as string | null) ?? null,
    })),
    publishedAt: iso(run[0]?.cast_published_at),
  }
}

/**
 * Obsadí hráče na postavu v běhu (null = postava bez hráče). Hráč, který už hraje
 * jinou postavu, se z ní přesune. Vrací chybu, nebo null.
 */
export async function assignCast(runId: number, characterId: string, prihlaskaId: number | null, by: string | null): Promise<string | null> {
  await ensureCastTables()
  if (prihlaskaId === null) {
    await sql`DELETE FROM run_cast WHERE run_id = ${runId} AND character_id = ${characterId}`
    return null
  }
  const [p] = await sql`SELECT status, run_id FROM prihlasky WHERE id = ${prihlaskaId}`
  if (!p) return "Přihláška neexistuje"
  if (!canBeCast({ status: p.status as CastStatus, runId: p.run_id as number | null }, runId)) return "Hráč není přijatý na tenhle běh"
  await sql.transaction([
    sql`DELETE FROM run_cast WHERE run_id = ${runId} AND (character_id = ${characterId} OR prihlaska_id = ${prihlaskaId})`,
    sql`INSERT INTO run_cast (run_id, character_id, prihlaska_id, updated_by) VALUES (${runId}, ${characterId}, ${prihlaskaId}, ${by})`,
  ])
  return null
}

/**
 * Schválený návrh: víc dvojic postava → hráč najednou (v jedné transakci).
 * Stejná pravidla jako assignCast; dvojice se nesmí opakovat.
 */
export async function assignCastMany(runId: number, pairs: { characterId: string; prihlaskaId: number }[], by: string | null): Promise<string | null> {
  await ensureCastTables()
  if (pairs.length === 0) return null
  const ids = pairs.map(p => p.prihlaskaId)
  if (new Set(ids).size !== ids.length || new Set(pairs.map(p => p.characterId)).size !== pairs.length) return "Návrh obsazuje někoho dvakrát"
  const rows = await sql`SELECT id, status, run_id FROM prihlasky WHERE id = ANY(${ids})`
  if (rows.length !== ids.length) return "Přihláška neexistuje"
  if (!rows.every(r => canBeCast({ status: r.status as CastStatus, runId: r.run_id as number | null }, runId))) return "Návrh obsahuje hráče, který není přijatý na tenhle běh"
  const chars = pairs.map(p => p.characterId)
  await sql.transaction([
    sql`DELETE FROM run_cast WHERE run_id = ${runId} AND (character_id = ANY(${chars}) OR prihlaska_id = ANY(${ids}))`,
    sql`
      INSERT INTO run_cast (run_id, character_id, prihlaska_id, updated_by)
      SELECT ${runId}, c, p, ${by} FROM unnest(${chars}::text[], ${ids}::int[]) AS t(c, p)
    `,
  ])
  return null
}

export async function setCastPublished(runId: number, published: boolean, by: string | null): Promise<boolean> {
  await ensureCastTables()
  const rows = await sql`
    UPDATE runs SET cast_published_at = ${published ? new Date().toISOString() : null}, cast_published_by = ${published ? by : null}
    WHERE id = ${runId} RETURNING id
  `
  return rows.length > 0
}

// ── Soupiska běhu (modul Hráči) ────────────────────────────────────────

export type RosterRow = {
  id: number
  status: CastStatus
  data: Prihlaska
  characterId: string | null
  paidAt: string | null
  paymentNote: string | null
  /** čas nahrání fotky (pro obnovení náhledu), null = bez fotky */
  photoAt: string | null
  /** pořadí náhradníka z losování */
  substituteRank: number | null
  mails: { templateId: string; sentAt: string }[]
}

export type Roster = { runId: number; runName: string; publishedAt: string | null; rows: RosterRow[] }

export async function getRoster(runId: number): Promise<Roster | null> {
  await ensureCastTables()
  const [run] = await sql`SELECT name, cast_published_at FROM runs WHERE id = ${runId}`
  if (!run) return null
  const [rows, mails] = await Promise.all([
    sql`
      SELECT p.id, p.status, p.data, to_char(p.paid_at, 'YYYY-MM-DD') AS paid_at, p.payment_note,
             p.substitute_rank, c.character_id, f.uploaded_at
      FROM prihlasky p
      LEFT JOIN run_cast c ON c.prihlaska_id = p.id AND c.run_id = ${runId}
      LEFT JOIN player_photos f ON f.prihlaska_id = p.id
      WHERE p.run_id = ${runId} AND p.status IN ('accepted', 'substitute')
      ORDER BY p.status, p.substitute_rank NULLS LAST, p.data->>'lastName', p.data->>'firstName'
    `,
    sql`
      SELECT l.prihlaska_id, l.template_id, l.sent_at FROM mail_log l
      JOIN prihlasky p ON p.id = l.prihlaska_id
      WHERE p.run_id = ${runId} ORDER BY l.sent_at
    `,
  ])
  const mailsOf = new Map<number, RosterRow["mails"]>()
  for (const m of mails) {
    const list = mailsOf.get(m.prihlaska_id as number) ?? []
    list.push({ templateId: m.template_id as string, sentAt: iso(m.sent_at)! })
    mailsOf.set(m.prihlaska_id as number, list)
  }
  return {
    runId,
    runName: run.name as string,
    publishedAt: iso(run.cast_published_at),
    rows: rows.map(r => ({
      id: r.id as number,
      status: r.status as CastStatus,
      data: r.data as Prihlaska,
      characterId: (r.character_id as string | null) ?? null,
      paidAt: (r.paid_at as string | null) ?? null,
      paymentNote: (r.payment_note as string | null) ?? null,
      photoAt: iso(r.uploaded_at),
      substituteRank: (r.substitute_rank as number | null) ?? null,
      mails: mailsOf.get(r.id as number) ?? [],
    })),
  }
}

/** Kontakty a token přihlášek pro rozeslání mailů. */
export async function getMailTargets(ids: number[]): Promise<{ id: number; token: string; status: CastStatus; runId: number | null; data: Prihlaska; characterId: string | null; paidAt: string | null; hasPhoto: boolean }[]> {
  await ensureCastTables()
  if (ids.length === 0) return []
  const rows = await sql`
    SELECT p.id, p.token, p.status, p.run_id, p.data, to_char(p.paid_at, 'YYYY-MM-DD') AS paid_at, c.character_id, f.prihlaska_id IS NOT NULL AS has_photo
    FROM prihlasky p
    LEFT JOIN run_cast c ON c.prihlaska_id = p.id AND c.run_id = p.run_id
    LEFT JOIN player_photos f ON f.prihlaska_id = p.id
    WHERE p.id = ANY(${ids}::int[])
  `
  return rows.map(r => ({
    id: r.id as number, token: r.token as string, status: r.status as CastStatus, runId: (r.run_id as number | null) ?? null, data: r.data as Prihlaska,
    characterId: (r.character_id as string | null) ?? null, paidAt: (r.paid_at as string | null) ?? null, hasPhoto: r.has_photo as boolean,
  }))
}

export async function logMail(prihlaskaId: number, templateId: string, runId: number | null, by: string | null) {
  await ensureCastTables()
  await sql`INSERT INTO mail_log (prihlaska_id, template_id, run_id, sent_by) VALUES (${prihlaskaId}, ${templateId}, ${runId}, ${by})`
}

export async function getRunInfo(runId: number): Promise<{ name: string; startsOn: string | null; endsOn: string | null } | null> {
  const [r] = await sql`SELECT name, to_char(starts_on, 'YYYY-MM-DD') AS starts_on, to_char(ends_on, 'YYYY-MM-DD') AS ends_on FROM runs WHERE id = ${runId}`
  return r ? { name: r.name as string, startsOn: (r.starts_on as string | null) ?? null, endsOn: (r.ends_on as string | null) ?? null } : null
}

// ── Hráč přes odkaz přihlášky ──────────────────────────────────────────

export type PlayerRun = {
  prihlaskaId: number
  runId: number
  runName: string
  startsOn: string | null
  endsOn: string | null
  characterId: string
  paidAt: string | null
  photoAt: string | null
}

/** Běh a postava hráče, jen když je přijatý, obsazený a obsazení běhu je zveřejněné. */
export async function getPlayerRun(token: string): Promise<PlayerRun | null> {
  await ensureCastTables()
  const [r] = await sql`
    SELECT p.id, p.run_id, to_char(p.paid_at, 'YYYY-MM-DD') AS paid_at, c.character_id, f.uploaded_at,
           r.name, to_char(r.starts_on, 'YYYY-MM-DD') AS starts_on, to_char(r.ends_on, 'YYYY-MM-DD') AS ends_on
    FROM prihlasky p
    JOIN runs r ON r.id = p.run_id AND r.cast_published_at IS NOT NULL
    JOIN run_cast c ON c.prihlaska_id = p.id AND c.run_id = p.run_id
    LEFT JOIN player_photos f ON f.prihlaska_id = p.id
    WHERE p.token = ${token} AND p.status = 'accepted'
  `
  if (!r) return null
  return {
    prihlaskaId: r.id as number,
    runId: r.run_id as number,
    runName: r.name as string,
    startsOn: (r.starts_on as string | null) ?? null,
    endsOn: (r.ends_on as string | null) ?? null,
    characterId: r.character_id as string,
    paidAt: (r.paid_at as string | null) ?? null,
    photoAt: iso(r.uploaded_at),
  }
}

// ── Fotky ──────────────────────────────────────────────────────────────

export type Photo = { mime: string; bytes: Buffer; uploadedAt: string }

// Bajty jdou přes hex/base64, ať nezáleží na tom, jak ovladač převádí BYTEA.
export async function savePhoto(prihlaskaId: number, mime: string, bytes: Uint8Array): Promise<void> {
  await ensureCastTables()
  const hex = Buffer.from(bytes).toString("hex")
  await sql`
    INSERT INTO player_photos (prihlaska_id, mime, bytes) VALUES (${prihlaskaId}, ${mime}, decode(${hex}, 'hex'))
    ON CONFLICT (prihlaska_id) DO UPDATE SET mime = EXCLUDED.mime, bytes = EXCLUDED.bytes, uploaded_at = NOW()
  `
}

export async function getPhoto(prihlaskaId: number): Promise<Photo | null> {
  await ensureCastTables()
  const [r] = await sql`SELECT mime, encode(bytes, 'base64') AS b64, uploaded_at FROM player_photos WHERE prihlaska_id = ${prihlaskaId}`
  return r ? { mime: r.mime as string, bytes: Buffer.from((r.b64 as string).replace(/\s/g, ""), "base64"), uploadedAt: iso(r.uploaded_at)! } : null
}

export async function deletePhoto(prihlaskaId: number): Promise<void> {
  await ensureCastTables()
  await sql`DELETE FROM player_photos WHERE prihlaska_id = ${prihlaskaId}`
}

/** Přihláška hráče postavy v běhu se zveřejněným obsazením, jinak null. */
export async function castPrihlaskaOf(runId: number, characterId: string): Promise<number | null> {
  await ensureCastTables()
  const [r] = await sql`
    SELECT c.prihlaska_id FROM run_cast c JOIN runs r ON r.id = c.run_id AND r.cast_published_at IS NOT NULL
    WHERE c.run_id = ${runId} AND c.character_id = ${characterId}
  `
  return r ? r.prihlaska_id as number : null
}

/** Postavy běhu se zveřejněným obsazením, jejichž hráč má fotku: id postavy → čas nahrání. */
export async function castPhotos(runId: number): Promise<Map<string, string>> {
  await ensureCastTables()
  const rows = await sql`
    SELECT c.character_id, f.uploaded_at FROM run_cast c
    JOIN runs r ON r.id = c.run_id AND r.cast_published_at IS NOT NULL
    JOIN player_photos f ON f.prihlaska_id = c.prihlaska_id
    WHERE c.run_id = ${runId}
  `
  return new Map(rows.map(r => [r.character_id as string, iso(r.uploaded_at)!]))
}

/** Odpověď s fotkou; soukromá cache, ať ji nesdílí proxy. */
export function photoResponse(p: Photo): Response {
  return new Response(new Uint8Array(p.bytes), {
    headers: {
      "Content-Type": p.mime,
      "Cache-Control": "private, max-age=3600",
      "X-Content-Type-Options": "nosniff",
    },
  })
}
