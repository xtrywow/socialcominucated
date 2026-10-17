# موشن‌گرافی معرفی — حسین نقی‌پور

پروژهٔ Remotion v4 طبق بریف `motion-intro-brief.md`. دو خروجی ۹۰ ثانیه‌ای، 30fps:
`Intro-16x9` (1920×1080) و `Intro-9x16` (1080×1920).

## ویرایش
- همهٔ متن‌ها: `src/content.ts` (`**کلمه**` = طلایی، `|` = شکست خط در نسخهٔ عمودی)
- رنگ‌ها و مدت صحنه‌ها: `src/theme.ts`
- فایل‌های اختیاری در `public/` خودکار شناسایی می‌شوند:
  - `hossein.png` (پرتره بدون پس‌زمینه) — اگر نباشد placeholder «ح ن» نمایش داده می‌شود
  - `music.mp3` — fade-in ۱ ثانیه، fade-out ۲ ثانیه
  - `voice.mp3` — اگر باشد، موزیک خودکار کم می‌شود

## اجرا
```bash
npm install
npm run studio          # پیش‌نمایش
npm run render:16x9
npm run render:9x16
npm run cover           # کاور از فریم 2690
```
فونت Vazirmatn محلی است (`public/fonts`) و رندر به اینترنت نیاز ندارد.
