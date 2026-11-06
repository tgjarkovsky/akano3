# Převod Google dokumentu „Jádra + Týmy“ na soubor pro Příprava → Texty → Import.
#
# Postup (dělá ho Claude přes Google Drive konektor, nebo ručně):
#   1. Stáhnout dokument jako text (read_file_content) → jadra.txt
#      (z něj se berou názvy záložek: „# C001 Mušaši  “, „# Tým 1  “).
#   2. Stáhnout dokument jako Markdown (export text/markdown) → jadra.md
#   3. python3 -I scripts/prevod-jadra-tymy.py jadra.txt jadra.md import/jadra-tymy.json
#   4. V Přípravě → Texty → Import nahrát import/jadra-tymy.json
#
# Pravidla převodu (rozhodnuta 2026-11-06, viz CHANGELOG):
#   - postavy C001–C030 → S001–S030, sekce dokumentu → pole aplikace,
#   - z týmu jen medailonek (odstavec pod úslovím) → Tým · Veřejné,
#   - z hlavičky postavy jen pohlaví → rod,
#   - v legendách jsou čáry „---“/„—“ předěly; v ostatních sekcích je text mezi
#     dvěma čarami autorský komentář a vynechá se, osamocená čára uvozuje poznámky
#     na konci sekce, které se taky vynechají,
#   - nevyplněný vzor (text ze záložky Mustr postava) a řádky TODO se nepřenesou,
#   - Akari: horní blok její záložky patří Icukimu (C014).
#
# Výstup obsahuje tajné texty postav: import/ je v .gitignore, nesdílet.

"""Převod Google dokumentu „Jádra + Týmy“ (markdown export) na import pro Přípravu.

Vstup: jadra.txt (textový výpis se jmény záložek), jadra.md (markdown export).
Výstup: JSON s texty, rody a varováními.
"""
import json, re, sys, unicodedata
from datetime import datetime, timezone

txt_path, md_path, out_path = sys.argv[1:4]
txt = open(txt_path, encoding="utf-8").read().split("\n")
md = open(md_path, encoding="utf-8").read().split("\n")

def norm(s):
    s = s.replace("\\", "").replace("*", "").strip().lower()
    s = unicodedata.normalize("NFC", s)
    return re.sub(r"\s+", " ", s)

def anchor(line):
    level = len(re.match(r"^(#*)", line).group(1))
    s = re.sub(r"^#+\s*", "", line)
    return (level, re.sub(r"[^\w]+", "", norm(s)))

# 1) Záložky z textového výpisu: řádek „# Název  “ (dvě mezery na konci) a pod ním první H1 obsahu.
tabs = []
for i, line in enumerate(txt):
    if re.match(r"^# .+  $", line):
        title = line[2:].strip()
        first = next((l for l in txt[i + 1:] if anchor(l)[1]), None)
        tabs.append({"title": title, "anchor": anchor(first) if first else None})

# 2) Pozice záložek v markdownu: postupně hledej první řádek obsahu záložky.
md_anchor = [anchor(l) for l in md]
pos = 0
for t in tabs:
    while pos < len(md) and md_anchor[pos] != t["anchor"]:
        pos += 1
    if pos >= len(md):
        raise SystemExit(f"Záložka nenalezena v markdownu: {t['title']}")
    t["start"] = pos
    pos += 1
for a, b in zip(tabs, tabs[1:] + [{"start": len(md)}]):
    a["lines"] = md[a["start"]:b["start"]]

warnings = []
comments = []

MARKER = re.compile(r"^\s*\*?\s*(—|\\-\\-\\-|\\---|-{3,})\s*\*?\s*$")
SEPARATOR = re.compile(r"^\s*\**\s*(\\?_){3,}\s*\**\s*$")

def strip_comments(lines, where):
    """Odstraní text mezi dvěma oddělovači (— / ---) v rámci jednoho bloku.
    Osamocený oddělovač bez páru se jen smaže, text kolem zůstane."""
    marks = [i for i, l in enumerate(lines) if MARKER.match(l)]
    drop = set(marks)
    for a, b in zip(marks[0::2], marks[1::2]):
        drop.update(range(a, b + 1))
        removed = " ".join(x.strip() for x in lines[a + 1:b] if x.strip())
        if removed:
            comments.append({"where": where, "chars": len(removed), "start": removed[:100]})
    if len(marks) % 2 == 1:
        # Osamocená čára v sekci (ne v legendě) odděluje autorské poznámky na konci.
        last = marks[-1]
        removed = " ".join(x.strip() for x in lines[last + 1:] if x.strip())
        if removed:
            comments.append({"where": where, "chars": len(removed), "start": removed[:100], "trailing": True})
        drop.update(range(last, len(lines)))
    return [l for i, l in enumerate(lines) if i not in drop]

UNESCAPE = re.compile(r"\\([-+.!#()\[\]>~=_`|{}])")

