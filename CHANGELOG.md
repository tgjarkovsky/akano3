## [2026-11-21] - Obsazení nezávisí na aktivním běhu: nahoře se vybírá, který běh se upravuje (Postavy i Hráči, výběr si pamatuje prohlížeč), aktivní běh je jen štítek „hraje se ve Velínu“; po použitém losu jde z Výsledku rovnou obsadit každý losovaný běh; API obsazení (/api/config, cast, role, pevné hodnoty) berou běh z požadavku, nové /api/priprava/run-state vrací rozvržení libovolného běhu

## [2026-11-21] - Obsazení: los a obsazování jsou oddělené a los je společný pro oba běhy; nová záložka Los (u losu se zvolí, který běh odpovídá 1. a 2. termínu z přihlášky) prochází los po fázích tlačítkem Další (Osudí, Nakamura, Dospělé role, Pořadí studentů, Trojice, Jednotlivci, Výsledek), u každé pravidlo a co z něj vyšlo v obou bězích; kdo chce konkrétní termín, potřebuje místo v něm, „je mi to jedno“ jde tam, kde zbývá víc místa, takže žádný běh nezbědne; Nakamura a limit 5 týmů platí na běh; los určí jen kdo jede, kam a v jaké skupině a společné pořadí náhradníků, na rod ani odmítnuté postavy nehledí; „Použít los“ zapíše jen stavy přihlášek, použitý los jde vrátit; náhradník s „je mi to jedno“ je náhradníkem pro oba běhy (v Přihláškách „Oba běhy“); v Hráčích „Navrhnout obsazení“ po losu obsadí Nakamuru vylosovanému, trojicím celé týmy podle jejich výběru a ostatním postavy podle preferencí, s vysvětlením, co nevyšlo

## [2026-11-21] - Losování obsazení běhu: v Obsazení → Hráči tlačítko „Losovat“ (osudí = nové přihlášky na daný běh nebo „je mi to jedno“ a náhradníci jiných běhů s „je mi to jedno“); nejdřív Nakamura mezi zrakově postiženými, pak dospělé role, pak trojice (celé vylosované, potom vylosované dvojice doplněné o třetího, nejvýš 5 týmů, tým podle výběru postav v přihlášce), kdo jede jen s trojicí a sám vyšel, přenechá místo dalšímu, zbylé studentské postavy podle preferencí; zbytek pořadí jsou náhradníci s číslem v pořadí, kdo náhradníkem být nechce, nejede; náhled losu s protokolem jde losovat znovu, „Použít los“ zapíše přijetí, postavy i pořadí najednou (jen na prázdný běh a jen když se osudí od losu nezměnilo); pořadí náhradníků je vidět v Přihláškách i v Hráčích

## [2026-11-21] - Přihlášky: trojice (kdo se hlásil spolu jako tým) se propojují v Přípravě; „Spárovat trojice“ navrhne skupiny podle jmen v poli „S kým se hlásíš“ (bez diakritiky, stačí, když jeden zmíní druhého), návrh jde vyškrtat a potvrdit, v detailu přihlášky ruční přidání do trojice a odpojení; hráč s týmem, který jede i bez trojice, může dostat i jinou studentskou postavu

## [2026-11-21] - Obsazení: rozdělené na záložky Postavy (jednotky, specializace, původ, kruhy, role) a Hráči (kdo hraje kterou postavu včetně dospělých, zveřejnění obsazení), kontroly vpravo patří k otevřené záložce; v Hráčích tlačítko „Navrhnout obsazení“ doplní volné postavy volnými přijatými hráči podle přihlášek (nejvyšší celková shoda, výběr v trojici a ★ mají přednost, odmítnuté postavy, jiný rod a postavy mimo hráčovu cestu nikdy), návrh jde po jednom vyškrtnout a schválit najednou

## [2026-11-21] - Přihlášky: výběr stavu a běhu se v tabulce už nemačká na šipku, šířka podle textu

## [2026-11-21] - Běhy: zakládání nového běhu padalo na duplicitě, protože stav postav, jednotky týmů, kruhy, body týmů a nastavení hry měly klíč bez běhu; klíče teď obsahují běh (migrace se provede sama), běhy bez nastavení hry ho dostanou

