# Import textů z Google dokumentů přes Clauda

Claude čte dokument svým Google Drive konektorem, texty upraví (rodové značky,
rozdělení do polí, opravy) a pošle je do Akano jako **návrh importu**. Nic se
neuloží, dokud návrh v Příprava → Texty → Import někdo neprojde a nepotvrdí.

## Nastavení (jednou)

1. Vygeneruj token (aspoň 24 znaků), např. `openssl rand -hex 24`.
2. Ve Vercelu nastav proměnnou prostředí `IMPORT_TOKEN` na tuhle hodnotu a znovu nasaď.
3. U sebe ulož stejnou hodnotu do `~/.config/akano/import-token` (nebo do proměnné `AKANO_IMPORT_TOKEN`).
4. Přidej MCP server do `.mcp.json` v kořeni repa (je v .gitignore, každý si ho dělá sám):
   `{"mcpServers":{"akano":{"command":"node","args":["scripts/akano-mcp.mjs"]}}}`.
   Claude Code se při prvním spuštění zeptá, jestli ho povolit. Jiná adresa než produkce: `AKANO_URL`.

Token smí jen číst texty a katalog a posílat návrhy. Ukládat, mazat a schvalovat
dál jde jen s heslem Přípravy. Token se zneplatní změnou `IMPORT_TOKEN`.

## Nástroje

- `akano_catalog` — návod, pole, postavy s rody, týmy, jednotky, kruhy, role, stav textů
- `akano_get_texts` — současné texty jedné entity
- `akano_submit_draft` — pošle návrh (stejný formát jako soubor importu, plus `title`, `source`, `notes`)
- `akano_list_drafts` — čekající a vyřízené návrhy

## Rodové značky

Postavy můžou v různých bězích hrát muži i ženy. Spis dosadí správný tvar:

| Značka | Význam |
| --- | --- |
| `{byl\|byla}` | rod čtenáře spisu (i ve sdíleném textu týmu, jednotky, kruhu) |
| `{Skála: byl\|byla}` | rod jmenované postavy (jméno nebo id) |
| `přiš{el\|la}`, `člen{\|ka}` | jen měnící se část slova |
| `{@ctitel}` | jméno postavy, která roli drží (klíč role v jednotce textu); bez držitele název role |
| `{@ctitel: zranil\|zranila}` | rod držitele role |

Držitele role určuje Obsazení běhu (výběr role u člena týmu na nástěnce jednotek)
nebo pevná role z Pravidel; platí jen, když tým v běhu stojí v jednotce a trojici té role. U textu jednotky nebo role platí
klíč v té jednotce, u textů týmu a postavy v jednotce čtenáře.

Mužský tvar je první. Bez známého rodu se ukáže `byl/byla`. Značky se rozvinou
ve spisu hráče; v editoru a v náhledu importu zůstávají, jak jsou napsané.
