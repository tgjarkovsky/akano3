# Vizuální manuál Akano3

Přepis dokumentu „WIP Manuál k vizuální identitě Akano3“ (autorka Ata).
Zdroj: https://docs.google.com/document/d/1XsV_QFW_3eUGwurYip2ONgiX1PG8oU9IRwpikP8H_mM/edit
Staženo 2026-11-27. Manuál je rozpracovaný (sekce Web, Sociální sítě, Dokumenty
jsou zčásti TBA). Když se originál změní, tenhle soubor aktualizuj.
Obrázky z originálu tu nejsou, ukázky hledej v Google Docu.

Týká se vizuální prezentace hry a vizuální prezentace školy ve hře, **neplatí
pro všechny ingame vizuály**. Konzultace a ilustrace: Ata.

**Jak se manuálem řídit:** ne vždy plně striktně, ale **vždy upozornit**, když
něco není v souladu (co, proč, a jestli jde o vědomou výjimku).

---

## Shrnutí základů (to go)

### Barvy

| Hlavní | Doplňkové |
|---|---|
| `#72150C` rudá | `#060606` černá |
| `#14797C` petrolejová | `#FFFFFF` bílá |
| `#DDB57E` okrová | |

### Písma

- **Inria Serif**: texty; v bold nižší úrovně nadpisů (h3 a dál); bold
  i kurzíva pro zvýraznění v běžném textu.
- **Inknut Antiqua**: titulky, vyšší nadpisy (h1, h2), **pouze regular**.
- Obě na Google Fonts, licence OFL (volně digitálně i v tisku, komerčně i nekomerčně).

### Logo