def clean(lines):
    """Úklid textu: oddělovače (podtržítka, čáry) → předěl „---“, zrušit escapování,
    sloučit prázdné řádky, bez předělů na začátku a konci."""
    out = []
    for l in lines:
        if SEPARATOR.match(l) or MARKER.match(l):
            if out and out[-1] != "---":
                out += ["", "---", ""]
            continue
        out.append(UNESCAPE.sub(r"\1", l.rstrip()))
    out = [l for l in out if not re.fullmatch(r"\s*\**\s*todo\s*\**\s*", l, re.I)]
    text = "\n".join(out)
    text = re.sub(r"\n{3,}", "\n\n", text).strip()
    text = re.sub(r"(\n\n---)+$", "", text)
    text = re.sub(r"^(---\n\n)+", "", text)
    text = re.sub(r"(---\n\n){2,}", "---\n\n", text)
    text = text.strip()
    return "" if text == "---" else text

SECTIONS = [
    ("legends",       ["legenda", "legendy"]),
    ("inner_world",   ["vnitřní svět"]),
    ("summary",       ["shrnutí"]),
    ("relationships", ["vztahy"]),
    ("questions",     ["otázky"]),
    ("stands_out",    ["čím vystupuji z řady", "čím vystupuju z řady"]),
    ("why_hunter",    ["proč chci být lovcem", "proč se potřebuji stát lovcem"]),
    ("other_wants",   ["co chci, krom toho stát se lovcem", "co chci krom toho stát se lovcem"]),
]
def section_of(heading):
    h = norm(heading).rstrip(":?").strip()
    for key, names in SECTIONS:
        if h in names:
            return key
    return None

HEAD = re.compile(r"^(#{1,6})\s+(.*)$")
BOLD_LINE = re.compile(r"^\s*\*\*([^*]+?)\*\*\s*$")

def heading_text(line):
    """Text nadpisu: markdown nadpis, nebo celý řádek tučně (autoři to tak občas píšou)."""
    m = HEAD.match(line)
    if m: return m.group(2)
    m = BOLD_LINE.match(line)
    if m: return m.group(1)
    return None

def split_sections(lines):
    """Vrátí (hlavička, {pole: řádky}, [neznámé nadpisy úrovně 2 mimo sekce])."""
    header, sections, current = [], {}, None
    for l in lines:
        m = HEAD.match(l)
        ht = heading_text(l)
        key = section_of(ht) if ht else None
        if key:
            current = key
            sections.setdefault(key, [])
            continue
        if current is None:
            header.append(l)
        else:
            # Nadpisy uvnitř sekce (jména ve vztazích apod.) sniž na ### kvůli vykreslení.
            if m and len(m.group(1)) < 3:
                l = "### " + m.group(2)
            sections[current].append(l)
    return header, sections

def gender_of(header_lines):
    for l in header_lines:
        m = re.match(r"^\s*\**pohlaví\**\s*:\s*(.+)$", l.replace("\\", ""), re.I)
        if m:
            v = m.group(1).strip().lower()
            if v.startswith(("muž", "kluk", "klux")): return "m"
            if v.startswith(("žena", "holka")): return "f"
            return None
    return None

# Postavy, které nahoře mají jen autorský koncept místo legendy (rozhodnuto 2026-11-06).
NO_HEADER_LEGEND = {"S015", "S022", "S023", "S024"}

# Šablona postavy: obsah sekcí, který je jen nevyplněný vzor.
template = next(t for t in tabs if t["title"].startswith("Mustr postava"))
_, tpl_sections = split_sections(template["lines"][1:])
TEMPLATE_TEXT = {k: norm(clean(v)) for k, v in tpl_sections.items()}

texts, genders, characters, teams = [], [], [], []

def akari_fix(tabs):
    """Záložka C015 Akari: horní blok patří Icukimu (C014), druhý blok „# Akari“ je Akari.
    Druhému bloku chybí nadpisy sekcí, doplní se podle oddělovačů (rozhodnuto 2026-11-06)."""
    t = next(t for t in tabs if t["title"].startswith("C015"))
    lines = t["lines"]
    second = [i for i, l in enumerate(lines) if l.strip() == "# Akari"][1]
    top, bottom = lines[:second], lines[second:]

    # Horní blok → Icuki: body před prázdným nadpisem jsou vztahy, pak tři odpovědi.
    empty_h = next(i for i, l in enumerate(top) if l.strip() == "##")
    meta_end = max(i for i, l in enumerate(top[:empty_h]) if re.match(r"^\s*či[šs]iki", l, re.I))
    icuki_extra = ["## Vztahy", "", "### Akari", ""] + top[meta_end + 1:empty_h] + top[empty_h + 1:]

    # Druhý blok → Akari: ___ legenda ___ vnitřní svět TODO vztahy **Shrnutí** …
    seps = [i for i, l in enumerate(bottom) if SEPARATOR.match(l)]
    todo = next(i for i, l in enumerate(bottom) if l.strip().upper() == "TODO")
    summ = next(i for i, l in enumerate(bottom) if norm(l) == "shrnutí")
    rel = [("### " + l.strip()) if l.strip() == "Tecuja" else ("### Itsuki" if l.strip() == "# Itsuki" else l)
           for l in bottom[todo + 1:summ]]
    akari = (["# Akari"] + bottom[1:seps[0]]
             + ["## Legenda"] + bottom[seps[0] + 1:seps[1]]
             + ["## Vnitřní svět"] + bottom[seps[1] + 1:todo]
             + ["## Vztahy"] + rel + bottom[summ:])
    t["lines"] = akari
    return icuki_extra

