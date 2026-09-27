#!/usr/bin/env python3
"""Generate responsive hero variants (perf #28).

For every 1280x720 public/assets/img/heroes/*.webp, emits:
  <slug>-640.webp   (640x360)
  <slug>-960.webp   (960x540)
Quality 85, Lanczos. Idempotent: re-run to refresh variants.
Fingerprinting (scripts/build.mjs step 6) picks the variants up automatically.
"""
import glob, os, sys
from PIL import Image

HERO_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)),
                        '..', 'public', 'assets', 'img', 'heroes')

def main():
    files = sorted(glob.glob(os.path.join(HERO_DIR, '*.webp')))
    made = 0
    for src in files:
        base = os.path.basename(src)
        if base.endswith('-640.webp') or base.endswith('-960.webp'):
            continue
        im = Image.open(src)
        stem = src[:-len('.webp')]
        for w in (640, 960):
            out = f'{stem}-{w}.webp'
            h = round(im.height * w / im.width)
            im.resize((w, h), Image.LANCZOS).save(out, 'WEBP', quality=85, method=6)
            print(out, os.path.getsize(out))
            made += 1
    print(f'done: {made} variants')

if __name__ == '__main__':
    main()
