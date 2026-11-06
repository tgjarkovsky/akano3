# Příprava a spis postavy — návrh rozhraní

Datum: 2026-11-06

Navazuje na `2026-11-06-dokumenty-postav-design.md` (vrstvy obsahu, datový
model, šablony). Tenhle dokument řeší rozhraní: kde a jak organizátoři texty
píšou, schvalují a obsazují do běhu, a jak je hráč čte a tiskne.

## Rozhodnutí

| # | Otázka | Rozhodnutí |
|---|---|---|
| U1 | Oddělení adminu | **Příprava** je samostatná stránka `/priprava` s heslem ověřeným na serveru. **Velín** (dnešní GM přehled) zůstává pro řízení hry. |
| U2 | Stav textů | prázdné → rozepsané (automaticky) → **hotovo** (autor odškrtne) → **schváleno** (druhý člověk zkontroluje). |
| U3 | Kdo je autor | Výběr jména ze seznamu organizátorů, prohlížeč si ho pamatuje. Bez účtů. |
| U4 | Editor textů | Matice postupu jako přehled. Klik otevře tři sloupce: strom entit, editor, náhled hráče. |
| U5 | Obsazení běhu | Nástěnka jednotek (týmy do trojic, role) a pod ní tabulka postav (specializace, původ, kruhy). Kontroly stále na očích. |
| U6 | Hráčské zobrazení | **Pavouk postavy** po vzoru mapy knihovny a k němu **spis** pro dlouhé texty a tisk. |
| U7 | Vztahy | Strukturované: cíl + krátký popisek na hranu + delší text. |
| U8 | Rozsah pavouka | Okolí postavy, ostatní jednotky a kruhy se rozbalí klepnutím. |
| U9 | Kdy hráč dokument vidí | Až GM běh **zveřejní**. Do té doby po přihlášení nic nevidí. |

## Rozdělení adminu

### Velín (`/character/GM-…`, dnešní GM přehled)

Zůstává: Přehled, Zadávání bodů, Log, Grafy, Kaichi, QR, Alarm, Nastavení
(lekce, pool darů).

Odchází do Přípravy: **Běhy** a **Wiki**. Velín jen ukazuje aktivní běh
a jeho stav zveřejnění, nic z přípravy nemění. Během hry tak GM nemůže
omylem přepsat obsazení nebo text.

### Příprava (`/priprava`)

Přihlášení heslem = stávající `ADMIN_TOKEN`. Zadá se jednou, drží se
v `sessionStorage` a posílá jako hlavička `x-admin-token`. Všechny zápisy
a čtení neveřejných textů jdou přes `adminGuard`.

Po přihlášení výběr „Kdo jsi“ ze seznamu organizátorů (konstanta v kódu,
uložená volba v `localStorage`, dá se kdykoli změnit v hlavičce).

Levé menu:

1. **Přehled**: postup textů po kategoriích, připravenost běhů, poslední změny.
2. **Texty**: matice a editor.
3. **Běhy a obsazení**: seznam běhů, nástěnka, tabulka, zveřejnění.
4. **Knihovna**: dnešní `wiki-admin.tsx` beze změny chování.
5. **Tisk**: dokumenty jednoho běhu najednou.

Vzhled: tmavé téma `theme-ink` jako Velín, ať je jasné, že jde o zákulisí.
Náhled hráče uvnitř Přípravy se vykresluje ve světlém papírovém tématu,
přesně jak ho uvidí hráč.

## Texty

### Stav textu

Jednotkou stavu je **jedno textové pole** jedné entity (např. „Mimi ·
vnitřní svět“, „Murakami · interní“, „role kapitán · osobní“, jeden vztah).

| Stav | Jak vznikne | Zobrazení |
|---|---|---|
| prázdné | pole je prázdné | šedý rámeček |
| rozepsané | pole má text, nikdo nedal Hotovo | žlutá |
| hotovo | autor odškrtne „Hotovo“ | modrá, jméno a datum |
| schváleno | jiný organizátor odškrtne „Schválit“ | zelená, jméno a datum |

