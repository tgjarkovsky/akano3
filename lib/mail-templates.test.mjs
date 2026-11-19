import { test } from "node:test"
import assert from "node:assert/strict"
import { fillVars, renderMail, findTemplate, sampleVars, MAIL_TEMPLATES } from "./mail-templates.ts"

test("dosadí proměnné, neznámá zůstane vidět", () => {
  assert.equal(fillVars("Ahoj {{jmeno}}, {{ do }} {{nic}}", { jmeno: "Terka", do: "1. 2." }), "Ahoj Terka, 1. 2. {{nic}}")
})

test("HTML escapuje vstup a formátuje tučně a kurzívu", () => {
  const { html, text } = renderMail({ subject: "S", body: "**Pozor** na *tohle* <b>{{x}}</b>" }, { x: "a&b" })
  assert.match(html, /<strong>Pozor<\/strong> na <em>tohle<\/em> &lt;b&gt;a&amp;b&lt;\/b&gt;/)
  assert.equal(text, "Pozor na tohle <b>a&b</b>\n")
})

test("odstavce, zalomení a odkaz na samostatném řádku jako tlačítko", () => {
  const { html } = renderMail({ subject: "S", body: "a\nb\n\n{{odkaz}}\n\nviz https://x.cz/y." }, { odkaz: "https://x.cz/p/1" })
  assert.match(html, /<p[^>]*>a<br>b<\/p>/)
  assert.match(html, /<a href="https:\/\/x\.cz\/p\/1"[^>]*>Otevřít odkaz<\/a>/)
  assert.match(html, /viz <a href="https:\/\/x\.cz\/y"[^>]*>https:\/\/x\.cz\/y<\/a>\./)
})

test("předmět bez zalomení a s dosazenými proměnnými", () => {
  assert.equal(renderMail({ subject: "Ahoj\n{{jmeno}} ", body: "" }, { jmeno: "T" }).subject, "Ahoj T")
})

test("výchozí šablony používají jen své proměnné", () => {
  for (const t of MAIL_TEMPLATES) {
    const r = renderMail(t, sampleVars(t))
    assert.doesNotMatch(r.subject + r.text, /\{\{/, t.id)
  }
  assert.ok(findTemplate("prihlaska-potvrzeni"))
})
