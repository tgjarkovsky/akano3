// Heslo Přípravy na straně prohlížeče. Drží se v sessionStorage jen pro
// jednu záložku: zavřením záložky se Příprava odhlásí, Velín v jiné záložce
// heslo nikdy nemá. Server ho porovná s otiskem v databázi (lib/admin-password.ts).
// Posílá se v hlavičce x-admin-password přes encodeURIComponent, aby prošla
// i diakritika (hlavičky smí obsahovat jen ASCII).

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
  return token ? { "x-admin-password": encodeURIComponent(token) } : {}
}

export function adminFetch(url: string, init: RequestInit = {}): Promise<Response> {
  return fetch(url, { ...init, headers: { ...init.headers as Record<string, string>, ...adminHeaders() } })
}

/** Ověří heslo na serveru. Vrací null při úspěchu, jinak text chyby. */
export async function verifyAdminToken(token: string): Promise<string | null> {
  try {
    const res = await fetch("/api/priprava/auth", { method: "POST", headers: { "x-admin-password": encodeURIComponent(token) } })
    if (res.ok) return null
    if (res.status === 401) return "Špatné heslo."
    if (res.status === 503) return "Heslo ještě není nastavené. Obnov stránku."
    return "Server neodpovídá. Zkus to znovu."
  } catch {
    return "Chyba sítě. Zkus to znovu."
  }
}

/** Je heslo Přípravy na serveru nastavené? null = server neodpověděl. */
export async function fetchPasswordSet(): Promise<boolean | null> {
  try {
    const res = await fetch("/api/priprava/auth")
    if (!res.ok) return null
    const data = await res.json() as { passwordSet?: boolean }
    return data.passwordSet === true
  } catch {
    return null
  }
}

/**
 * Nastaví první heslo, nebo změní současné (to musí být přihlášené).
 * Vrací null při úspěchu, jinak text chyby.
 */
export async function savePassword(newPassword: string): Promise<string | null> {
  try {
    const res = await fetch("/api/priprava/password", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...adminHeaders() },
      body: JSON.stringify({ newPassword }),
    })
    if (res.ok) return null
    if (res.status === 400) return await res.text()
    if (res.status === 401) return "Současné heslo neplatí. Přihlas se znovu."
    if (res.status === 409) return "Heslo už mezitím někdo nastavil. Obnov stránku a přihlas se."
    return "Heslo se nepodařilo uložit. Zkus to znovu."
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