- Úprava hotového nebo schváleného textu ho vrací na **rozepsané** a stav
  ukazuje „změněno po schválení“, ať se nic nedostane k hráčům bez kontroly.
  Drobné opravy (překlep) jde uložit s volbou „Neměnit stav“.
- Schválit vlastní text jde, ale aplikace upozorní („schvaluješ vlastní
  text“). Zákaz by blokoval práci, když je někdo sám.

```sql
text_status (
  entity_type TEXT,   -- 'character' | 'team' | 'unit' | 'role' | 'circle' | 'trait' | 'relationship'
  entity_id TEXT,
  field TEXT,         -- 'legends', 'inner_world', 'public', 'internal', 'personal', …
  status TEXT NOT NULL, -- 'done' | 'approved'; prázdné a rozepsané se počítají z textu
  done_by TEXT, done_at TIMESTAMPTZ,
  approved_by TEXT, approved_at TIMESTAMPTZ,
  text_updated_by TEXT, text_updated_at TIMESTAMPTZ,
  PRIMARY KEY (entity_type, entity_id, field)
)
```

### Matice postupu

Úvodní obrazovka Texty. Nahoře záložky kategorií s počtem schválených:
Postavy 18/30, Týmy, Jednotky, Role, Kruhy, Specializace a původy.

- řádek = entita, sloupec = textové pole, buňka = barevný stav,
- filtr: „jen moje“, „čeká na schválení“, „změněno po schválení“,
- součty na konci řádku i sloupce,
- klik na buňku otevře editor přímo na tom poli.

### Editor (tři sloupce)

- **Vlevo strom**: kategorie → entity, u každé tečka nejhoršího stavu.
- **Uprostřed editor**: záložky polí entity se stavem. Velké pole v patkovém
  písmu (Spectral), šířka řádku ~70 znaků. Automatické ukládání s indikací
  „uloženo“. Dole tlačítka „Hotovo“ / „Schválit“ a kdo kdy.
- **Vpravo náhled hráče**: vykreslení přes `wiki-renderer.tsx`, u textů
  jednotky s přepínačem rodu každé role (šablony z dokumentu postav).

Na úzkém displeji náhled schová do přepínače Editor | Náhled.

### Vztahy

Editor vztahů je seznam, ne volný text. Každý vztah:

- **cíl**: postava, role ve vlastní jednotce (u osobního textu role), nebo
  NPC (jméno jako text),
- **popisek na hranu**: 1–4 slova („dlužím jí“, „nevěří mi“),
- **text**: delší popis,
- stav jako každé jiné pole.

```sql
relationships (
  id SERIAL PRIMARY KEY,
  owner_type TEXT NOT NULL,  -- 'character' (jádro) | 'role' (osobní text role)
  owner_id TEXT NOT NULL,
  target_type TEXT NOT NULL, -- 'character' | 'role' | 'npc'
  target_id TEXT,            -- id postavy nebo klíč role
  npc_name TEXT,
  label TEXT NOT NULL,
  text TEXT,
  sort_order INT
)
```

Pole `relationships` v `character_cores` se ruší. Vztahy role k jiné roli se
při skládání dokumentu vyřeší podle obsazení běhu, stejně jako šablony.
Převod dnešních vztahů v bodech udělá AI (skill), autor jen zkontroluje.

## Běhy a obsazení

### Seznam běhů

Karta běhu: název, stav (**rozpracovaný / připravený / zveřejněný /
aktivní**), počet problémů obsazení, podíl schválených textů, které běh
použije.

- **Aktivovat** = běh, který řídí Velín (dnešní chování).
- **Zveřejnit dokumenty** = hráči vidí spis a pavouka. Jde jen bez chyb
  obsazení. Neschválené texty jsou varování s potvrzením („3 texty nejsou
  schválené, zveřejnit i tak?“).
