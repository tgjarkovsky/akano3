import { sql } from "@/lib/db"
import { checkAdmin, adminDenied, readPresentedPassword, checkImportToken } from "@/lib/admin-auth"
import { hashPassword } from "@/lib/password-hash"

// Heslo Přípravy v databázi: jeden řádek s otiskem (scrypt). Tabulka se
// zakládá sama při prvním dotazu, aby Příprava fungovala i před /api/admin/migrate.

let tableReady: Promise<unknown> | null = null

export function ensureAdminAuthTable() {
  tableReady ??= sql`
    CREATE TABLE IF NOT EXISTS admin_auth (
      id INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
      password_hash TEXT NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `.catch(err => { tableReady = null; throw err })
  return tableReady
}

export async function getStoredHash(): Promise<string | null> {
  await ensureAdminAuthTable()
  const [row] = await sql`SELECT password_hash FROM admin_auth WHERE id = 1`
  return (row?.password_hash as string | undefined) ?? null
}

/** První nastavení. Vrací false, když už heslo mezitím někdo nastavil. */
export async function setInitialPassword(password: string): Promise<boolean> {
  await ensureAdminAuthTable()
  const hash = await hashPassword(password)
  const rows = await sql`
    INSERT INTO admin_auth (id, password_hash) VALUES (1, ${hash})
    ON CONFLICT (id) DO NOTHING
    RETURNING id
  `
  return rows.length > 0
}

export async function changePassword(password: string): Promise<void> {
  await ensureAdminAuthTable()
  const hash = await hashPassword(password)
  await sql`
    INSERT INTO admin_auth (id, password_hash) VALUES (1, ${hash})
    ON CONFLICT (id) DO UPDATE SET password_hash = EXCLUDED.password_hash, updated_at = NOW()
  `
}

/**
 * Ověří heslo požadavku. Vrací Response při odmítnutí (401 špatné heslo,
 * 503 heslo ještě není nastavené), null když je požadavek v pořádku.
 */
export async function requireAdmin(req: Request): Promise<Response | null> {
  try {
    const result = await checkAdmin(readPresentedPassword(req), {
      envToken: process.env.ADMIN_TOKEN,
      storedHash: await getStoredHash(),
    })
    return adminDenied(result)
  } catch (err) {
    console.error("[requireAdmin]", err)
    return new Response("Server error", { status: 500 })
  }
}

/**
 * Heslo Přípravy, nebo token importu (x-import-token) pro čtení textů a návrhy
 * importu z Claude (scripts/akano-mcp.mjs). Vrací, kdo prošel.
 */
export async function requireAdminOrImport(req: Request): Promise<{ denied: Response | null; via: "admin" | "import" }> {
  if (checkImportToken(req.headers.get("x-import-token"), process.env.IMPORT_TOKEN)) return { denied: null, via: "import" }
  return { denied: await requireAdmin(req), via: "admin" }
}