## [2026-11-20] - Mail o nepřijetí na hru: v Přihláškách tlačítko „Poslat mail o nepřijetí“ pro náhradníky a stav Nejede, kteří ho ještě nedostali; mail neoslovuje jménem a podle přihlášky řekne, jestli a do kdy hráče držíme na náhradnickém seznamu; text se upravuje v E-mailech, u přihlášky je vidět datum odeslání

## [2026-11-20] - Obsazení hráčů, dokončení: po zveřejnění obsazení vidí hráč na odkazu přihlášky blok „Tvůj běh“ (postava, stav platby) a nahraje fotku (zmenší se v prohlížeči na JPEG); fotky hráčů se ukazují v dogtagu postav ve spisech spoluhráčů; nové maily „Oznámení o přijetí“ a „Upomínka“ (upravitelné v E-mailech) se rozesílají vybraným hráčům z Hráčů, odeslané maily se evidují

## [2026-11-20] - Příprava → Hráči: soupiska běhu (přijatí a náhradníci), postava, fotka, platba (zaplaceno, datum, poznámka), filtry nezaplaceno / bez fotky / bez postavy, CSV; API pro nahrání fotky hráčem přes odkaz přihlášky (fotka v databázi, jen po zveřejnění obsazení)

## [2026-11-20] - Obsazení hráčů: přihláška má v Přihláškách stav (Nová / Přijat / Náhradník / Nejede) a běh, filtr podle stavu; v Obsazení se u každé postavy vybírá přijatý hráč aktivního běhu (★ chce, ✗ odmítl, ⚠ rod nebo odmítnutá jednotka, kruh, specializace či původ, „hraje X“), nová sekce Dospělí, kontroly hlásí odmítnuté postavy a postavy bez hráče, lišta běhu ukazuje počet obsazených a zveřejnění obsazení; nový běh hráče nepřebírá

## [2026-11-20] - Přihláška, potvrzení po odeslání: text o odkazu odpovídá tomu, že chodí i e-mailem; bez mezery za jménem před tečkou

## [2026-11-20] - Příprava: menu rozdělené na Larp (Texty, Pravidla, Knihovna, E-maily) a Běhy (Přihlášky, Obsazení, Spisy hráčů) s názvem aktivního běhu; „Běhy a obsazení“ přejmenováno na Obsazení

## [2026-11-20] - Příprava → E-maily: úprava předmětu a textu mailů aplikace s proměnnými ({{jmeno}} apod.), náhled HTML i prostého textu s ukázkovými daty, vrácení výchozího textu; potvrzení přihlášky chodí jako HTML + text z uložené šablony

## [2026-11-19] - Přihláška: po odeslání jde na e-mail potvrzení s odkazem na úpravy (Resend, bez RESEND_API_KEY jen log)

## [2026-11-19] - Přihláška, Jednotky a kruhy: pevné tři sloupce (jednotky 3 + 2 širší karty, kruhy 3 + 3, specializace v jednom řádku), na telefonu pod sebou; karty specializací přepracované (větší název, popis v řádcích s drobnou linkou); kruh jen pro druhý rod se ukazuje neaktivní (jen ke čtení) místo skrytí; horní lišta kroků ukazuje u projitého kroku s chybějícím povinným polem žlutý vykřičník místo zeleného zatržítka (tooltip řekne, co chybí)

## [2026-11-19] - Přihláška, Citlivá témata: bez úvodního odstavce o pojmech témata a citlivá témata

## [2026-11-19] - Přihláška, Studentské postavy: medailonek týmu celý, přes celou šířku, bez rozbalování a bez svislé linky, tři postavy týmu ve třech sloupcích přes celou šířku; pozadí přihlášky neutrálnější (méně krémové), šedobílé

## [2026-11-19] - Přihláška podle aktuálního Webu: povinné volby v kroku „Za co se hlásíš“ (hvězdička, jasnější text), kontakt akano3@rolling.cz, přihlášky do 31. 12. mají stejnou váhu, rozdělení postav do února, losování u Nakamury; název Akano3 bez mezery; postavy Ikai → Elliona a Himavari → Himawari

