"""Build website concept previews for prospects: python mockups/build.py

Reads mockups/businesses.json and writes mockups/out/<slug>/index.html.
Previews use only public facts (name, address, phone, social link). Menus,
photos and hours are clearly marked placeholders: never invent prices,
reviews or claims about a real business.
"""

from __future__ import annotations

import hashlib
import html
import json
import re
from pathlib import Path
from urllib.parse import quote_plus

import requests

ROOT = Path(__file__).parent
FONT_CACHE = ROOT / ".fontcache"
BROWSER_UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36"

THEMES = {
    # Bottle green and aged brass; the name sits on a riveted brass plate.
    "brass": {
        "fonts": "Big+Shoulders+Display:wght@700;900&family=Instrument+Sans:wght@400;600",
        "display": "'Big Shoulders Display', sans-serif",
        "body": "'Instrument Sans', sans-serif",
        "vars": "--bg:#15302a;--surface:#1d3d35;--ink:#f1e9d8;--muted:#b9c4b9;--accent:#c29a5b;--accent-ink:#1b1206;--line:#2f5549;",
        "hero_class": "hero--plate",
        "upper": True,
        "glyph": 0.52,
        "max_px": 132,
        "pad_px": 110,
    },
    # Pale morning sky; a butter-yellow sun rises behind the name.
    "morning": {
        "fonts": "Young+Serif&family=Figtree:wght@400;600",
        "display": "'Young Serif', serif",
        "body": "'Figtree', sans-serif",
        "vars": "--bg:#dcebf5;--surface:#ffffff;--ink:#1c2b3a;--muted:#4f6275;--accent:#f2c94c;--accent-ink:#1c2b3a;--line:#bcd3e3;",
        "hero_class": "hero--sun",
        "upper": False,
        "glyph": 0.56,
        "max_px": 120,
        "pad_px": 48,
    },
    # Loud and unbothered: huge condensed type and a tangerine sticker.
    "dropout": {
        "fonts": "Anton&family=Archivo:wght@400;600",
        "display": "'Anton', sans-serif",
        "body": "'Archivo', sans-serif",
        "vars": "--bg:#eeede8;--surface:#ffffff;--ink:#111111;--muted:#55544f;--accent:#ff4f1a;--accent-ink:#111111;--line:#d6d4cc;",
        "hero_class": "hero--sticker",
        "upper": True,
        "glyph": 0.47,
        "max_px": 210,
        "pad_px": 48,
    },
}

