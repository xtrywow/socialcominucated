# Prompt for Claude Code: find businesses AceAds can email

Run Claude Code from `D:\aceads` and paste everything below the line. Change only the BATCH block.

---

You are researching prospects for **AceAds** (aceads.au), a Brisbane studio: real estate and hospitality photography, video, CASA-accredited drone, and small websites (the "Founding Site"). Public name: Daniel Mehr. This is **research only**.

## BATCH (edit this block each time)
- Date: YYYY-MM-DD
- Target: 80 businesses in total, split as: Segment A 30, Segment B 25, Segment C 25 (one segment per run is better than all three at once)
- Area this week: Brisbane inner north and east (Fortitude Valley, New Farm, Teneriffe, Newstead, Paddington, Rosalie, West End, Bulimba, Hawthorne). Next areas in later batches: Brisbane south and west, Gold Coast (Burleigh, Palm Beach, Broadbeach, Miami), Sunshine Coast (Noosa, Mooloolaba, Maroochydore, Buderim).

## Start from the candidate list
`leads\candidates-YYYY-MM-DD.csv` already lists businesses found by web search for this batch (segment, business, website, suburb, a note from the search). Work through it first: open each business's own site, check it against every rule below, and drop any that fail. Search for more only if you are short of the target after that. For the Queensland-wide run, use one file from `leads\email-batches\batch-NNN.csv` per run instead (80 businesses each, highest priority first) and name the output after it, e.g. `research-batch-001.csv`. Fill the `fit` column and leave rows you could not verify out of the output. The search notes are leads, not facts: confirm everything on the business's own site.

## Hard rules (break one and the row is useless)
1. **Do not contact anyone.** No email, no DM, no form submission, no sign-up, no login to any account, no calls.
2. **An email address is usable only if it is published on the business's own website** (contact page, footer, about page) or on its own group's website. Not from directories, Google, Facebook, Instagram, ABN lookups, data brokers, or guessing a pattern. Record the exact page URL where you saw it. If the site hides the address behind a form only, record "form only" and no email.
3. **Skip any address the site says not to use for marketing** ("no solicitations", "no unsolicited emails", "suppliers only", "careers only"). Record it in the summary instead.
4. **Work business by business.** Find a business first, then read its own site. Do not build or run a tool whose purpose is collecting email addresses in bulk (Australia's Spam Act prohibits address-harvesting software). Fetching a business's own contact page to read it is fine.
5. **Every detail you write must be something you saw**, with its URL. No invented projects, awards, dishes, or claims about their website. Instagram only if the profile opens without logging in; otherwise use their own site.
6. Read-only on the project. You may read the files below. You write only the two output files listed at the end. Do not edit any other file in `D:\aceads`.

## Who to EXCLUDE
- Already contacted or already known. Check and skip anything that appears in:
  - `outreach.md` (section 7 "Do-not-contact" and section 8 "Prospect state table")
  - `queue/approvals.md` (every business with a drafted email)
  - `agent/data/register.json` (names and Instagram handles)
  - `leads/` (every .xlsx and .csv already there, including `aceads-dm-list.csv`: businesses the Instagram/Facebook team already has. Match on website domain and on business name)
- Competitors: photographers, videographers, content creators, drone operators, marketing, social media or web design agencies.
- National chains and franchises (McDonald's, Guzman y Gomez, etc.). Small local groups of 2 to 6 venues are fine: list the group once (see Segment C).
- Closed, "permanently closed", or sites that no longer load.
- Anything outside Queensland. Segment A and C must be inside the shoot area: Brisbane, Gold Coast, Sunshine Coast.

## Segment A: complementary businesses (their finished work needs good photos and video)
Property stylists and home staging, interior designers and decorators, residential builders and renovators (kitchens, bathrooms, extensions), landscape designers, small architecture and building-design practices, pool builders, custom joinery and cabinet makers.
Prefer small owner-run firms whose own site shows a recent named project.
Record one **specific recent detail** from their own site or their own Instagram (a named project, the suburb of a recent job, an award with year). Prefer work from the last 12 months; write the date if the site shows one.

## Segment B: businesses whose website is weak (website offer)
Cafes, restaurants, bars, bakeries, hair and beauty salons, barbers, gyms and studios, local retail.
Qualify only if the site loads AND has at least one concrete, visible problem you can describe in one plain sentence, for example: free subdomain (wixsite, square.site, business.site), no mobile layout, broken contact form, copyright year 3+ years old, booking or ordering page only with no about/hours/address, missing opening hours, broken links, "Not secure" (no HTTPS).
Never record "outdated" or "ugly". Record the exact problem and the URL where you saw it.
Businesses with **no website at all** are NOT Segment B (they have no published email); list them separately in the summary with their phone number from Google Maps so Daniel can call.

## Segment C: precinct venues (content offer: a shoot day plus a month of posts)
Restaurants, bars, cafes, bakeries, delis, boutique hotels, jewellers and boutique retail in the BATCH area, ideally several on the same street.
Prefer an address for events, marketing, media or general enquiries over a bookings/reservations address; take a bookings address only if it is the only one on the site and say so.
If several venues belong to one group, write **one row for the group** (group name, the venues, one best address).
Record one specific detail (signature dish, a feature like a courtyard, rooftop, open kitchen, an event series) with its URL.

## Output (exactly two files)
1. `D:\aceads\leads\research-YYYY-MM-DD.csv` (UTF-8, comma-separated, header row):
   `segment,fit,business,group_or_venues,suburb,region,website,email,email_source_url,contact_first_name,phone,instagram,detail,detail_source_url,weakness,weakness_source_url,notes,checked_at`
   - `contact_first_name` only when the site names the person next to that email; otherwise blank.
   - `weakness` only for Segment B.
   - `checked_at` = the date and time you read the page, Brisbane time (AEST), e.g. 2026-10-06 14:05.
   - `fit` = 1 to 3: 3 = clear reason to contact now (a project, opening, renovation or award in the last 6 months, or a site problem a customer would hit), 2 = good fit, 1 = fits the segment but nothing timely. Sort the file by segment, then fit descending.
2. `D:\aceads\leads\research-YYYY-MM-DD-summary.md`: counts per segment and area, what you excluded and why (one line per reason with a count), the no-website businesses with phone numbers, and anything uncertain.

## Quality check before you finish
- Re-open a random 10% of rows and confirm the email still appears on `email_source_url`.
- No duplicate emails or websites in the file, and none already in the excluded files.
- No competitor and no chain slipped in.
- Every row has a detail with a URL.
If you cannot reach the target count with rows that pass every rule, stop short and say so. 120 good rows beat 200 doubtful ones.