## [2026-11-13] - Přihláška: volba postav „ženské / mužské“ místo dívčích a chlapeckých; krok „Za co se hlásíš“ má jasnější možnosti (Studentská postava, sólo / Studentská postava, jako tým / Dospělá postava), bez štítku o pěti celých týmech

## [2026-11-12] - Přihláška na hru (/prihlaska) místo Google formuláře: kroky podle toho, za co se hráč hlásí (dospělá postava, tým, studentská postava) a jaké postavy chce hrát (dívčí, chlapecké, kterékoli; ostatní se neukazují, v týmech nejdou vybrat), medailonky přímo u voleb a ve čtečce, týmy po řádcích s celým medailonkem, u každé možnosti Chci moc / Klidně / Nechci, pevné prvky z Pravidel na kartách, upozornění na střet, otázka „když vylosují jen tebe“, běhy 2027, koncept v prohlížeči, po odeslání tajný odkaz na úpravy do 31. 12.; Příprava → Přihlášky s detailem a exportem CSV; Texty mají kategorii Dospělí a pole Citlivá témata; převod dokumentu Web bere i dospělé, citlivá témata a rod postav
## [2026-11-08] - Obsazení: role jednotek v běhu; tým v trojici s rolemi si je rozdělí výběrem u každého člena na nástěnce jednotek (obsazená role se vymění se spoluhráčem, pevné role z Pravidel jsou zamčené), tabulka postav roli ukazuje, kontroly varují před nerozdělenými rolemi, nový běh rozdělení přebírá; spis ukáže osobní text role a dosadí šablony {@klic} podle rozdělení v běhu
## [2026-11-08] - Spis: šablony rolí {@klic} dosadí jméno postavy, která roli v běhu drží (zatím pevné role z Pravidel), jinak název role; rodová značka {@klic: byl|byla} bere rod držitele role; klíč platí v jednotce textu (u textů týmu a postavy v jednotce čtenáře); návrh importu varuje před neznámým klíčem
## [2026-11-07] - Import z Google dokumentů přes Clauda: MCP server scripts/akano-mcp.mjs (.mcp.json) s tokenem importu (IMPORT_TOKEN) čte katalog a texty a posílá návrhy importu; návrhy čekají v Texty → Import (počet u tlačítka Import), otevřou se ve stejném náhledu jako soubor a uloží se, až je Příprava potvrdí, nebo se zahodí; rodové značky {byl|byla} (rod čtenáře) a {Jméno: byl|byla} (rod jmenované postavy) se ve spisu dosadí podle rodu postavy; návod docs/import-z-claude.md
## [2026-11-07] - Spis, Vztahy: v osobní knihovně dlaždice po osobách jako na nástěnce, celý vztah v náhledu při najetí myší nebo klepnutí; v dokumentu a tisku karty; údaje z textu, které ukazuje dogtag (rod, tým, původ, jednotka, kruh, specializace), a nevyplněné hodnoty ze šablony se nevypisují, tým a jednotka jsou z aktuálního běhu; náhledy dlaždic se nově vejdou do okna
## [2026-11-07] - Oprava: spis bere trojici týmu stejně jako Obsazení (u běhů bez uložené trojice ji dopočítá), takže pevná role se ve spisu ukáže i tam
## [2026-11-07] - Spis: postava s pevnou rolí (Příprava → Pravidla) dostane v kapitole Jednotka osobní text role jako „Tvoje role: …“ se štítkem jen ty a roli v hlavičce spisu i nástěnky; jen když tým v běhu stojí v jednotce a trojici té role
## [2026-11-07] - Pravidla: pevnou roli jde vybrat jen v týmu s jednotkou napevno a jen z rolí té jednotky; jednotku týmu s pevnými rolemi nejde změnit ani uvolnit, dokud se role nezruší
## [2026-11-07] - Pravidla: záložky Role a Jednotka týmu jsou jedna „Jednotka a role“; u každého týmu je nahoře jeho jednotka a pod ní pevné role členů
## [2026-11-07] - Pravidla: pevná role v jednotce (záložka Role, výběr z rolí jednotek, které tým smí dostat); role smí mít napevno jen jedna postava a role spoluhráčů musí být ve stejné trojici; Obsazení podle pevné role zamyká jednotku i trojici týmu, hlásí porušení a u postavy ukazuje její pevnou roli; smazání role smaže i její pravidla
## [2026-11-07] - Texty → Import umí role jednotek: soubor nese jednotku, trojici, klíč, názvy a osobní text; chybějící role se založí, existující (stejná jednotka a klíč) se nechá a dostane jen text; náhled je ukáže jako „nová role“ nebo „přepíše“
## [2026-11-07] - Spis a osobní knihovna: u Příběhu a Vnitřního světa už nejsou popisky „jak to bylo“ / „jak to prožíváš“; kapitoly týmu, jednotky (po týmech) a kruhu začínají seznamem členů; karty a dlaždice na nástěnce vždy uvádějí, kdo ve skupině je; jména postav v textech mají dogtag (rod, tým, jednotka, kruh, specializace, původ) při najetí myší nebo klepnutí, i se skloňovanými tvary
## [2026-11-07] - Převodní skript scripts/prevod-web.py: z Google dokumentu „Web“ bere medailonky postav, jednotek a kruhů (úsloví jako motto) a popisy specializací a původů do souboru pro Texty → Import
## [2026-11-07] - Osobní knihovna: nahoře jen hráčovo (on a jeho tým, jednotka, kruh), pod tím ostatní skupiny bez vlastní stránky, medailonek a veřejný text v náhledu při najetí myší nebo klepnutí; tlačítko „Spis jako dokument“ ukáže v prohlížeči celý spis jako PDF
## [2026-11-07] - Osobní knihovna hráče na odkazu /spis: nástěnka s kartami Já, Tým, Jednotka, Kruh a přehled akademie (ostatní týmy, jednotky a kruhy jen s medailonkem a veřejným textem); stránky se otevírají v aplikaci, tlačítko tisku dál tiskne celý spis
## [2026-11-07] - Spisy: termín běhu (vždy vícedenní, od i do povinné u nového běhu, doplnitelný v Obsazení → Všechny běhy) v záhlaví spisu; přezdívky odstraněné z celé aplikace; štítky jen ty / skupinové / veřejné; legendy se ve spisu jmenují Příběh, případně Příběhy podle počtu (sazba knihy s iniciálou), Vnitřní svět jako šedý blok v kurzívě; titulek stránky „Akademie Akano · Osobní spis · jméno“ (záhlaví tisku, název PDF)
## [2026-11-07] - Medailonky týmů začínají úslovím v kanji (citát „> “); ve spisu se úsloví na začátku textu vysází jako motto
## [2026-11-07] - Texty: pole Medailonek (známé před přihláškou na larp) u postav, týmů, jednotek a kruhů; dosavadní veřejné texty týmů se jednorázově přesunou do medailonků; převodní skript bere i medailonky postav ze záložek týmů; statistiky stavů po kategoriích a polích; medailonky ve spisu se štítkem „před hrou“
## [2026-11-06] - Spisy hráčů: tajný odkaz na spis postavy pro každý běh (/spis/[odkaz]), tisk a uložení do PDF na A4 v černobílém vzhledu; Příprava → Spisy hráčů vytváří a kopíruje odkazy, zveřejňuje běh a tiskne jednu postavu nebo celý běh
## [2026-11-06] - Oprava importu textů: přepis rozepsaného textu už nezapisuje NULL do changed_after_approval; chyba importu vrací svůj text
## [2026-11-06] - Texty: import ze souboru (náhled, výběr postav a týmů, přepis do stavu rozepsané), pole Vztahy (dočasně text) a Otázky, převodní skript scripts/prevod-jadra-tymy.py pro Google dokument „Jádra + Týmy“; jména postav podle české transkripce a dokumentu (Mušaši, Šigen, Kaja, Raidži, Eri, Saja, Tecuja, Icuki, Ajumi, Jošika, Šiho, Jusuke, Rjo, Secuko, Čiharu)
## [2026-11-06] - Texty: víc legend v jednom poli (nadpis ## na legendu), tlačítko Další legenda a počet legend
## [2026-11-06] - Příprava → Texty: matice postupu všech textů (postavy, týmy, jednotky, role, kruhy, specializace a původy), editor se stromem, automatickým ukládáním a náhledem pro hráče, stavy Hotovo / Schváleno, ochrana proti přepsání cizí úpravy, role jednotek ve trojicích A/B, rod postavy
## [2026-11-06] - Příprava → Pravidla: povolené hodnoty specializace, původu a kruhu postavy a jednotky týmu (napevno / kterákoli až na X); obsazení zakázané volby zamyká, kontroly hlásí porušení, server je odmítne, tlačítko doplní pevné hodnoty
## [2026-11-06] - Přímý přechod Příprava ↔ Velín ve stejné záložce (bez nového přihlášení)
## [2026-11-06] - Příprava, Běhy a obsazení: nástěnka jednotek s trojicemi A/B (přetažení i výběr, obsazené místo se vymění), tabulka postav se specializací, původem (Místní, Příbuzní, Cizí) a jedním kruhem, panel kontrol; nový běh přebírá celé obsazení
## [2026-11-06] - Heslo Přípravy v databázi (scrypt otisk): nastavení při první návštěvě, změna v Přehledu, platí i pro /api/admin/*; ADMIN_TOKEN zůstává jen jako záložní heslo pro curl
## [2026-11-06] - Příprava (/priprava): samostatná stránka s heslem pro běhy, obsazení a knihovnu; Velín bez záložek Běhy a Wiki, zápisy běhů, obsazení a knihovny jen s heslem
## [2026-10-29] - GM a učitelský přehled: sdílené PointAssignmentSheet, DashboardTabsList a SectionCard, typ ScoreMode ze scoreboard.tsx
## [2026-10-20] - GM vidí v Nastavení, kdo si v otevřeném okně uplatnil body za hodinu
## [2026-10-19] - Nastavení: GM může hráčům doplnit pool bodů na dary (přidat / nastavit na)
## [2026-10-18] - ROADMAP.md: vize, uživatelé, směry (dotazník preferencí, vzhled), co ne
## [2026-10-15] - wiki admin: společný hook useAdminCrud pro CRUD seznam článků a vazeb
## [2026-10-15] - Storno skupinového záznamu vrací body přesně těm postavám, které je dostaly
## [2026-10-13] - game-context: jeden helper pro volání API (sendJson/callApi), markFetchFailure a teamDeltaOf v assignPoints
## [2026-10-15] - StudentDashboard rozdělen na komponenty záložek (components/views/student/), bez změny chování
## [2026-10-13] - claim lekce ověřuje okno a duplicitu, body zapisuje server
## [2026-10-13] - GM: tlačítko „Export výsledků“ (CSV pořadí studentů, týmů, jednotek a kruhů)
## [2026-10-12] - README: screenshot aplikace
## [2026-10-12] - Hráč: tab „Moje body“ s historií vlastních bodů a průběžným součtem
## [2026-10-12] - Inline odkazy [[slug|text]] mezi wiki články (zamčené = ███, neexistující = text)
## [2026-10-12] - Storno záznamu v logu bodů (GM): protizáznam typu correction
## [2026-10-12] - Žebříček jednotek a kruhů počítá z DB přiřazení (characters/teams), ne ze statických dat
## [2026-10-12] - Validace vstupu POST /api/qr (400 při neplatném těle)
## [2026-10-12] - Validace těla v /api/lesson a /api/config (400 místo 500)
## [2026-10-12] - Body pro jednotku/kruh podle nastavení běhu z DB
## [2026-10-11] - README: popis projektu, stack a spuštění (EN + CZ)
## [2026-10-10] - Validace wiki článku a kaichi level v API (400 místo 500/NaN)
## [2026-10-11] - Validace typu a zprávy alarmu v POST /api/alarm