- **Zrušit zveřejnění** jde kdykoli.

```sql
ALTER TABLE runs ADD COLUMN docs_published_at TIMESTAMPTZ;
```

### Nástěnka jednotek

- Sloupec na jednotku, v něm sloty **A** a **B**. Vpravo sloupec
  **Nezařazené týmy** a panel **Kontroly**.
- Tým se do slotu přetáhne. Na dotyku a pro klávesnici je náhradou výběr
  „Přesunout do…“.
- Ve slotu tři řádky rolí, u každé výběr ze tří postav týmu. Výběr jedné
  postavy ji z ostatních dvou výběrů odebere.
- U role tečka stavu jejího osobního textu.

### Tabulka postav

Pod nástěnkou. Řádek = postava: tým, jednotka a role (jen pro čtení, mění se
na nástěnce), specializace, původ, kruhy.

- Pevné hodnoty se zámkem, variabilní jako výběr jen z povolených.
- Kruhy jako čipy s výběrem.
- Ikona stavu řádku: všechno vyplněné / co chybí.

### Kontroly

Stálý panel, každá položka je odkaz na místo problému:

- chyby (blokují zveřejnění): prázdný slot, neobsazená role, hodnota mimo
  povolené, chybějící specializace nebo původ,
- varování: neschválený text, který běh použije, šablona s chybou.

## Hráč

Nová záložka **Postava** v hráčském přehledu. Před zveřejněním běhu je
prázdná s textem „Dokumenty ještě nejsou k dispozici.“

### Pavouk

Graf okolí postavy, vizuálně příbuzný mapě knihovny:

- **uprostřed** já,
- **první kruh** můj tým, moje jednotka, moje kruhy,
- **druhý kruh** jejich členové a cíle mých vztahů (postavy i NPC),
- **hrany**: příslušnost (tenká neutrální) a moje vztahy (barevné,
  s popiskem, jen já je vidím),
- klepnutí na **jinou jednotku nebo kruh** rozbalí jejich členy.

Rozložení je **radiální a deterministické** (kruhy kolem středu), ne volná
simulace. Na telefonu se tak nic neposouvá, je čitelné a dá se zapamatovat.
Pan a zoom stejně jako mapa knihovny.

Klepnutí na uzel otevře **čtecí panel**: na telefonu spodní vysouvací panel,
na notebooku stálý panel vpravo. Panel ukazuje:

- veřejné informace uzlu,
- interní informace, jen pokud do skupiny patřím. Jinak cenzurní pruhy
  ███ jako u zamčených částí knihovny: hráč vidí, že něco existuje, ne co,
- u postavy můj vztah k ní (pokud je),
- řádek „Souvisí“ s čipy jako v knihovně.

Každý blok nese štítek viditelnosti: **veřejné** / **interní** / **jen ty**.

### Spis

Klepnutí na vlastní uzel (a tlačítko „Celý spis“) otevře spis na celou
šířku: jeden dlouhý dokument, nahoře lepivé záložky Já · Tým · Jednotka ·
Kruhy.

- patkové písmo, 17–18 px, šířka řádku do ~65 znaků, papírové téma,
- legendy a vnitřní svět otevřené, ostatní sekce sbalitelné,
- jména v textu jsou odkazy, které vrátí do pavouka na daný uzel,
- štítky viditelnosti u každé sekce.

### Tisk

`/postava/[kód]/tisk` vykreslí spis s tiskovým CSS:

- A4, Spectral, všechno rozbalené, bez navigace,
- titulní strana: jméno, přezdívka, tým, jednotka, role, specializace, původ,
- každá vrstva na nové stránce, štítky viditelnosti i na papíře,
- vztahy jako tabulka (s kým, popisek, text) místo grafu.

V Přípravě **Tisk** vykreslí všechny postavy běhu za sebou se zalomením
stránky, takže jedno „Tisknout / Uložit jako PDF“ v prohlížeči stačí.

