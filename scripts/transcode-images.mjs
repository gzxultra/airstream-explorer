// One-shot (re-runnable) image transcoder: JPG -> WebP for public/assets/img.
//
// Why: WebP is ~35-60% smaller than JPEG at visually-equal quality. The site's
// images (heroes/gallery/floorplans/community/thumbs) are the dominant payload
// (~22 MB of 25 MB dist). Shipping WebP cuts repeat-visit bandwidth a lot, which
// matters most on the slow/throttled networks this site targets (mainland China).
//
// We commit the WebP files as the source of truth (not transcode at build time)
// so CI/Cloudflare needs ZERO extra tooling — `build.mjs` just copies what's here.
// Run this only when NEW jpgs are added (heroes/gallery/etc.), then commit.
//
// Quality is tiered: photographs compress hard with no visible loss; floorplan
// DIAGRAMS carry thin lines + text labels, so they get a higher quality to keep
// the lettering crisp (Ernie flags any image that "looks bad").
//
// Requires: ffmpeg with libwebp (available locally; NOT needed in CI).
import { readdirSync, statSync, rmSync, existsSync } from 'node:fs';
import { join, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const IMG = join(ROOT, 'public', 'assets', 'img');

// WebP quality by image category. Photos -> aggressive; diagrams -> conservative.
const QUALITY = {
  floorplans: 90, // line-art diagrams with text labels: protect legibility
  community: 82,
  thumbs: 80,
  heroes: 80,
  gallery: 80,
  _default: 82,
};

const qualityFor = (absPath) => {
  const parts = absPath.split('/');
  const i = parts.lastIndexOf('img');
  const sub = i >= 0 ? parts[i + 1] : '';
  return QUALITY[sub] ?? QUALITY._default;
};

const jpgs = [];
const walk = (dir) => {
  for (const name of readdirSync(dir)) {
    const abs = join(dir, name);
    if (statSync(abs).isDirectory()) { walk(abs); continue; }
    if (/\.jpe?g$/i.test(name)) jpgs.push(abs);
  }
};
if (!existsSync(IMG)) { console.error('no image dir:', IMG); process.exit(1); }
walk(IMG);

let beforeBytes = 0;
let afterBytes = 0;
let converted = 0;
for (const src of jpgs) {
  const out = src.replace(/\.jpe?g$/i, '.webp');
  const q = qualityFor(src);
  beforeBytes += statSync(src).size;
  execFileSync('ffmpeg', [
    '-y', '-loglevel', 'error',
    '-i', src,
    '-c:v', 'libwebp',
    '-quality', String(q),
    '-compression_level', '6',
    out,
  ]);
  afterBytes += statSync(out).size;
  rmSync(src); // remove the JPEG; WebP is now the committed source of truth
  converted++;
  process.stdout.write(`  ${basename(out)} (q${q})\n`);
}

const mb = (b) => (b / 1048576).toFixed(2) + ' MB';
console.log(
  `\nTranscoded ${converted} images: ${mb(beforeBytes)} -> ${mb(afterBytes)} ` +
  `(${Math.round((1 - afterBytes / beforeBytes) * 100)}% smaller)`,
);
