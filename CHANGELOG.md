## [2026-10-18] - ROADMAP.md: vize, uživatelé, směry (dotazník preferencí, vzhled), co ne
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