## [2026-10-09] - Vypnuty Vercel preview deploymenty

- `vercel.json` — `git.deploymentEnabled`: deploy jen z `main`, ostatní větve nedeployují
## [2026-10-09] - Unit testy pro rozpočet bodů, extrakce lib/point-resolution.ts
## [2026-10-08] - Validace POST /api/gift: zákaz daru sobě a darů od ne-hráčů

## [2026-10-01] - unit testy pro adminGuard

## [2026-04-28] - Opravy kritických bugů (review)

- `/api/gift` — TOCTOU fix: pool deduction + team_points + log v jednom CTE (atomic); přidána validace `amount > 0`
- `/api/runs PATCH` — validace runId před transakcí; neexistující ID vrací 404 místo deaktivace systému
- `lib/game-context.tsx` `login` — `CHARACTERS.find` místo `characters.find`; eliminuje re-render všech consumers každé 2s

## [2026-04-28] - AKANO v TopBaru odkazuje na login

- Klik na "AKANO" volá `logout()` → přesměruje na `/` (login screen)

## [2026-04-28] - Real-time sync přes SSE

- `lib/event-bus.ts` — singleton EventEmitter, `emitGameEvent` / `onGameEvent`
- `app/api/events/route.ts` — SSE endpoint (text/event-stream), heartbeat 25s
- Všechny mutation routy (alarm, points, lesson, kaichi, gift, config, qr, runs) emitují event po DB write
- `lib/game-context.tsx` — nahrazen 3s polling za EventSource, alarm se aplikuje přímo z SSE payloadu (bez extra round-tripu), ostatní eventy triggerují `fetchGameState()`
- REVERTOVÁNO — SSE nefunguje na Vercel (serverless, izolované procesy bez sdílené paměti)

