import { test } from "node:test"
import assert from "node:assert/strict"
import { checkAdmin, adminDenied, readPresentedPassword } from "./admin-auth.ts"
import { hashPassword, verifyPassword, validateNewPassword } from "./password-hash.ts"

const stored = await hashPassword("kaguja-2027")

test("bez hesla v databázi i bez ADMIN_TOKEN je heslo nenastavené", async () => {
  assert.equal(await checkAdmin("cokoli", {}), "unset")
  assert.equal(await checkAdmin(null, { envToken: "", storedHash: null }), "unset")
})

test("chybějící heslo v požadavku vrací unauthorized", async () => {
  assert.equal(await checkAdmin(null, { storedHash: stored }), "unauthorized")
  assert.equal(await checkAdmin("", { envToken: "secret" }), "unauthorized")
})

test("heslo z databáze projde, špatné ne", async () => {
  assert.equal(await checkAdmin("kaguja-2027", { storedHash: stored }), "ok")
  assert.equal(await checkAdmin("kaguja-2028", { storedHash: stored }), "unauthorized")
})

test("ADMIN_TOKEN funguje vedle hesla z databáze", async () => {
  assert.equal(await checkAdmin("secret", { envToken: "secret", storedHash: stored }), "ok")
  assert.equal(await checkAdmin("kaguja-2027", { envToken: "secret", storedHash: stored }), "ok")
  assert.equal(await checkAdmin("secreX", { envToken: "secret" }), "unauthorized")
  assert.equal(await checkAdmin("sec", { envToken: "secret" }), "unauthorized")
})

test("poškozený otisk nikoho nepustí", async () => {
  assert.equal(await checkAdmin("x", { storedHash: "nesmysl" }), "unauthorized")
  assert.equal(await verifyPassword("x", "scrypt$a$b$c$d$e"), false)
})

test("adminDenied mapuje výsledek na odpověď", () => {
  assert.equal(adminDenied("ok"), null)
  assert.equal(adminDenied("unauthorized").status, 401)
  assert.equal(adminDenied("unset").status, 503)
})

test("heslo s diakritikou projde přes x-admin-password", async () => {
  const h = await hashPassword("Kaguja na Měsíci")
  const req = new Request("http://x", { headers: { "x-admin-password": encodeURIComponent("Kaguja na Měsíci") } })
  assert.equal(await checkAdmin(readPresentedPassword(req), { storedHash: h }), "ok")
})

test("x-admin-token z curl se čte beze změny", () => {
  const req = new Request("http://x", { headers: { "x-admin-token": "secret" } })
  assert.equal(readPresentedPassword(req), "secret")
  assert.equal(readPresentedPassword(new Request("http://x")), null)
})

test("rozbité kódování hlavičky se bere jako žádné heslo", () => {
  const req = new Request("http://x", { headers: { "x-admin-password": "%E0%A4%A" } })
  assert.equal(readPresentedPassword(req), null)
})

test("dvě zahashování stejného hesla se liší (sůl)", async () => {
  assert.notEqual(await hashPassword("kaguja-2027"), stored)
})

test("validace nového hesla", () => {
  assert.equal(validateNewPassword("kaguja-2027"), null)
  assert.match(validateNewPassword("kratke"), /aspoň 8/)
  assert.match(validateNewPassword(" mezera-na-zacatku"), /mezerou/)
  assert.match(validateNewPassword(undefined), /chybí/)
  assert.equal(validateNewPassword("Měsíček1"), null)
})
