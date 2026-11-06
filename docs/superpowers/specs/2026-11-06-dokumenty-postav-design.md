# Dokumenty postav — návrh

Datum: 2026-11-06

Jak hráčům předávat texty k postavám. Každý hráč dostane dokument složený
z několika vrstev: jádro postavy, texty týmu, jednotky, role a kruhů. Část
vrstev je pevná, část se mění podle obsazení konkrétního běhu. Aplikace
dokument skládá sama, takže při přeskupení mezi běhy se texty nekopírují
ručně.

## Rozhodnutí

| # | Otázka | Rozhodnutí |
|---|---|---|
| R1 | Co je „jednotka“ | `Unit` v kódu: dva týmy, šest postav. |
| R2 | Co je tým | Pevná trojice jader. Ve všech bězích jsou ty tři postavy spolu. Tým nemá role. |
| R3 | Přesuny mezi běhy | Tým se přesouvá do jiné jednotky jako celek. Některé týmy zůstávají ve stejné jednotce, jiné ne. |
| R4 | Role | Patří jednotce. Jednotka má 6 rolí ve dvou trojicích (A, B). Každý tým obsadí jednu trojici. |
| R5 | Co se určuje na každý běh | Tým → jednotka + trojice, postava → role v trojici, postava → kruhy, postava → specializace + původ. |
| R6 | Osobní informace | Patří k roli, ne k dvojici postava × role. Jinak by texty rostly kombinatoricky. |
| R7 | Specializace a původ | Obojí jsou tři možnosti, každá s krátkým veřejným textem. Postava má seznam povolených hodnot: jednu (pevná), dvě („tyhle, ale tuhle ne“) nebo tři (volná). |
| R8 | Kde žijí texty | V databázi aplikace s editorem v GM panelu. Dnes jsou rozházené po Google Drive. Jednorázově se převedou. |
| R9 | Forma pro hráče | Přehledně a interaktivně v aplikaci a zároveň vytisknutelné. |
| R10 | Gender | Je pevně daný v jádru postavy (m / ž). Jedinou postavu s možností obou pohlaví řešíme zvlášť a později. |
| R11 | Kde je potřeba rodová shoda | Jen v textech jednotky: veřejné, interní, osobní texty rolí. Týmy mají pevné postavy, kruhy nemají osobní texty. |
| R12 | Jak vznikají šablony | Autor napíše normální text pro jedno konkrétní obsazení. AI v něm podle zadání nahradí proměnná jména a tvary značkami. Aplikace převod ověří zpětným vykreslením. |

## Vrstvy obsahu

| Vrstva | Pevné / na běh | Texty | Kdo vidí |
|---|---|---|---|
| **Jádro postavy** | pevné | legendy (3. osoba), vnitřní svět (1. osoba), shrnutí v bodech, vztahy v bodech, odpovědi na tři otázky | jen postava |
| **Specializace** | 3 možnosti, volba na běh | krátký popis | všichni |
| **Původ** | 3 možnosti, volba na běh | krátký popis | všichni |
| **Tým** | pevné složení | veřejné / interní | všichni / členové týmu |
| **Jednotka** | týmy na běh | veřejné / interní | všichni / členové jednotky |
| **Role v jednotce** | postava na běh | osobní informace | jen držitel role |
| **Kruh** | členové na běh | veřejné / společné | všichni / členové kruhu |

Tři otázky jádra:

1. Proč se potřebuji stát lovcem?
2. Co dalšího chci, mimo to stát se lovcem?
3. Čím vystupuju z řady?

### Zásady pro psaní

- **Vztahy v jádru** se nesmí opírat o jednotku. Jednotka se mezi běhy mění,
  takže vztah k někomu, kdo je jen „ze stejné jednotky“, by v jiném běhu
  neplatil. Do jádra patří vztahy k týmu (ten je pevný), k lidem mimo jednotku
  a k NPC. Vztahy uvnitř jednotky se píšou do osobních informací role.
- **Texty týmu** platí ve všech bězích, takže nezmiňují jednotku.
- **Texty jednotky** nesmí počítat s konkrétní postavou. Roli může v různých
  bězích držet kdokoli z týmu, který trojici obsadí. Jména a rodové tvary lidí
  z jednotky se proto píšou šablonou, viz *Gender a šablony*.

## Datový model

Postavy, týmy, jednotky a kruhy zůstávají v `lib/data.ts` (ID, jména, složení
týmů). Nové tabulky drží jen texty a obsazení.

### Texty (bez `run_id`)

