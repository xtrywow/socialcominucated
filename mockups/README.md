# Website concept previews

Personalised one-page concepts to send to leads ("we made a preview of your website").

```bash
python mockups/build.py                          # writes mockups/out/<slug>/index.html (+ local fonts)
node mockups/screenshot.mjs                      # phone.png / desktop.png per concept
# if playwright is only installed globally:
PLAYWRIGHT_MODULE=$(npm root -g)/playwright/index.js node mockups/screenshot.mjs
```

Add a business to `businesses.json` (theme: `brass`, `morning` or `dropout`).

Rules:
- Use only public facts: name, address, phone, social link. Menus, photos and hours stay
  clearly marked placeholders. Never invent prices, reviews or claims.
- Every page carries a "Concept preview made by AceAds, not a live website" ribbon and
  `noindex`. Take hosted previews down if the business says no.
