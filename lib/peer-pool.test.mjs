import { test } from "node:test"
import assert from "node:assert/strict"
import { parsePoolRefill, nextPeerPool } from "./peer-pool.ts"

test("parsePoolRefill přijme platné vstupy", () => {
  assert.deepEqual(parsePoolRefill({ amount: 10, mode: "set" }), { amount: 10, mode: "set" })
  assert.deepEqual(parsePoolRefill({ amount: 1, mode: "add" }), { amount: 1, mode: "add" })
  assert.deepEqual(parsePoolRefill({ amount: 100, mode: "add" }), { amount: 100, mode: "add" })
})

test("parsePoolRefill odmítne špatnou částku", () => {
  for (const amount of [-5, 0, 1.5, 101, "10", null, undefined, NaN]) {
    assert.equal(typeof parsePoolRefill({ amount, mode: "add" }), "string", String(amount))
  }
})

test("parsePoolRefill odmítne neznámý mode a špatné tělo", () => {
  assert.equal(typeof parsePoolRefill({ amount: 5, mode: "reset" }), "string")
  assert.equal(typeof parsePoolRefill({ amount: 5 }), "string")
  assert.equal(typeof parsePoolRefill(null), "string")
})

test("nextPeerPool", () => {
  assert.equal(nextPeerPool(7, 10, "add"), 17)
  assert.equal(nextPeerPool(7, 10, "set"), 10)
})
