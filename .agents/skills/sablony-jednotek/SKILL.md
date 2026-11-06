---
name: sablony-jednotek
description: Převede normálně napsaný text jednotky (veřejné, interní informace nebo osobní text role) na šablonu se značkami pro jména a rodové tvary, aby se dal vykreslit pro libovolné obsazení běhu. Použij, když uživatel přinese text k jednotce a řekne, které postavy v něm mají být proměnné, když padne „udělej z toho šablonu“, „převeď text role“, „zrodově to“ nebo „sablony-jednotek“.
---

# Šablony textů jednotky

Texty jednotky se píšou pro **roli**, ne pro postavu. V každém běhu roli drží
někdo jiný, s jiným jménem a rodem. Autor ale píše normální text pro jedno
konkrétní obsazení. Tvoje práce je nahradit v něm to, co se mezi běhy mění,
značkami.

Plná specifikace: `docs/superpowers/specs/2026-11-06-dokumenty-postav-design.md`,
sekce *Gender a šablony*.

## Syntaxe

| Značka | Výsledek | Kde smí být |
|---|---|---|
| `{@klic}` | jméno držitele role | všechny texty jednotky |
| `{@klic:role}` | název role v jeho rodě | všechny texty jednotky |
| `{@klic:mužský\|ženský}` | tvar podle držitele role | všechny texty jednotky |
| `{mužský\|ženský}` | tvar podle čtenáře (držitele role, které text patří) | jen osobní text role |

- Pořadí je vždy **mužský | ženský**.
- Varianta smí být prázdná: `jediný{|á}`, `nezasmál{|a}`.
- Žádné vnořování značek.
- Odkazuje se jen na role vlastní jednotky.

## Postup

### 1. Ujasni si zadání

Než začneš, musíš znát:

- **jednotku** a seznam jejích rolí s klíči,
- **druh textu**: veřejný, interní, nebo osobní text role. U osobního textu
  i **komu patří** a jaký rod má čtenář v původním textu,
- **mapování**: které jméno v textu je která role a jaký má rod.

Co chybí, doptej se. Nehádej mapování ze jmen: rod se nepozná podle jména,
vždycky ho vezmi ze zadání nebo z jádra postavy.

### 2. Najdi všechno, co se mění

Proměnné jsou jen lidé z jednotky, kteří jsou v zadání namapovaní na roli.
Projdi text větu po větě a u každého z nich hledej:

- **jméno** → `{@klic}`. Přezdívku nebo zdrobnělinu taky, pokud patří
  konkrétní postavě. V tom případě se doptej, protože jiný držitel ji mít
  nebude.
- **slovesa v minulém čase a podmiňovacím způsobu**: řekl/řekla, by šel/šla,
- **přídavná jména a příčestí**: sám/sama, jediný/jediná, zraněn/zraněna,
- **zájmena**: on/ona, mu/jí, ho/ji, jeho/její, s ním/s ní,
- **rodová podstatná jména**: kamarád/kamarádka, kapitán/kapitánka. Název role
  piš jako `{@klic:role}`.

U osobního textu totéž pro **čtenáře** (oslovovaného „ty“), bez `@`.

Na postavy mimo jednotku, NPC a obecné výrazy nesahej.

Ne každé sloveso u osoby se shoduje s jejím rodem. *Kdo*, *nikdo*, *každý*
a podobná zájmena berou mužský rod vždycky.

Pozor na **shodu přes větu**: „Mushashi a Mimi přišli“ se u dvou proměnných
lidí neřeší jednou značkou. Přeformuluj tak, aby význam zůstal, a uživateli to
nahlas řekni.

### 3. Vlož značky

Celé slovo piš do varianty jen tam, kde se mění kmen (`{řekl|řekla}`,
`{on|ona}`). Kde se mění jen koncovka, použij příponu (`nezasmál{|a}`).

### 4. Zkontroluj zpětným vykreslením

Až bude `lib/unit-template.ts`, spusť vykreslení s původním obsazením.
Do té doby to udělej ručně:

1. Vykresli šablonu s **původním obsazením**. Musí vyjít **přesně původní
   text**, znak po znaku. Každý rozdíl oprav a hledej znovu.
2. Vykresli šablonu s **prohozeným rodem** každé proměnné osoby (a čtenáře).
   Přečti ji celou a hledej tvary, které zůstaly v původním rodě. Ty jsi
   přehlédl.

### 5. Odevzdej

Uživateli dej:

- šablonu,
- verzi s prohozenými rody na přečtení,
- seznam míst, kde jsi text musel přeformulovat nebo si nejsi jistý.

## Příklad

Zadání: osobní text role `tichej`, čtenářka je žena. Mushashi = `kapitan`
(muž), Kaya = `princezna` (žena).

Původní text:

> Když Mushashi poprvé promluvil na nástupu, byla jsi jediná, kdo se
> nezasmál. Kaya to viděla a od té doby ji nesneseš.

Šablona:

> Když {@kapitan} poprvé {@kapitan:promluvil|promluvila} na nástupu,
> {byl|byla} jsi jediný{|á}, kdo se nezasmál. {@princezna} to
> {@princezna:viděl|viděla} a od té doby {@princezna:ho|ji} nesneseš.

„Kdo se nezasmál“ zůstává bez značky: zájmeno *kdo* se pojí s mužským rodem
bez ohledu na to, o koho jde. Zpětné vykreslení by `nezasmál{|a}` odhalilo,
protože by dalo „nezasmála“.

Prohozené rody (kapitánka, princ, čtenář muž; jména nechaná pro čitelnost):

> Když Mushashi poprvé promluvila na nástupu, byl jsi jediný, kdo se
> nezasmál. Kaya to viděl a od té doby ho nesneseš.