CSS = """
*{box-sizing:border-box;margin:0}
html{scroll-behavior:smooth}
body{background:var(--bg);color:var(--ink);font:400 17px/1.55 var(--body);-webkit-font-smoothing:antialiased}
a{color:inherit}
a:focus-visible,button:focus-visible{outline:3px solid var(--accent);outline-offset:3px}
.wrap{max-width:1040px;margin:0 auto;padding:0 20px}
.ribbon{background:var(--ink);color:var(--bg);font-size:13px;text-align:center;padding:8px 16px}
.ribbon b{font-weight:600}
h1,h2{font-family:var(--display);font-weight:inherit;line-height:1}
.eyebrow{font-size:13px;letter-spacing:.14em;text-transform:uppercase;color:var(--muted);font-weight:600}
.btns{display:flex;flex-wrap:wrap;gap:12px;margin-top:28px}
.btn{display:inline-flex;align-items:center;min-height:48px;padding:0 22px;border-radius:999px;font-weight:600;text-decoration:none;border:2px solid var(--ink)}
.btn--solid{background:var(--accent);color:var(--accent-ink);border-color:var(--accent)}

.hero{padding:72px 0 88px;position:relative;overflow:hidden}
.hero h1{margin:14px 0 18px;overflow-wrap:anywhere}
.hero .lead{font-size:20px;max-width:30ch;color:var(--muted)}

.hero--plate .plate{display:inline-block;position:relative;padding:22px 34px 18px;border-radius:6px;
  background:linear-gradient(135deg,#d9b67a,#a97c3f 55%,#c9a164);color:var(--accent-ink);
  box-shadow:inset 0 0 0 2px #8a6330,0 18px 40px rgba(0,0,0,.35)}
.hero--plate .plate::before,.hero--plate .plate::after{content:"";position:absolute;inset:8px;pointer-events:none;
  background:radial-gradient(circle,#6e4d22 3px,transparent 4px) 0 0/100% 100% no-repeat,
    radial-gradient(circle at 0 0,#6e4d22 3px,transparent 4px)}
.hero--plate .plate::before{background:
  radial-gradient(circle at 6px 6px,#6e4d22 3px,transparent 4px),
  radial-gradient(circle at calc(100% - 6px) 6px,#6e4d22 3px,transparent 4px),
  radial-gradient(circle at 6px calc(100% - 6px),#6e4d22 3px,transparent 4px),
  radial-gradient(circle at calc(100% - 6px) calc(100% - 6px),#6e4d22 3px,transparent 4px)}
.hero--plate .plate::after{display:none}
.hero--plate h1{margin:0;letter-spacing:.04em}
.hero--plate .eyebrow{margin-bottom:18px}
.hero--plate .lead{margin-top:28px}

.hero--sun::before{content:"";position:absolute;width:min(560px,120vw);aspect-ratio:1;border-radius:50%;
  background:var(--accent);left:50%;bottom:-62%;transform:translateX(-50%);animation:rise 1.4s ease-out both}
.hero--sun .wrap{position:relative;text-align:center}
.hero--sun .lead{margin:0 auto}
.hero--sun .btns{justify-content:center}
.hero--sun .btn--solid{background:var(--ink);color:#fff;border-color:var(--ink)}
@keyframes rise{from{transform:translate(-50%,18%)}to{transform:translate(-50%,0)}}

.hero--sticker h1{letter-spacing:-.01em;line-height:.9}
.hero--sticker .sticker{position:absolute;right:6%;top:56px;width:132px;aspect-ratio:1;border-radius:50%;
  background:var(--accent);display:grid;place-items:center;text-align:center;font:600 13px/1.2 var(--body);
  text-transform:uppercase;letter-spacing:.08em;transform:rotate(12deg);padding:18px}

section{padding:64px 0;border-top:1px solid var(--line)}
section h2{font-size:clamp(34px,6vw,54px);margin-bottom:10px}
.note{color:var(--muted);max-width:52ch}
.grid{display:grid;gap:16px;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));margin-top:28px}
.card{background:var(--surface);border:2px dashed var(--line);border-radius:14px;padding:22px;min-height:150px}
.card h3{font:600 18px/1.3 var(--body);margin-bottom:6px}
.card p{color:var(--muted);font-size:15px}
.photos{display:grid;gap:12px;grid-template-columns:repeat(3,1fr);margin-top:28px}
.photo--extra{display:none}
.photo{aspect-ratio:4/5;border-radius:12px;background:
  repeating-linear-gradient(45deg,var(--surface) 0 12px,var(--line) 12px 13px);display:grid;place-items:end start;padding:12px;
  font-size:13px;color:var(--muted)}
.visit{display:grid;gap:28px;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));margin-top:28px}
.visit dl{display:grid;gap:14px}
.visit dt{font-size:13px;text-transform:uppercase;letter-spacing:.12em;color:var(--muted);font-weight:600}
.visit dd{font-size:19px}
.mapcard{border-radius:14px;min-height:220px;background:var(--surface);border:1px solid var(--line);
  display:grid;place-items:center;text-align:center;padding:24px;
  background-image:linear-gradient(var(--line) 1px,transparent 1px),linear-gradient(90deg,var(--line) 1px,transparent 1px);
  background-size:28px 28px}
.pin{width:18px;height:18px;border-radius:50% 50% 50% 0;background:var(--accent);transform:rotate(-45deg);margin:0 auto 12px;
  box-shadow:0 0 0 6px color-mix(in srgb,var(--accent) 30%,transparent)}
footer{padding:36px 0 48px;border-top:1px solid var(--line);color:var(--muted);font-size:15px}
footer .wrap{display:flex;flex-wrap:wrap;gap:12px 28px;justify-content:space-between}
.pitch{background:#0f1720;color:#f4f6f8;padding:48px 0;font-size:16px}
.pitch h2{font:600 26px/1.25 system-ui,sans-serif;margin-bottom:10px}
.pitch ul{margin:16px 0 0 18px;display:grid;gap:6px;color:#c9d2da}
@media (max-width:640px){
  .hero{padding:48px 0 64px}
  .hero--sticker .sticker{position:static;transform:rotate(-6deg);width:112px;margin-bottom:18px}
  .photos{grid-template-columns:repeat(2,1fr)}
  .photo--extra{display:grid}
  .hero--plate .plate{padding:18px 22px 14px}
}
@media (prefers-reduced-motion:reduce){*{animation:none!important;scroll-behavior:auto!important}}
"""

