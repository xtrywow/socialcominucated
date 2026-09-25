# AceAds Lead Finder

Finds Brisbane businesses that **already have customers but a weak website**, the best
prospects for [aceads.au](https://aceads.au) web design. It gives the sales team a
ranked call list with a concrete reason to contact each business.

## How it works

1. **Discover** businesses for each category in `config.json`, from one of two sources:
   - **Google Places API** (`--source google`, needs `GOOGLE_API_KEY`): best coverage,
     includes ratings and review counts. Closed businesses are skipped.
   - **OpenStreetMap** (`--source osm`, **no key needed**, the default when no key is set):
     free, but thinner coverage of trades and no reviews. The `maps_url` column links to
     a Google Maps search so you can check reviews by hand before calling.
2. **Filter** (Google only): keeps businesses with at least `min_rating` stars and
   `min_reviews` reviews. No reviews means no proven demand and usually no budget.
3. **Audit**: fetches only the homepage and flags visible problems:
   no website, a Facebook/Linktree page instead of a site, a site that is down, no HTTPS,
   not mobile-friendly, an old copyright year, slow load, missing title or description,
   and (with `--pagespeed`) a poor Google mobile performance score.
4. **Score** (0–100). Google: **demand** (0–40, review volume × rating) + **website gap**
   (0–60). OSM: website gap scaled to 0–100. Tier A ≥ 60, B ≥ 40, C below 40.
   Sites that refuse automated visits (HTTP 401/403/429) are marked "could not check",
   never "broken", so sales never tells a prospect their working site is down.
5. **Export** a CSV sorted by score. The `pitch_angle` column is the opening line for the call.

## Setup

```bash
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements-dev.txt
cp .env.example .env   # optional: add GOOGLE_API_KEY
```

Without a key the tool uses OpenStreetMap. To use Google instead, in Google Cloud, enable **Places API (New)** and **PageSpeed Insights API** for the key,
and restrict the key to those two APIs.

## Usage

```bash
python -m leadfinder                                  # all categories in config.json
python -m leadfinder --source osm --categories cafe dentist   # no API key needed
python -m leadfinder --categories plumber electrician --limit 50
python -m leadfinder --pagespeed --min-tier B         # slower, more accurate, A+B only
pytest                                                # run tests
```

Output: `output/leads-YYYYMMDD.csv`. The `output/` folder is git-ignored.

## Compliance: read before outreach

- **This tool does not collect email addresses, and it should not be extended to do so.**
  Australia's *Spam Act 2003* prohibits using address-harvesting software, or lists it
  produces, to send unsolicited commercial email.
- Contact leads by **phone**, the business's **website contact form**, **LinkedIn**, or an
  individually written email to an address the business publishes for enquiries. Every
  email must identify AceAds and include an unsubscribe option.
- OpenStreetMap data is © OpenStreetMap contributors (ODbL). Keep Overpass use light:
  one run at a time.
- Google Places data is subject to Google's terms. Treat each CSV as a short-lived working
  list: re-run it rather than keeping a permanent copy (only `place_id` may be stored long-term).

This is not legal advice. Check your outreach process with an adviser.
