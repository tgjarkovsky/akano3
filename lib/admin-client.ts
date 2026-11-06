// Heslo Přípravy na straně prohlížeče. Drží se v sessionStorage jen pro
// jednu záložku: zavřením záložky se Příprava odhlásí, Velín v jiné záložce
// heslo nikdy nemá. Server ho ověřuje přes adminGuard (hlavička x-admin-token).

const TOKEN_KEY = "akano_admin_token"

export function getAdminToken(): string | null {
  if (typeof window === "undefined") return null
  try { return sessionStorage.getItem(TOKEN_KEY) } catch { return null }
}

export function setAdminToken(token: string | null) {
  try {
    if (token) sessionStorage.setItem(TOKEN_KEY, token)
    else sessionStorage.removeItem(TOKEN_KEY)
  } catch { /* soukromé okno bez úložiště: heslo se jen nezapamatuje */ }
}

/** Hlavička s heslem, pokud je tahle záložka v Přípravě přihlášená. */
export function adminHeaders(): Record<string, string> {
  const token = getAdminToken()
  return token ? { "x-admin-token": token } : {}
}

export function adminFetch(url: string, init: RequestInit = {}): Promise<Response> {
  return fetch(url, { ...init, headers: { ...init.headers as Record<string, string>, ...adminHeaders() } })
}

/** Ověří heslo na serveru. Vrací null při úspěchu, jinak text chyby. */
export async function verifyAdminToken(token: string): Promise<string | null> {
  try {
    const res = await fetch("/api/priprava/auth", { method: "POST", headers: { "x-admin-token": token } })
    if (res.ok) return null
    if (res.status === 401) return "Špatné heslo."
    if (res.status === 503) return "Na serveru není nastavené heslo (ADMIN_TOKEN)."
    return "Server neodpovídá. Zkus to znovu."
  } catch {
    return "Chyba sítě. Zkus to znovu."
  }
}

// ── Kdo jsi ─────────────────────────────────────────────────────────────
// Jméno organizátora pro podpis „Hotovo / Schváleno“ u textů. Pamatuje se
// v localStorage, aby se nemuselo vybírat znovu po každém přihlášení.

const ORGANIZER_KEY = "akano_organizer"

export function getOrganizer(): string | null {
  if (typeof window === "undefined") return null
  try { return localStorage.getItem(ORGANIZER_KEY) } catch { return null }
}

export function setOrganizer(name: string | null) {
  try {
    if (name) localStorage.setItem(ORGANIZER_KEY, name)
    else localStorage.removeItem(ORGANIZER_KEY)
  } catch { /* bez úložiště se jméno vybere při každém přihlášení */ }
}
