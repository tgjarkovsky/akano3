# Převod Google dokumentu „Web“ (texty webu larpu) na soubor pro Příprava → Texty → Import.
#
# Postup (dělá ho Claude přes Google Drive konektor, nebo ručně):
#   1. Stáhnout dokument jako text (read_file_content) → web.txt
#      https://docs.google.com/document/d/1s38N4MTsT4KTWcKcW99K2JlBra9basT8t9LD4A9cckM
#   2. python3 -I scripts/prevod-web.py web.txt import/web.json
#   3. V Přípravě → Texty → Import nahrát import/web.json
#
# Co se převádí (rozhodnuto 2026-11-07):
#   - medailonky postav (záložka „medailonky týmů“, text pod jménem bez odrážek s rodem,
#     původem, jednotkou…) → Postava · Medailonek,
#   - medailonky jednotek a kruhů (úsloví jako citát „> “ a text pod ním) → Medailonek,
#   - popis specializací (Úloha, Zaměření, Klíčová odpovědnost) → Specializace · Popis,
#   - popis původů (záložka „Původ“) → Původ · Popis.
#   - medailonky týmů (záložka „medailonky týmů“, úsloví jako citát „> “, text a Témata
#     jako odrážky, od „# **Tým N**“ po první jméno) → Tým · Medailonek (od 2026-11-07,
#     Web je zdroj pravdy medailonků).
# Medailonky dospělých se nepřevádějí. Všechno jsou veřejné texty webu.

import json, re, sys
from datetime import datetime, timezone

src_path, out_path = sys.argv[1:3]
lines = open(src_path, encoding="utf-8").read().split("\n")

warnings = []

def clean(s):
    s = re.sub(r"\\([!\-*>_.\[\]()#])", r"\1", s)
    s = re.sub(r"\s\*-\*\s", " – ", s)          # „Akano no emi kicune *-* Smějící…“
    return re.sub(r"(?<=\S) {2,}(?=\S)", " ", s).rstrip()

def plain(s):
    return re.sub(r"[*#\s]+", " ", clean(s)).strip()

ATTR = re.compile(r"^\s*(-|–|\\-)\s*(muž|žena|původ|jednotka|kruh|specializace)\b", re.I)

def paragraphs(block):
    """Odstavce z bloku řádků: bez prázdných řádků, odrážek s údaji a značek seznamů."""
    out, cur = [], []
    for raw in block:
        l = clean(raw)
        if not l.strip() or l.strip() == "<!-- end list -->" or ATTR.match(raw):
            if cur: out.append(" ".join(cur)); cur = []
            continue
        l = re.sub(r"^#+\s*", "", l).strip()
        cur.append(l)
    if cur: out.append(" ".join(cur))
    return [p for p in out if p]

def find(pred, start=0, end=None):
    end = len(lines) if end is None else end
    for i in range(start, end):
        if pred(lines[i]): return i
    return None

def tab(title):
    """Rozsah záložky „# title  “ až po další záložku (řádek „# …  “ se dvěma mezerami)."""
    a = find(lambda l: re.match(rf"^# {re.escape(title)}\s\s$", l) is not None)
    if a is None: raise SystemExit(f"Záložka nenalezena: {title}")
    b = find(lambda l: re.match(r"^# .+  $", l) is not None, a + 1) or len(lines)
    return a + 1, b

def sections(start, end, pattern):
    """Oddíly podle nadpisů odpovídajících pattern: [(název, řádky)]."""
    heads = [(i, plain(lines[i])) for i in range(start, end) if re.match(pattern, lines[i])]
    return [(name, lines[i + 1:(heads[k + 1][0] if k + 1 < len(heads) else end)]) for k, (i, name) in enumerate(heads)]

def with_motto(block):
    ps = paragraphs(block)
    if not ps: return ""
    return "\n\n".join([f"> {ps[0]}"] + ps[1:])

texts = []
def add(entity_type, entity_id, field, body):
    if not body.strip():
        warnings.append(f"prázdný text: {entity_type} {entity_id}"); return
    texts.append({"entityType": entity_type, "entityId": entity_id, "field": field, "body": body})