[Ke stažení na disku](https://drive.google.com/drive/folders/1fO4IgYiv-SKf_FEkKTFI5Jv-UFv-DgMs?hl=cs).
Vysoká verze je vhodnější pro web, menší pro profilovky a dokumenty.
Na webu nutné; na dokumentech a v postech není nutné vždy.

### Styl

| Toto ano | Toto ne |
|---|---|
| barevné flat plochy | 3D, stíny |
| černá/bílá linka (kolem prvků) | kulaté okraje rámečků/fotek |
| vektorové ilustrace | jiné barevné schéma |
| symboly, siluety, japonské vzory | realismus (mimo fotky) |

### Odkazy

- [Souhrnná složka grafických materiálů](https://drive.google.com/drive/folders/12m0iMOfuTkjhwWwxScL96rJdowtXOa15?usp=drive_link)
- [Pool prvků](https://drive.google.com/drive/folders/1OygqvTZqqE806efL7oCKg7tpTccWs1xz?usp=drive_link)
- [Již použité ilustrace](https://drive.google.com/drive/folders/1vgELyK933VDL0LO4bDkIU6FvoX80DWsu?usp=drive_link)
- Šablony pro sítě a dokumenty: zatím nejsou.

---

## Barvy: použití

- Všechen vizuál má pozadí v **jedné z hlavních barev** (kromě dokumentů).
  Druhá hlavní barva je pro většinu prvků, třetí pro detaily.
- Na detaily může být i **bílá**, ideálně jeden prvek / typ prvku na vizuál
  (např. Měsíc, oční bělmo).
- **Linky** jsou černé nebo bílé (klidně obojí, zdvojená linka).
- **Text na barevném pozadí je vždy bílý nebo černý** podle pozadí.
- Text na bílém pozadí smí být barevný (rudý, petrolejový) nebo černý; to je
  specifické pro dokumenty.

### Povolené (bezpečné) kombinace

| Text a pozadí | Prvky na pozadí |
|---|---|
| rudé pozadí + bílý text | okrové na rudém |
| petrolejové pozadí + bílý text | bílé na rudém |
| okrové pozadí + černý text | okrové na petrolejovém |
| bílé pozadí + rudý text (dokumenty) | bílé na petrolejovém |
| bílé pozadí + petrolejový text (dokumenty) | petrolejové na okrovém |
| | rudé na okrovém |

**Pozor:** rudá a petrolejová mají na sobě malý kontrast. Nemají sdílet
většinu hrany (petrolejový prvek převážně na rudém a naopak). Když to jinak
nejde, doplň aspoň část hranice bílou linkou. Lépe fungují dvě velké plochy
(země a nebe) než malé prvky v moři druhé barvy. Pro jistotu se kombinaci vyhni.

## Písma: podrobně

| | Inria Serif | Inknut Antiqua |
|---|---|---|
| Použití | texty, nadpisy úrovně 3 a dál | titulky, nadpisy 1 a 2 |
| Řezy | Regular (text), Bold (nadpisy, zvýraznění), Italic (zvýraznění) | pouze Regular |

**Velikosti:** zatím TBA. Platí: minimální velikost písma **11–12 px**,
nadpisy rozumně větší, velikosti konzistentní napříč vizuálem.

## Prvky a ilustrace

- Flat, vektorové, z našich barev. Bez stínů, 3D a stínování, nejvýš
  siluetový realismus. Skládané z jednotlivých prvků.
- Prvky z poolu jde s citem skládat a přebarvovat v rámci našich barev.
- Prvky mimo pool (např. Canva): jednobarevné (přebarvit do našich barev),
  jednodušší symboly, siluety lidí/předmětů/budov (ne realistické ani
  příliš stylizované, ne složité), kaňky a inkoustové tahy.
- **Ilustrace nikdy nemá vytvářet AI.**
- Povolené, zatím nezahrnuté: vzory typu sashiko, japonské linkové vzory
  (v našich barvách, ideálně tenké).

## Web

Vzor: [akano.rolling.cz](http://akano.rolling.cz). Sekce je v manuálu TBA.

Zásadní prvky:

- **Okrové tělo s pevnou šířkou**, za ním pozadí, které se roztahuje podle obrazovky.
  - Bonus: tělo se mezi sekcemi úrovně 1 odlamuje „čarou“ barvy pozadí.
- Většina prvků **nemá linku** kolem sebe.
- Dodržet povolené kombinace barev.
- **Tlačítka** jsou buď custom (viz menu webu), nebo **obdélníky bez oblých rohů**.
- Tlačítka používají **Inknut Antiqua**, jinak platí sekce Písma.
- Pro záhlaví lze využít některou z již použitých ilustrací.
- **Patička** není součástí těla, ideálně je na všech webech stejná.
- **Logo** ideálně vlevo nahoře u těla.
- Obrázky mají **ostré rohy**.
- Dodělat (TBA): tlačítka, menu, okraje (spíš ne), velikosti písma, vzdálenosti, patička.

## Sociální sítě

TBD. Budou šablony pro příspěvky s textem v obrázku; lze čerpat z poolu
ilustrací a prvků.

## Dokumenty

TBD (šablony v gdocs). Typy: školní (unifikované dle identity), jiné herní
(můžou se úplně lišit), postavy (navrhne Ata), design dokument.
Vycházejí ze stylů manuálu, písem a barev; někde písmo v hlavních barvách,
některé ne na bílém pozadí.

## Vizuální styl

### Charakter

Barevné flat plochy (jednobarevné, nestínované, bez 3D), siluetové vektorové
ilustrace, jako doplněk simple linky (černé, bílé). Spíš méně prvků, výrazné,
ale trochu matné barvy, ne křiklavé. Evokuje japonské vizuály a kaligrafii
(písmem, plochostí, kontrastem). Pozadí výrazné v jedné z barev, kromě
dokumentů **ne bílé**. Černá a bílá jsou pro linky a ozvláštňující prvky.

### Nogos

Bílé pozadí (kromě dokumentů), jiné barvy (neonové i jiné základní; míříme
k matnějším tónům), **kulaté rohy, stíny, 3D**, realistická ilustrace,
**blend**, moderní písma.

### Kam se dá jít dál

- Koláž plochých jednobarevných siluetových ilustrací; jednoduché, ideálně
  diegetické symboly (Měsíc ano, auto spíš ne). S citem.
- Jednoduchý japonský linkový vzor na ploše (vlny jako v logu, sashiko);
  **jen jeden na vizuál**.
- Černobílé fotky (ořezané věci bez pozadí) jako součást koláže, spíš na sítě.

---

## Pravidla pro kód v tomto repu (odvozená, ne součást manuálu)

Výklad manuálu pro webové stránky projektu. Kde manuál mlčí, je tu
rozhodnutí; odchylky vždy hlásit.

- Paleta je jen pět barev výše. Žádné odstíny, tinty, průhledné varianty
  barev ani jiné hexy (šedé, světle okrové, zelené pro „ok“, žluté pro varování).
- Text na okrovém těle je **černý**; na rudé a petrolejové bílý. Odkazy na okrové
  černé s podtržením (jako na akano.rolling.cz).
- Stav „vybráno“: plocha v petrolejové nebo rudé s bílým textem.
  Varování a chyby: rudá plocha, bílý text.
- `border-radius: 0` všude; žádné `box-shadow` jako stín, žádné gradienty,
  masky ani `transform` efekty na hover.
- Minimální písmo 12 px (`0.75rem`).
- h1, h2 a tlačítka Inknut Antiqua regular; h3+ a text Inria Serif.
- Linky černé nebo bílé.

### Rozdíly referenčního webu akano.rolling.cz od manuálu (stav 2026-11-27)

- Pozadí `#5b0f0f` místo `#72150C`.
- Písmo Gentium Book Plus místo Inria Serif / Inknut Antiqua.
