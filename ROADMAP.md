# Roadmapa Akano 3

Stav k 2026-10-18. Horizont 1–3 měsíce. Nejbližší běh hry je zhruba za 8 měsíců, takže teď je čas na nové moduly a vzhled; stabilita přijde na řadu před během.

## Vize

Akano 3 je doprovodná webová aplikace k LARPu Akano. Během hry drží sdílený stav (body, kaichi, lekce, alarmy, QR, knihovnu) na telefonech hráčů, na notebooku organizátora a na projekční obrazovce. Nově má pokrýt i dobu před hrou: sběr preferencí hráčů, ze kterých organizátor sestaví casting.

## Uživatelé

- **Hráči (do 15 lidí)** - na vlastním telefonu, přihlášení kódem postavy. Před hrou ještě postavu nemají a vyplňují dotazník přes veřejný odkaz.
- **Organizátor (GM)** - na notebooku, spravuje běhy, body, alarmy, QR a knihovnu. Před hrou čte odpovědi z dotazníku a přiřazuje hráče k postavám.
- **Display** - projekční obrazovka s výsledky a alarmy, nikdo ji neovládá.
- **Speciální role** - učitel, Růže (hackerka), knihovní přístup přes kód KNIHOVNA.

## Směry

### 1. Dotazník preferencí před castingem

Hráč bez postavy vyplní veřejný formulář (jméno + odpovědi). GM podle odpovědí přidělí postavy. Otázky jsou natvrdo v kódu, žádný editor otázek.

Další kroky:
1. Tabulka `questionnaire_responses` (vázaná na `run_id`) v `/api/admin/migrate`, `POST /api/questionnaire` s validací vstupu ve stylu `lib/*-validation.ts` a unit testem.
2. Veřejná stránka `/dotaznik` bez přihlášení. Sekce otázek: preferovaná role a tým/kruh, styl hraní (boj, intriky, lore, sociální hraní, intenzita), hranice a témata, která hráč hrát nechce, s kým chce a nechce hrát. Funguje na mobilu.
3. Přehled odpovědí v GM dashboardu jako nový panel, tabulka po hráčích. Čtení jen přes `adminGuard`, odpovědi obsahují citlivé údaje (hranice, vazby) a nesmí jít ven přes `/api/game-state`.
4. Export odpovědí do CSV z GM panelu.
5. Přiřazení hráče k postavě přímo z odpovědi. Postavy jsou dnes statické v `lib/data.ts` bez vazby na skutečného hráče, takže je potřeba mapování hráč → postava pro daný běh (nová tabulka) a zobrazení jména hráče v GM přehledech.

### 2. Vzhled hráčského mobilu

Student dashboard je hlavní obrazovka hry a hráči ho drží v ruce celou dobu.

Další kroky:
1. Projít `student-dashboard.tsx` a záložky v `components/views/student/` na šířce 360–390 px: velikost písma, kontrast podle palety z `docs/superpowers/specs/2026-07-29-role-themes-design.md`, dotykové cíle aspoň 44 px.
2. Čitelnější `student-header.tsx`: body týmu, kaichi level, zbývající pool na dary a otevřené okno lekce bez scrollování. Záložka „Moje body“ (`history-tab.tsx`) už existuje, jde jen o vzhled.
3. Dar bodů a nárok na lekci jako jasné akce s potvrzením a viditelnou zpětnou vazbou (toast, změna čísla).
4. Stejný průchod pro učitele a Růži, ať drží svoje témata.

### 3. Display obrazovka

Projekce v místnosti, čtená z několika metrů.

Další kroky:
1. Výsledkovka v `display-screen.tsx` čitelná z dálky: velká čísla, barvy týmů, žádný drobný text.
2. Viditelná animace změny skóre, aby si místnost všimla, kdo právě získal body.
3. Celoobrazovkový stav alarmu podle typu (evakuace, boj, shromáždění) navázaný na stávající sirénu.

### 4. Knihovna na mobilu

Mapa je podle `docs/superpowers/specs/2026-08-18-knihovna-mapa-design.md` desktopový zážitek a mobil jede přes Rejstřík. Hráči ale knihovnu čtou hlavně na telefonu.

Další kroky:
1. Čtení článku v Rejstříku na telefonu: typografie, šířka řádku, navigace mezi propojenými články.
2. Rozhodnout, jestli mapa na mobilu dostane zjednodušenou verzi (např. jen okolí otevřeného článku), nebo zůstane skrytá.
3. Vizuální odlišení obsahu odemčeného vyšším kaichi.

### 5. Příprava na běh (menší priorita)

Před během za ~8 měsíců, ne teď.

Další kroky:
1. Zkouška celé hry na 15 zařízeních najednou: polling 2 s, odezva Neonu, výpadek sítě a obnova spojení.
2. Kontrolní seznam pro GM před startem běhu (migrate, seed knihovny, nový běh, přiřazení hráčů).
3. Doplňovat validace a unit testy API rout tam, kde ještě chybí.

## Co ne

- **Nativní aplikace** - zůstává web na telefonu, žádné iOS ani Android buildy.
- **Účty a hesla** - žádná registrace. Ve hře přihlášení kódem postavy, dotazník přes veřejný formulář se jménem.
- **Obecný LARP engine** - nic se nezobecňuje pro jiné hry, aplikace slouží jen Akanu.
- **Editor otázek dotazníku** - otázky jsou v kódu, změna znamená deploy.