```sql
character_cores (
  character_id TEXT PRIMARY KEY,
  gender TEXT NOT NULL,    -- 'm' | 'f'
  legends TEXT, inner_world TEXT, summary TEXT, relationships TEXT,
  why_hunter TEXT, other_wants TEXT, stands_out TEXT,
  allowed_specializations TEXT[] NOT NULL,  -- podmnožina combat/tactical/support
  allowed_origins TEXT[] NOT NULL,          -- podmnožina tří původů
  updated_at TIMESTAMPTZ
)

trait_options (            -- specializace a původy
  kind TEXT,               -- 'specialization' | 'origin'
  key TEXT,
  name TEXT, public_text TEXT,
  PRIMARY KEY (kind, key)
)

group_docs (               -- tým, jednotka, kruh
  group_type TEXT,         -- 'team' | 'unit' | 'circle'
  group_id TEXT,
  public_text TEXT,
  internal_text TEXT,      -- u kruhu „společné“
  PRIMARY KEY (group_type, group_id)
)

unit_roles (
  id SERIAL PRIMARY KEY,
  unit_id TEXT NOT NULL,
  triplet TEXT NOT NULL,   -- 'A' | 'B'
  key TEXT NOT NULL,       -- klíč pro šablony, např. 'kapitan'; unikátní v jednotce
  name_m TEXT NOT NULL,    -- „kapitán“, „ten tichej“…
  name_f TEXT NOT NULL,    -- „kapitánka“, „ta tichá“…
  personal_text TEXT,
  sort_order INT
)
```

Původy dnes v kódu nejsou. Jejich klíče a jména se doplní do `lib/constants.ts`
vedle specializací.

### Obsazení (na běh)

```sql
ALTER TABLE team_units ADD COLUMN triplet TEXT;  -- 'A' | 'B'

character_assignments (
  run_id INT, character_id TEXT,
  role_id INT REFERENCES unit_roles(id),
  origin TEXT,
  PRIMARY KEY (run_id, character_id)
)
```

Specializace na běh už existuje v `character_state.specialization` a GM ji
může měnit během hry. Obsazení do ní zapíše počáteční hodnotu, žádný druhý
sloupec se nezavádí.

Tabulka `character_assignments` je zároveň místem pro budoucí vazbu hráč →
postava z roadmapy (směr 1, krok 5).

### Kontroly obsazení

Validace ve stylu `lib/*-validation.ts`, s unit testem:

- v každé jednotce má každá trojice právě jeden tým,
- role postavy patří do jednotky a trojice jejího týmu,
- každá role obsazené trojice má právě jednoho držitele,
- specializace a původ jsou v povolených hodnotách postavy,
- každá obsazená role, tým, jednotka a kruh mají napsané texty (varování,
  ne chyba, ať jde obsazovat i s rozepsaným obsahem).

## Gender a šablony

Texty jednotky se píšou pro roli, ne pro postavu. V různých bězích je čte
a v nich vystupuje pokaždé někdo jiný, s jiným jménem a rodem. Aplikace při
skládání dokumentu obsazení zná, takže šablonu vykreslí správně sama.

### Syntaxe

| Značka | Výsledek | Kde smí být |
|---|---|---|
| `{@kapitan}` | jméno aktuálního držitele role | všechny texty jednotky |
| `{@kapitan:role}` | název role ve správném rodě (`name_m` / `name_f`) | všechny texty jednotky |
| `{@kapitan:řekl\|řekla}` | tvar podle držitele role | všechny texty jednotky |
| `{byl\|byla}` | tvar podle čtenáře, tedy držitele role, které text patří | jen osobní text role |

- Pořadí je vždy **mužský | ženský**.
- Varianta smí být prázdná, takže jde psát jen přípona: `jediný{|á}`,
  `{@kapitan:sám|sama}`.
- Odkazovat lze jen na role vlastní jednotky. Postavy mimo jednotku a NPC se
  píšou jménem, jejich rod se nemění.
- Značky se v textu nevnořují.

Parser a vykreslení: čistá funkce `lib/unit-template.ts`
`(text, držitelé rolí, čtenář?) → text`, s unit testem.

### Kontroly

- neznámý klíč role,
- značka bez `|` (kromě `{@klic}` a `{@klic:role}`),
- `{…|…}` bez `@` mimo osobní text role,
- neuzavřená závorka.

Při ukládání v editoru jde o chybu, ne varování.

### Postup psaní

1. Autor napíše text normálně, pro jedno konkrétní obsazení: se skutečnými
   jmény a rody.
2. AI dostane text, jednotku, roli, které text patří, a mapování jmen na role.
   Proměnná jména a tvary nahradí značkami. Postup popisuje skill
   `.agents/skills/sablony-jednotek`.
