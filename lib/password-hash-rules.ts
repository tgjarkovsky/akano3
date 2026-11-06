// Pravidla pro nové heslo Přípravy. Sdílí je server (validace) i formulář.

export const MIN_PASSWORD_LENGTH = 8

/** Vrací text chyby, nebo null, když je nové heslo v pořádku. */
export function validateNewPassword(password: unknown): string | null {
  if (typeof password !== "string") return "Heslo chybí."
  if ([...password].length < MIN_PASSWORD_LENGTH) return `Heslo musí mít aspoň ${MIN_PASSWORD_LENGTH} znaků.`
  if (password.length > 200) return "Heslo je příliš dlouhé."
  if (password.trim() !== password) return "Heslo nesmí začínat ani končit mezerou."
  return null
}