ICUKI_EXTRA = akari_fix(tabs)

for t in tabs:
    title = t["title"]
    m_char = re.match(r"^C(\d{3})\s+(.+?)\**$", title)
    m_team = re.match(r"^Tým (\d+)", title)
    if m_char:
        num = int(m_char.group(1))
        cid = f"S{num:03d}"
        header, sections = split_sections(t["lines"][1:])
        if cid == "S014":
            _, extra = split_sections(ICUKI_EXTRA)
            for k, v in extra.items():
                sections.setdefault(k, v)
        # V hlavičce a legendách jsou čáry předěly mezi částmi legendy, ne komentáře.
        sections = {k: v if k == "legends" else strip_comments(v, f"{title} / {k}") for k, v in sections.items()}
        META = re.compile(r"^\s*\**(pohlaví|status|tým|specializace|původ|jednotka|kruh|čišiki|čisiki|pozice na žebříčku[^:]*)\**\s*:", re.I)
        SECRET = re.compile(r"^\s*\*\*\s*či[šs]iki", re.I)
        rest = [l for l in header if not META.match(l.replace("\\", "")) and not SECRET.match(l)]
        if cid in NO_HEADER_LEGEND:
            rest = []
        if "legends" not in sections and len(clean(rest)) > 200:
            sections["legends"] = rest
            warnings.append({"where": title, "issue": "legend_without_heading"})
        name = re.sub(r"^C\d{3}\s+", "", title).replace("*", "").strip()
        g = gender_of(header)
        if g: genders.append({"characterId": cid, "gender": g})
        else: warnings.append({"where": title, "issue": "no_gender"})
        filled = []
        for key, _ in SECTIONS:
            if key not in sections: continue
            text = clean(sections[key])
            if not text: continue
            if norm(text) == TEMPLATE_TEXT.get(key):
                warnings.append({"where": title, "issue": "template_text", "detail": key}); continue
            texts.append({"entityType": "character", "entityId": cid, "field": key, "body": text})
            filled.append(key)
        characters.append({"id": cid, "tab": title, "name": name, "fields": filled,
                           "missing": [k for k, _ in SECTIONS if k not in filled]})
    elif m_team:
        num = int(m_team.group(1))
        tid = f"T{num:02d}"
        body = strip_comments(t["lines"][1:], title)
        # Medailonek: odstavec pod úslovím nahoře v záložce. Starší koncepty níž
        # mají vlastní „**Medailonek:**“; ten se bere, jen když nahoře žádný není.
        cjk = re.compile(r"[\u3040-\u30ff\u4e00-\u9fff]")
        label = re.compile(r"^\s*\*\*[^*]{1,30}:")

        def first_paragraphs(lines, only_first=False):
            paras, cur = [], []
            for l in lines:
                st = l.strip()
                if HEAD.match(l) and cjk.search(l):
                    continue
                if HEAD.match(l) or norm(st).startswith("témata") or norm(st) == "medailonek:":
                    break
                if not st:
                    if cur:
                        paras.append(cur); cur = []
                        if only_first: break
                    continue
                cur.append(l)
            if cur: paras.append(cur)
            return [p for p in paras if not cjk.search(" ".join(p)) and not label.match(p[0])]

        paras = first_paragraphs(body)
        if not paras:
            labelled = [i for i, l in enumerate(body) if norm(l) == "medailonek:"]
            if labelled:
                paras = first_paragraphs(body[labelled[0] + 1:], only_first=True)
                warnings.append({"where": title, "issue": "medallion_from_label"})
        medal = clean([l for p in paras for l in p + [""]])
        if medal:
            texts.append({"entityType": "team", "entityId": tid, "field": "public", "body": medal})
        else:
            warnings.append({"where": title, "issue": "no_medallion"})
        teams.append({"id": tid, "tab": title, "medallion": medal})

out = {
    "source": "Google Docs: Jádra + Týmy",
    "generatedAt": datetime.now(timezone.utc).isoformat(),
    "texts": texts,
    "genders": genders,
}
json.dump(out, open(out_path, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
json.dump({"characters": characters, "teams": teams, "warnings": warnings, "comments": comments},
          open(out_path.replace(".json", ".report.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
print(f"tabs={len(tabs)} chars={len(characters)} teams={len(teams)} texts={len(texts)} genders={len(genders)} warnings={len(warnings)}")
