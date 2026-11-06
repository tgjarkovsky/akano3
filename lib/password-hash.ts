import { scrypt, randomBytes, timingSafeEqual } from "node:crypto"

// Heslo Přípravy se v databázi drží jen jako scrypt otisk se solí.
// Formát: scrypt$N$r$p$sůl(base64)$otisk(base64)

const N = 16384, R = 8, P = 1, KEYLEN = 64

function derive(password: string, salt: Buffer, n: number, r: number, p: number, keylen: number): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password.normalize("NFC"), salt, keylen, { N: n, r, p, maxmem: 64 * 1024 * 1024 }, (err, key) => {
      if (err) reject(err); else resolve(key)
    })
  })
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16)
  const key = await derive(password, salt, N, R, P, KEYLEN)
  return ["scrypt", N, R, P, salt.toString("base64"), key.toString("base64")].join("$")
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split("$")
  if (parts.length !== 6 || parts[0] !== "scrypt") return false
  const [n, r, p] = parts.slice(1, 4).map(Number)
  if (![n, r, p].every(x => Number.isInteger(x) && x > 0)) return false
  const salt = Buffer.from(parts[4], "base64")
  const expected = Buffer.from(parts[5], "base64")
  if (expected.length === 0) return false
  const key = await derive(password, salt, n, r, p, expected.length)
  return timingSafeEqual(key, expected)
}

// Pravidla pro nové heslo jsou zvlášť, aby je mohl použít i prohlížeč
// (tenhle soubor tahá node:crypto).
export { MIN_PASSWORD_LENGTH, validateNewPassword } from "./password-hash-rules.ts"