## [2026-04-28] - Polling 2s bez pauzy na background tab

- `lib/game-context.tsx` — polling 2s bez `visibilitychange` pauzy; background taby stále synchronizují
- Alarm dorazí na všechna zařízení do max 2s

## [2026-04-28] - Seed endpoint pro mock data běhu 1

- `POST /api/admin/seed` — resetuje point_log + team_points pro run 1, vloží 30 mock záznamů z INITIAL_POINT_LOG

## [2026-04-28] - Fix multi-tab login + connection toast spam

- sessionStorage místo localStorage — každý tab má vlastní přihlášení
- Toasty "ztráta spojení" jen po 3+ po sobě jdoucích selháních (ne při občasném hiccupu)

## [2026-04-28] - Routing refaktor na /character/[id], localStorage persistence

- Přihlášení přesměrovává na `/character/{id}` místo single-page render
- `GameProvider` přijímá `initialUserId` — obnovuje session z localStorage
- `login()` vrací `Character | null` (místo boolean) pro přímé přesměrování
- `ErrorBoundary` extrahován do `components/shared/error-boundary.tsx`
- `game-page.tsx`: dekorativní pozadí (gradient + svislé linky)
- Polling efekt používá `isLoggedIn` boolean místo `currentUser` reference (fix zbytečných re-runů)

