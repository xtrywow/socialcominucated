import {continueRender, delayRender, staticFile} from 'remotion';

const ARABIC_RANGE =
  'U+0600-06FF,U+0750-077F,U+0870-088E,U+0890-0891,U+0897-08E1,U+08E3-08FF,U+200C-200E,U+2010-2011,U+204F,U+2E41,U+FB50-FDFF,U+FE70-FE74,U+FE76-FEFC';

let loaded = false;

// فونت‌ها محلی‌اند (public/fonts) تا رندر به اینترنت وابسته نباشد.
// ترتیب مهم است: چهرهٔ عربی آخر تعریف می‌شود تا برای حروف فارسی اولویت داشته باشد.
export const loadFonts = () => {
  if (loaded || typeof document === 'undefined') return;
  loaded = true;
  const handle = delayRender('Loading Vazirmatn');
  const faces: FontFace[] = [];
  for (const subset of ['latin', 'arabic'] as const) {
    for (const weight of ['400', '700', '900']) {
      faces.push(
        new FontFace('Vazirmatn', `url(${staticFile(`fonts/vazirmatn-${subset}-${weight}-normal.woff2`)}) format('woff2')`, {
          weight,
          ...(subset === 'arabic' ? {unicodeRange: ARABIC_RANGE} : {}),
        }),
      );
    }
  }
  Promise.all(faces.map((f) => f.load()))
    .then((all) => {
      all.forEach((f) => document.fonts.add(f));
      continueRender(handle);
    })
    .catch((err) => {
      console.error(err);
      continueRender(handle);
    });
};
