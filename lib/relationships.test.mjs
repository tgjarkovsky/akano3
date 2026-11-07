import { test } from "node:test"
import assert from "node:assert/strict"
import { parseRelationships, relationLead } from "./relationships.ts"

test("vztahy: osoby, údaje bez dogtagu, popis", () => {
  const r = parseRelationships([
    "Úvod.", "", "### Kaoru", "", "pohlaví: muž", "status: student", "tým: 2", "původ: Příbuzný", "čišiki: II",
    "pozice na žebříčku bodování: podprůměrný", "", "- Kaoru byl chudej kluk.", "- čím vystupuje z řady: trdlo",
    "", "### **Rajdži (Marcel)**", "status: dospělý", "jednotka: Hvězdy", "Odstavec: s dvojtečkou.", "pohlaví: muž",
    "###", "- ještě k Rajdžimu",
  ].join("\n"))
  assert.equal(r.intro, "Úvod.")
  assert.deepEqual(r.people.map(p => p.name), ["Kaoru", "Rajdži (Marcel)"])
  assert.deepEqual(r.people[0].facts, [{ key: "čišiki", value: "II" }, { key: "pozice na žebříčku bodování", value: "podprůměrný" }])
  assert.equal(r.people[0].body, "- Kaoru byl chudej kluk.\n- čím vystupuje z řady: trdlo")
  // status jiný než student zůstává; „Odstavec: …“ už je popis, další údaj po něm taky
  assert.deepEqual(r.people[1].facts, [{ key: "status", value: "dospělý" }])
  assert.equal(r.people[1].body, "Odstavec: s dvojtečkou.\npohlaví: muž\n- ještě k Rajdžimu")
})

test("vztahy: text bez nadpisů zůstává textem", () => {
  assert.equal(parseRelationships("Šigen(C002)\n\nMimi(C003)"), null)
})

test("vztahy: úvod dlaždice", () => {
  assert.equal(relationLead("\n- **Hiko** byl služebník.\n- Druhá"), "Hiko byl služebník.")
  assert.equal(relationLead(""), "")
})

test("vztahy: nevyplněné hodnoty ze šablony se nezobrazí", () => {
  const r = parseRelationships("### Ajumi\nstatus: student/učitel/jiné\nčišiki: něco\npozice na žebříčku bodování: slovní popis/XXX\n- Text")
  assert.deepEqual(r.people[0].facts, [])
  assert.equal(r.people[0].body, "- Text")
})