## [2026-04-28] - Podpora více běhů (runs)

- Přidána tabulka `runs` s migrací přes `/api/admin/migrate`
- Všechny per-run tabulky (team_points, character_state, alarm_state, game_config, circle_members, team_units, point_log) rozšířeny o `run_id`
- `lib/runs.ts`: helper `getActiveRunId()` pro všechny API routes
- API routes (alarm, config, game-state, gift, kaichi, lesson, points) filtrují data dle aktivního běhu
- Nová API route `/api/runs` (GET/POST/PATCH) — výpis, vytvoření a přepnutí aktivního běhu
- `GameContext`: nové fieldy `activeRunId`, `runs`, `setActiveRun`, `createRun`
- `GMDashboard`: dropdown pro přepínání běhů v headeru + nový tab "Běhy"
- `RunSetupPanel`: správa běhů, přiřazení jednotek, členů kruhů a specializací

## [2026-04-27] - Fix type error v page.tsx

- Router: odstraněn currentScreen (neexistuje v GameCtx), screen se nyní derivuje z currentUser.role

## [2026-04-27] - Login UI a gift route fix

- Logo v pozadí login formuláře — velké, průhledné (opacity 0.2)
- Formulář poloprůhledný s backdrop blur
- fix: gift route přepsána z async transaction callbacku na array formu (Neon HTTP mode nepodporuje async callback)

## [2026-04-27] - Bugfixes a výkon

- Přidána `login()` funkce do GameContext (chyběla, způsobovala crash na login stránce)
- `claimLesson`: optimistický update přesunut až za úspěšný `assignPoints`
- ID generování: `Date.now()` → `crypto.randomUUID()` (points, gift, qr routes)
- `/api/game-state`: obaleno do try/catch, dříve unhandled rejection při DB chybě
- `catch {}` → `catch (err) { console.error(...) }` ve všech API routech
- Export CSV: fix pro Firefox (appendChild/removeChild)
- `lang="cs"` v layout.tsx
- `useMemo` na `GameProvider.value`, `activeQRs`, `teamRank`, `teammates`