# ── Postavy ────────────────────────────────────────────────────────────
CHARACTERS = {
    "Mušaši": "S001", "Šigen": "S002", "Mimi": "S003", "Kaja": "S004", "Kaoru": "S005", "Hiko": "S006",
    "Ikai": "S007", "Raidži": "S008", "Airi": "S009", "Eri": "S010", "Saja": "S011", "Ren": "S012",
    "Tecuja": "S013", "Icuki": "S014", "Akari": "S015", "Ajumi": "S016", "Mizuki": "S017", "Jošika": "S018",
    "Šiho": "S019", "Jusuke": "S020", "Anna": "S021", "Kei": "S022", "Rjo": "S023", "Haruka": "S024",
    "Tomoe": "S025", "Nozomi": "S026", "Secuko": "S027", "Kenzo": "S028", "Makoto": "S029", "Čiharu": "S030",
}
a, b = tab("medailonky týmů")
# Jméno je nadpis „## **Jméno**“, nebo jen tučný řádek „**Jméno**“ (Šigen). Konec: další jméno nebo „# **Tým N**“.
name_re = re.compile(r"^(## )?\*\*(" + "|".join(map(re.escape, CHARACTERS)) + r")\*\*\s*$")
stops = [i for i in range(a, b) if name_re.match(lines[i]) or re.match(r"^# \*\*Tým \d+\*\*", lines[i])] + [b]
found = set()
for k, i in enumerate(stops[:-1]):
    m = name_re.match(lines[i])
    if not m: continue
    name = m.group(2)
    found.add(name)
    add("character", CHARACTERS[name], "medallion", "\n\n".join(paragraphs(lines[i + 1:stops[k + 1]])))
for name in CHARACTERS:
    if name not in found: warnings.append(f"chybí medailonek postavy {name}")

# ── Týmy ───────────────────────────────────────────────────────────────
a, b = tab("medailonky týmů")
team_heads = [(i, int(m.group(1))) for i in range(a, b) if (m := re.match(r"^# \*\*Tým (\d+)\*\*", lines[i]))]
for k, (i, n) in enumerate(team_heads):
    end = team_heads[k + 1][0] if k + 1 < len(team_heads) else b
    first_name = find(lambda l: name_re.match(l) is not None, i + 1, end) or end
    out, para, motto = [], [], None
    def flush():
        if para: out.append(" ".join(para)); para.clear()
    for raw in lines[i + 1:first_name]:
        l = clean(raw).strip()
        if not l: flush(); continue
        if plain(l).rstrip(":") == "Medailonek": continue  # popisek u Týmu 6, není součást textu
        if re.match(r"^-\s", l):
            flush(); out.append("- " + plain(l[1:])); continue
        if motto is None and not out and not para:
            motto = plain(l); continue
        para.append(l)
    flush()
    body, prev_bullet = [], False
    for x in out:
        bullet = x.startswith("- ")
        if body: body.append("\n" if bullet and prev_bullet else "\n\n")
        body.append(x); prev_bullet = bullet
    add("team", f"T{n:02d}", "medallion", (f"> {motto}\n\n" if motto else "") + "".join(body))

# ── Jednotky a kruhy ───────────────────────────────────────────────────
UNITS = {"Hagakure": "U2", "Murakami": "U1", "Hvězdy": "U3", "VIRA": "U4", "Ucuro": "U5"}
CIRCLES = {"J-pop": "C1", "Kaligrafický": "C2", "Vědecký": "C3", "Rituální": "C4", "Sportovní": "C5", "Literární": "C6"}
for title, ids, kind in [("medailonky jednotek", UNITS, "unit"), ("medailonky kruhů", CIRCLES, "circle")]:
    a, b = tab(title)
    got = {name: block for name, block in sections(a, b, r"^## ")}
    for name, eid in ids.items():
        if name not in got: warnings.append(f"chybí {kind} {name}"); continue
        add(kind, eid, "medallion", with_motto(got[name]))

# ── Specializace ───────────────────────────────────────────────────────
SPECS = {"Bojová": "combat", "Taktická": "tactical", "Podpůrná": "support"}
a, b = tab("Popis specializací")
for name, block in sections(a, b, r"^## "):
    m = re.match(r"^(\S+) – (\S+) specializace$", name)
    if not m or m.group(2) not in SPECS: warnings.append(f"neznámá specializace: {name}"); continue
    add("trait", f"specialization:{SPECS[m.group(2)]}", "public", "\n\n".join([f"> {name}"] + paragraphs(block)))

# ── Původy ─────────────────────────────────────────────────────────────
ORIGINS = {"Místní": "mistni", "Příbuzní": "pribuzni", "Cizí": "cizi"}
a, b = tab("Doplňující informace o světě")  # původ je pod ní jako „# Původ“ bez dvou mezer
p = find(lambda l: l.strip() == "# Původ", a, len(lines))
q = find(lambda l: re.match(r"^# .+  $", l) is not None, p + 1) or len(lines)
for name, block in sections(p + 1, q, r"^## "):
    if name not in ORIGINS: warnings.append(f"neznámý původ: {name}"); continue
    ps = paragraphs(block)  # u Cizích zůstává i poznámka o mocnostech pod oddílem
    add("trait", f"origin:{ORIGINS[name]}", "public", "\n\n".join(ps))

out = {
    "source": "Google dokument „Web“",
    "generatedAt": datetime.now(timezone.utc).isoformat(timespec="seconds"),
    "texts": texts,
    "genders": [],
}
json.dump(out, open(out_path, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
print(f"{len(texts)} textů → {out_path}")
for w in warnings: print("VAROVÁNÍ:", w)
