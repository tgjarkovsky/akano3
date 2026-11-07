#!/usr/bin/env node
// MCP server (stdio) pro import textů do Akano z Google dokumentů přes Clauda.
// Claude čte dokument svým Drive konektorem, upraví texty (např. rodové značky)
// a pošle je sem jako NÁVRH importu. Uložit ho může jen Příprava v Texty → Import.
//
// Token importu: proměnná AKANO_IMPORT_TOKEN, nebo soubor ~/.config/akano/import-token.
// Na serveru musí být stejná hodnota v proměnné IMPORT_TOKEN (Vercel).
// Adresa: AKANO_URL (výchozí https://akano3.vercel.app).
// Bez závislostí: MCP po stdio jsou řádky JSON-RPC 2.0.

import { readFileSync } from "node:fs"
import { homedir } from "node:os"
import { join } from "node:path"
import { createInterface } from "node:readline"

const BASE = (process.env.AKANO_URL || "https://akano3.vercel.app").replace(/\/+$/, "")

function token() {
  if (process.env.AKANO_IMPORT_TOKEN) return process.env.AKANO_IMPORT_TOKEN.trim()
  try { return readFileSync(join(homedir(), ".config", "akano", "import-token"), "utf8").trim() } catch { return "" }
}

async function api(path, init = {}) {
  const t = token()
  if (!t) throw new Error("Chybí token importu: nastav AKANO_IMPORT_TOKEN nebo ~/.config/akano/import-token.")
  const res = await fetch(BASE + path, {
    ...init,
    headers: { "x-import-token": t, ...(init.body ? { "Content-Type": "application/json" } : {}), ...init.headers },
  })
  const text = await res.text()
  if (!res.ok) throw new Error(`${res.status} ${text || res.statusText}`)
  return text ? JSON.parse(text) : null
}

const ENTITY_TYPES = ["character", "team", "unit", "role", "circle", "trait"]

const TOOLS = [
  {
    name: "akano_catalog",
    description: "Přehled pro import do Akano: návod (guide, včetně rodových značek {byl|byla} a {Jméno: byl|byla}), pole textů s nápovědou, postavy (id, jméno, tým, rod), týmy, jednotky, kruhy, specializace a původy, role jednotek a stav existujících textů (bez těl). Zavolej jako první.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
    run: () => api("/api/priprava/catalog"),
  },
  {
    name: "akano_get_texts",
    description: "Současné texty jedné entity v Akano (těla, stav, verze), např. pro porovnání s dokumentem před návrhem. Role se zadává číselným id z katalogu.",
    inputSchema: {
      type: "object",
      properties: { entityType: { type: "string", enum: ENTITY_TYPES }, entityId: { type: "string" } },
      required: ["entityType", "entityId"], additionalProperties: false,
    },
    run: a => api(`/api/priprava/texts?entityType=${encodeURIComponent(a.entityType)}&entityId=${encodeURIComponent(a.entityId)}`),
  },
  {
    name: "akano_submit_draft",
    description: "Pošle návrh importu ke schválení (Příprava → Texty → Import). Nic nepřepíše; uloží se až po potvrzení člověkem. texts: [{entityType (ne role), entityId, field, body}], genders: [{characterId, gender m|f}], roles: [{unitId, triplet A|B, key, nameM, nameF, body}]. Každé pole jen jednou. Vrací id návrhu a varování (např. neznámá jména v rodových značkách).",
    inputSchema: {
      type: "object",
      properties: {
        title: { type: "string", description: "Krátký název návrhu, např. „Hvězdy: texty jednotky a rolí“" },
        source: { type: "string", description: "Odkud texty jsou (název a odkaz na dokument)" },
        notes: { type: "string", description: "Co jsi upravil (rodové značky, opravy, co jsi vynechal a proč)" },
        texts: {
          type: "array",
          items: {
            type: "object",
            properties: { entityType: { type: "string", enum: ENTITY_TYPES.filter(t => t !== "role") }, entityId: { type: "string" }, field: { type: "string" }, body: { type: "string" } },
            required: ["entityType", "entityId", "field", "body"],
          },
        },
        genders: {
          type: "array",
          items: { type: "object", properties: { characterId: { type: "string" }, gender: { type: "string", enum: ["m", "f"] } }, required: ["characterId", "gender"] },
        },
        roles: {
          type: "array",
          items: {
            type: "object",
            properties: {
              unitId: { type: "string" }, triplet: { type: "string", enum: ["A", "B"] }, key: { type: "string" },
              nameM: { type: "string" }, nameF: { type: "string" }, body: { type: "string" },
            },
            required: ["unitId", "triplet", "key", "nameM", "nameF", "body"],
          },
        },
      },
      required: ["title", "texts"], additionalProperties: false,
    },
    run: a => api("/api/priprava/drafts", { method: "POST", body: JSON.stringify({ genders: [], roles: [], ...a }) }),
  },
  {
    name: "akano_list_drafts",
    description: "Návrhy importu: čekající na schválení a posledních 20 vyřízených (applied / discarded), bez obsahu.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
    run: async () => (await api("/api/priprava/drafts")).map(({ payload, ...d }) => ({
      ...d, counts: { texts: payload.texts?.length ?? 0, genders: payload.genders?.length ?? 0, roles: payload.roles?.length ?? 0 },
    })),
  },
]

const send = msg => process.stdout.write(JSON.stringify(msg) + "\n")

async function handle(msg) {
  const { id, method, params } = msg
  if (id === undefined) return // notifikace (initialized, cancelled…)
  try {
    switch (method) {
      case "initialize":
        return send({ jsonrpc: "2.0", id, result: {
          protocolVersion: params?.protocolVersion ?? "2025-06-18",
          capabilities: { tools: {} },
          serverInfo: { name: "akano", version: "1.0.0" },
        } })
      case "ping":
        return send({ jsonrpc: "2.0", id, result: {} })
      case "tools/list":
        return send({ jsonrpc: "2.0", id, result: { tools: TOOLS.map(({ run, ...t }) => t) } })
      case "tools/call": {
        const tool = TOOLS.find(t => t.name === params?.name)
        if (!tool) return send({ jsonrpc: "2.0", id, error: { code: -32602, message: `Neznámý nástroj ${params?.name}` } })
        try {
          const out = await tool.run(params.arguments ?? {})
          return send({ jsonrpc: "2.0", id, result: { content: [{ type: "text", text: JSON.stringify(out, null, 1) }] } })
        } catch (err) {
          return send({ jsonrpc: "2.0", id, result: { isError: true, content: [{ type: "text", text: String(err?.message ?? err) }] } })
        }
      }
      default:
        return send({ jsonrpc: "2.0", id, error: { code: -32601, message: `Neznámá metoda ${method}` } })
    }
  } catch (err) {
    send({ jsonrpc: "2.0", id, error: { code: -32603, message: String(err?.message ?? err) } })
  }
}

createInterface({ input: process.stdin }).on("line", line => {
  if (!line.trim()) return
  let msg
  try { msg = JSON.parse(line) } catch { return send({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "Parse error" } }) }
  handle(msg)
})