## [2026-04-27] - URL routing

- Každá role má vlastní URL: `/play/<character-id>` (např. `/play/S007`)
- Login přesměruje na `/play/<id>`, refresh zachová session přes URL
- `GameProvider` přesunut do `app/layout.tsx` (sdílený přes všechny stránky)
- Odstraněny `currentScreen`, `navigate`, `login` z GameContext — routing řeší Next.js router
- Přidán `setCurrentUser` do GameContext pro inicializaci z URL parametru

## [2026-04-27] - Persist login přes refresh

- Login code uložen do `localStorage`, obnoven na mount
- Logout a neplatný code `localStorage` vymaže

## [2026-04-26] - Fix: polling interval stacking

- Zachycen interval ID do lokální proměnné v closure — cleanup nyní vždy vyčistí svůj vlastní interval
- Zabraňuje akumulaci paralelních polling smyček při re-renderech

## [2026-04-26] - Student: tab "Akce" → "Body", přidán log bodů týmu

- Tab přejmenován na "Body"
- Pod akčními dlaždicemi přibyl log posledních 30 záznamů bodů vlastního týmu (typ akce, poznámka, čas, barevná částka)

## [2026-04-26] - Refaktor: rozpad single-file prototypu

- `app/page.tsx` (2888 ř.) rozdělen do 25 souborů
- `lib/`: types.ts, data.ts, constants.ts, utils.ts, game-context.tsx
- `components/shared/`: badges, team-icon, toast, alarm-banner, top-bar
- `components/panels/`: scoreboard, point-assignment, transaction-log, charts, kaichi, miasma, alarm, qr, game-setup
- `components/views/`: login, gm-dashboard, teacher-dashboard, student-dashboard, display-screen
- CSS animace přesunuty do `globals.css`, Cinzel font načten přes CSS `@import`
- `app/page.tsx` redukován na Router + ErrorBoundary + AkanoApp (~80 řádků)

## [2026-04-26] - Tab Tým → Lidé, větší tab bar

- Tab "Tým" přejmenován na "Lidé" — zobrazuje všechny studenty seskupené po týmech + sekci Dospělí
- Tab bar: vyšší (72px), větší ikony (26px), roztažen přes celou šířku
- Odstraněn bar chart "přírůstky dle typu akce" z ChartsPanel

## [2026-04-26] - Žebříček: toggle tabulka/graf, odstraněn tab Graf

- Tab "Graf" odstraněn ze StudentDashboard
- Na záložce Žebříček přidán toggle (ikony) mezi tabulkovým a grafovým view
- Grafový view zobrazuje všechny týmy (bez filtru na jeden tým)
- Oprava: gift tile SheetTrigger způsoboval vnořené `<button>` — nahrazeno controlled open/close

## [2026-04-26] - StudentDashboard redesign — mobilní styl

- Header: větší jméno (1.9rem), body týmu dominantní (3.2rem), odebrán řádek jednotka/kruh
- Akce tab: 2 velké dlaždice (108px) místo formulářových karet; gift form přesunut do bottom sheet
- Scoreboard (student view): větší padding a body (1.7rem) pro čitelnější žebříček

## [2026-04-26] - Bug fixes a performance

- Opravena stale closure v `giftPoints` a `claimLesson` — `from`/`to`/`student` se čtou před `setCharacters`
- Lesson window se nyní automaticky zavře po vypršení timeru (`toggleLesson(false)`)
- `URL.createObjectURL` v exportu CSV nyní správně uvolněn přes `revokeObjectURL`
- `tick` interval odstraněn z `DisplayScreen` — hodiny extrahovány do `ClockDisplay` komponenty (zabrání zbytečnému re-renderu včetně `timeData` useMemo každou sekundu)
- `ALARM_COLORS` přesunuto na úroveň modulu (nebylo třeba vytvářet nový objekt při každém renderu)
- `sorted` v `GMDashboard` a `TeacherDashboard` obaleno do `useMemo`