3. **Zpětné vykreslení**: šablona vykreslená se stejným obsazením, ze kterého
   text vzešel, musí dát **přesně původní text**. Každý rozdíl je chyba
   převodu.
4. Autor si přečte verzi s opačnými rody. To je jediné ruční čtení.

Editor proto potřebuje náhled s přepínačem rodu u každé role a pole
„původní text“ pro kontrolu zpětného vykreslení.

## Skládání dokumentu

Čistá funkce `lib/character-doc.ts`:
`(postava, obsazení běhu, texty) → dokument`. Výsledek je pole sekcí v pevném
pořadí:

1. Hlavička: jméno, přezdívka, tým, jednotka, role, specializace, původ, kruhy
2. Jádro: legendy, vnitřní svět, tři otázky
3. Shrnutí a vztahy
4. Tým: veřejné, interní
5. Jednotka: veřejné, interní, moje role (osobní informace)
6. Kruhy: veřejné, společné

Stejná funkce slouží aplikaci, tisku i náhledu v GM panelu.

## Přístup a bezpečnost

Dnes hráč nemá žádné serverové ověření. Přihlášení kódem probíhá na klientovi
a `/api/game-state` je veřejné. Jádro, interní a osobní texty ale nesmí
uniknout ostatním hráčům.

- Neveřejné texty **nikdy nejdou přes `/api/game-state`**.
- Nová routa `GET /api/character-doc` přijímá **kód postavy** (ne ID, to je
  vidět v game-state) a vrátí jen dokument té postavy. Server sám rozhodne,
  které interní texty k ní patří.
- Veřejné texty (týmy, jednotky, kruhy, specializace, původy) můžou jít
  zvlášť veřejnou routou a zobrazit se i ostatním, např. na kartě osoby
  v záložce Lidé.
- Zápis textů a obsazení jen přes `adminGuard`.

## Hráčská aplikace

Nová záložka **„Moje postava“** ve `student-dashboard.tsx`:

- sekce jako sbalitelné bloky, jádro otevřené, zbytek sbalený,
- jména ve vztazích a v textech jako odkazy na kartu osoby (`person-card.tsx`),
- vykreslení textů přes stávající `wiki-renderer.tsx`, ať se nepíše druhý
  markdown,
- funguje na šířce 360–390 px.

## Tisk

Stránka `/postava/[kód]/tisk` se stejným dokumentem a tiskovým CSS:
všechny sekce rozbalené, bez navigace, zalomení stránky před každou hlavní
sekcí. Do PDF přes tisk prohlížeče, žádná knihovna na generování PDF.

GM panel umí vytisknout dokumenty všech postav běhu najednou.

## GM panel

- **Editor textů**: postavy, týmy, jednotky s rolemi, kruhy, specializace
  a původy. Podobně jako `wiki-admin.tsx`. U textů jednotky náhled
  s přepínačem rodů a kontrola zpětného vykreslení.
- **Obsazení běhu**: tým → jednotka + trojice, postava → role, specializace,
  původ, kruhy. Pevné hodnoty předvyplněné a zamčené. Kontroly vidět přímo
  v tabulce.
- **Náhled dokumentu** libovolné postavy v aktuálním obsazení.

## Převod z Google Drive

Jednorázově. Texty se ručně nebo poloautomaticky (přes Google Drive konektor)
přepíšou do seed routy po vzoru `app/api/admin/seed-wiki/route.ts`. Pak se
edituje už jen v aplikaci a Drive přestává být zdrojem pravdy.

## Postup

1. Migrace tabulek, `lib/character-doc.ts`, `lib/unit-template.ts`
   a validace obsazení s testy.
2. Obsazení běhu v GM panelu (rozšíření `run-setup.tsx`).
3. Editor textů v GM panelu.
4. Routa `/api/character-doc` a záložka „Moje postava“.
5. Tisková stránka.
6. Převod textů z Drive.

## Otevřené

- **Seznam dokumentů na Drive**: které soubory a taby jsou zdrojem (např.
  „Jádra + Týmy“), aby šel naplánovat převod.
- **Kdy hráči dokumenty dostanou**: čtení před hrou znamená, že kód postavy
  dostanou dopředu. Kód pak funguje i jako přihlášení do hry.
- **Veřejné informace během hry**: jestli je ostatní uvidí hned od začátku,
  nebo až po nějaké herní události.
- **Specializace změněná během hry**: jestli se má promítnout do dokumentu,
  nebo dokument ukazuje stav z obsazení.
