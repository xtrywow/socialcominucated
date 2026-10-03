# aceads.au: free website preview funnel

Visitor fills in the form on aceads.au → lead saved in WordPress → team gets a
Telegram message and an email → GitHub Actions renders a one-page concept for
that business → the files come back to aceads.au and are hosted under
`/wp-content/uploads/aceads-previews/<slug>/` → the prospect gets the link by
email and the team gets a second Telegram message saying "call them".

Nothing is sent to anyone who did not ask for it: the prospect typed their own
details and ticked the consent box, so the email is solicited.

See `mockups/README.md` for how the preview itself is built.

## Install (once, about 20 minutes)

1. **Plugin.** Zip the `aceads-preview` folder (or use the zip in this folder),
   then WordPress → Plugins → Add New → Upload → Activate.
2. **Page.** Create a page, e.g. `/free-website-preview/`, containing the
   shortcode `[aceads_preview_form]`. That page is where ads send people.
3. **Settings → AceAds Previews.**
   - Team email.
   - Telegram: message @BotFather, `/newbot`, copy the token. Add the bot to
     your team group, send one message there, then open
     `https://api.telegram.org/bot<TOKEN>/getUpdates` and copy the `chat.id`
     (a group id is negative).
   - GitHub repository `xtrywow/socialcominucated` and a fine-grained personal
     access token for that repository only, with **Contents: read and write**
     (that is the permission `repository_dispatch` needs).
   - Copy the **preview secret** shown there.
4. **GitHub.** Repository → Settings → Secrets and variables → Actions → new
   secret `PREVIEW_SECRET` with the same value as the plugin's preview secret.
5. **Test.** Submit the form yourself. Within a few minutes: Telegram message,
   a run under Actions → "Build website preview", a second Telegram message with
   the link, and an email at the address you typed.

Prices shown on the page come from the settings (defaults: Starter A$690,
Business A$1,490, Care plan A$39/month) and can be changed any time.

## Working leads

WordPress → **Preview leads** lists every request with phone, social link,
preview link and a status you set after each call (new, preview ready, called,
DM sent, meeting booked, won, not interested).

If a prospect says stop, set "not interested" and delete the preview folder
from Media / the uploads directory.

## Traffic

The form only works if people reach it. Point Google Ads (searches like
"website for my business Brisbane") and Meta ads (small-business owners in
Queensland, a before/after video of one preview) at the page. Watch three
numbers: cost per form, forms reached by phone, calls that become sales.