PAGE = """<!doctype html>
<html lang="en-AU">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow">
<title>{name}: website concept by AceAds</title>
<style>{fontface}:root{{{vars}--display:{display};--body:{body}}}{css}</style>
</head>
<body>
<div class="ribbon"><b>Concept preview</b> made by AceAds for {name}. Not a live website.</div>
<header class="hero {hero_class}">
  <div class="wrap">
    {sticker}
    <p class="eyebrow">{kind} · {place}</p>
    {title}
    <p class="lead">{headline}</p>
    <div class="btns">
      <a class="btn btn--solid" href="tel:{tel}">Call {phone}</a>
      <a class="btn" href="{directions}">Get directions</a>
    </div>
  </div>
</header>
<main>
  <section id="menu"><div class="wrap">
    <p class="eyebrow">Menu</p>
    <h2>What's on today</h2>
    <p class="note">Your real menu goes here. You update items and prices yourself, from your phone.</p>
    <div class="grid">
      <div class="card"><h3>Coffee</h3><p>Your coffee list and prices.</p></div>
      <div class="card"><h3>Food</h3><p>Breakfast, lunch, specials.</p></div>
      <div class="card"><h3>Something sweet</h3><p>Cakes, pastries, the cabinet.</p></div>
    </div>
  </div></section>
  <section id="photos"><div class="wrap">
    <p class="eyebrow">Inside {name}</p>
    <h2>Photos</h2>
    <p class="note">Your best photos from {social_label} go here, so people see the place before they visit.</p>
    <div class="photos"><div class="photo">Your photo</div><div class="photo">Your photo</div><div class="photo">Your photo</div><div class="photo photo--extra">Your photo</div></div>
  </div></section>
  <section id="visit"><div class="wrap">
    <p class="eyebrow">Visit</p>
    <h2>Find us</h2>
    <div class="visit">
      <dl>
        <div><dt>Address</dt><dd>{address}</dd></div>
        <div><dt>Phone</dt><dd><a href="tel:{tel}">{phone}</a></dd></div>
        <div><dt>Opening hours</dt><dd>Your hours, kept in sync with Google</dd></div>
      </dl>
      <a class="mapcard" href="{directions}"><div><div class="pin"></div><strong>{place}</strong><br>Open in Google Maps</div></a>
    </div>
  </div></section>
</main>
<footer><div class="wrap"><span>{name} · {address}</span><a href="{social}">{social_label}</a></div></footer>
<aside class="pitch"><div class="wrap">
  <h2>Like it? This can be your real website in 7 days.</h2>
  <p>AceAds builds it with your menu, photos and hours, connects your domain and sets up Google.</p>
  <ul><li>Works on every phone</li><li>Customers can call or get directions in one tap</li><li>You own it, not Facebook</li></ul>
  <p style="margin-top:16px">Reply to our message to get started.</p>
</div></aside>
</body>
</html>
"""


def fetch_fonts(family_query: str, out_dir: Path) -> str:
    """Download Google Fonts files next to the page and return @font-face CSS pointing at them."""
    FONT_CACHE.mkdir(exist_ok=True)
    css = requests.get(
        f"https://fonts.googleapis.com/css2?family={family_query}&display=swap",
        headers={"User-Agent": BROWSER_UA},
        timeout=30,
    ).text
    # keep only the latin subset: the pages are English
    blocks = [b for b in re.split(r"(?=/\* )", css) if b.startswith("/* latin */")]
    css = "".join(b.split("*/", 1)[1] for b in blocks)
    (out_dir / "fonts").mkdir(parents=True, exist_ok=True)

    def localise(match: re.Match) -> str:
        url = match.group(1)
        name = hashlib.sha1(url.encode()).hexdigest()[:12] + ".woff2"
        cached = FONT_CACHE / name
        if not cached.exists():
            cached.write_bytes(requests.get(url, timeout=30).content)
        (out_dir / "fonts" / name).write_bytes(cached.read_bytes())
        return f"url(fonts/{name})"

    return re.sub(r"url\((https://fonts\.gstatic\.com/[^)]+)\)", localise, css)


def fitted_size(name: str, theme: dict) -> str:
    """Largest font size that keeps the longest word of the name on one line."""
    longest = max(len(word) for word in name.split())
    return f"min({theme['max_px']}px,calc((100vw - {theme['pad_px']}px) / {longest * theme['glyph']:.2f}))"


def render(b: dict, fontface: str) -> str:
    theme = THEMES[b["theme"]]
    e = {k: html.escape(v) for k, v in b.items()}
    name = e["name"].upper() if theme["upper"] else e["name"]
    title = f'<h1 style="font-size:{fitted_size(b["name"], theme)}">{name}</h1>'
    if b["theme"] == "brass":
        title = f'<div class="plate">{title}</div>'
    sticker = f'<div class="sticker">{html.escape(b["place"].split(",")[-1].strip())}</div>' if b["theme"] == "dropout" else ""
    return PAGE.format(
        **e,
        vars=theme["vars"],
        display=theme["display"],
        body=theme["body"],
        css=CSS,
        fontface=fontface,
        hero_class=theme["hero_class"],
        title=title,
        sticker=sticker,
        tel=b["phone"].replace(" ", ""),
        directions="https://www.google.com/maps/search/?api=1&amp;query=" + quote_plus(f'{b["name"]} {b["address"]}'),
    )


def main() -> None:
    for b in json.loads((ROOT / "businesses.json").read_text()):
        out = ROOT / "out" / b["slug"] / "index.html"
        out.parent.mkdir(parents=True, exist_ok=True)
        fontface = fetch_fonts(THEMES[b["theme"]]["fonts"], out.parent)
        out.write_text(render(b, fontface), encoding="utf-8")
        print(out)


if __name__ == "__main__":
    main()