### Revize 2026-11-06: spis přes tajný odkaz

Hráči dostanou **odkaz do aplikace**, tisk je tlačítko na té stránce.

- Každá postava má na každý běh tajný odkaz `/spis/[odkaz]` (18 náhodných
  bajtů, tabulka `doc_links`). Vytváří ho Příprava → **Spisy hráčů**, kde jde
  odkaz zkopírovat, otevřít jako hráč a nahradit novým (starý přestane platit).
- Zveřejnění je na běh (tabulka `run_docs`). Před zveřejněním odkaz ukáže
  „Spis se připravuje“. Zveřejnění s neschválenými texty se potvrzuje.
- Spis skládá `lib/character-doc.ts`: titulní strana (tým, spoluhráči,
  jednotka, specializace, původ, kruh, obsah, legenda štítků) a kapitoly
  Já · Tým · Jednotka · Kruh · Specializace a původ. Prázdné texty se vynechají.
- Vzhled: bílý papír, černý text, barva jen na číslech kapitol. Štítky
  viditelnosti se liší obrysem (plný, tlustý, čárkovaný), ne barvou.
  Jádro začíná na nové stránce, další kapitoly navazují.
- Příprava tiskne jednu postavu nebo celý běh (každý spis od nové stránky).
- Role v jednotce a šablony rodů ve spisu zatím nejsou: obsazení rolí na běh
  ještě neexistuje. Osobní wiki v aplikaci (pavouk) přijde jako další krok.

## API

| Routa | Přístup | Vrací |
|---|---|---|
| `GET /api/character-doc` | token z přihlášení, běh musí být zveřejněný | spis a graf jedné postavy, se všemi texty, které smí vidět |
| `GET /api/public-docs` | veřejné, jen zveřejněný běh | veřejné texty skupin, specializace a původy |
| `/api/priprava/*` | `adminGuard` | čtení a zápis textů, stavů, vztahů, obsazení |

**Kódy postav dnes nejsou tajné.** Jsou v `lib/data.ts`, které se posílá do
prohlížeče (přihlášení porovnává kód na klientovi), a jsou navíc
předvídatelné (`STU-001`, `STU-002`…). Kdokoli by si tak přečetl cizí spis.
Před zavedením `character-doc` proto:

- každá postava dostane **náhodný tajný kód** pro běh, uložený jen
  v databázi (generuje ho Příprava, tiskne se na titulní stranu spisu),
- přihlášení ověří kód na serveru (`POST /api/login`) a vrátí krátký token,
  který pak chodí s požadavky na neveřejné texty,
- kódy z `lib/data.ts` zmizí a herní přihlášení přejde na stejnou cestu.

## Postup

1. **Kostra Přípravy**: `/priprava`, heslo, výběr organizátora, přesun Běhů
   a Knihovny z Velínu.
2. **Texty**: tabulky z dokumentu postav, `text_status`, matice, editor se
   třemi sloupci, Hotovo / Schválit.
3. **Vztahy**: tabulka, editor, převod z dnešních bodů.
4. **Obsazení**: nástěnka, tabulka, kontroly, zveřejnění běhu.
5. **Spis a tisk**: tajné kódy a přihlášení přes server, `character-doc`, záložka Postava se spisem, tisková
   stránka, hromadný tisk.
6. **Pavouk**: radiální graf, čtecí panel, rozbalování.
7. **Šablony**: náhled s přepínačem rodů, kontrola zpětného vykreslení.

Každý krok jde nasadit samostatně. Hráčská část (5–6) dává smysl až
s alespoň několika schválenými texty.

## Otevřené

- Seznam organizátorů (jména).
- Jestli NPC potřebují vlastní stránku s veřejným textem, nebo stačí jméno
  na hraně.
- Zda má být po zveřejnění vidět i pavouk ostatních jednotek v plném
  rozsahu, nebo jen jejich veřejný popis bez členů.
