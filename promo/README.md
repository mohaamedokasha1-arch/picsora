# Piclizer — 20-second vertical promo

`piclizer-promo-20s-light.mp4` — the finished commercial.

| | |
|---|---|
| Resolution | 1080 × 1920 (9:16) |
| Duration | 20.00 s |
| Frame rate | 30 fps |
| Video | H.264 High, yuv420p, ~2 Mb/s |
| Audio | AAC 48 kHz stereo — Egyptian-Arabic voice-over + original music bed |
| Captions | Burned in, Arabic (reshaped + bidi-correct), word-by-word karaoke highlight |
| Size | 5 MB |

Made for TikTok / Instagram Reels / Facebook Reels / YouTube Shorts.

## Download

- Raw file: `https://github.com/mohaamedokasha1-arch/picsora/raw/arena/01a08480-picsora/promo/piclizer-promo-20s-light.mp4`
- Or open this folder on GitHub and press **Download raw file** (the ⬇ icon).

`preview-frames.png` is a contact sheet of all 18 key frames.

## Timeline

| Time | Beat |
|---|---|
| 0 – 3.1 s | Too many sites: browser tabs pile up (compress, resize, convert, PDF, OCR…) |
| 3.1 – 7 s | Chaos, then quick demos: Compress · Convert · Resize · PDF |
| 7 – 11.6 s | Piclizer: the real tool grid (compressor, resizer, cropper, JPG↔PNG, HEIC→JPG, background remover, image→PDF, PDF merger, OCR) |
| 11.6 – 16.6 s | Processing inside the browser + Free / No registration / No watermark / Private & Fast |
| 16.6 – 20 s | End card: official Piclizer logo, `piclizer.vercel.app`, tagline |

## Accuracy notes

- Logo: the repository's own official mark, `public/icons/icon.svg`, used unmodified.
- All on-screen strings come from the app itself (`lib/site.ts`, `messages/en.json`).
- Only real tools from `lib/tools/registry.ts` are shown, with their real Lucide icons.
- No invented statistics, buttons or features, and Piclizer is never described as an AI tool.

## Source

The renderer lives outside this repo in `/home/user/promo` (scene renderer, synthetic
music bed, ffmpeg pipeline). Higher-quality masters (31 MB / 71 MB) were produced there too.
