import test from "node:test"
import assert from "node:assert/strict"
import { diffScores } from "./score-flash.ts"

test("prázdné prev vrací []", () => {
  assert.deepEqual(diffScores({}, [{ id: "a", points: 5 }]), [])
})

test("beze změny vrací []", () => {
  assert.deepEqual(diffScores({ a: 5 }, [{ id: "a", points: 5 }]), [])
})

test("zvýšení o 5", () => {
  assert.deepEqual(diffScores({ a: 5 }, [{ id: "a", points: 10 }]), [{ id: "a", delta: 5 }])
})

test("snížení vrací zápornou deltu", () => {
  assert.deepEqual(diffScores({ a: 5 }, [{ id: "a", points: 2 }]), [{ id: "a", delta: -3 }])
})

test("nový hráč, který v prev chybí, se nehlásí", () => {
  assert.deepEqual(diffScores({ a: 5 }, [{ id: "a", points: 5 }, { id: "b", points: 9 }]), [])
})
