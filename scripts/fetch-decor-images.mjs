// Download official Airstream décor swatch images referenced by
// src/data/decor-options.json, resize via Storyblok's image service, transcode
// to WebP into public/assets/img/decor/, and rewrite decor-options.json to
// reference the local files. Same localize→fingerprint pipeline as floorplans.
//
// The VM reaches the real Storyblok asset URLs (a-us.storyblok.com/f/...).
// Resize recipe: append /m/<W>x0/filters:format(jpeg):quality(82).
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const DATA = path.resolve('src/data/decor-options.json');
const OUT_DIR = path.resolve('public/assets/img/decor');
const TMP = '/tmp/decor-dl';
fs.mkdirSync(OUT_DIR, { recursive: true });
fs.mkdirSync(TMP, { recursive: true });

const SWATCH_W = 600; // material swatch (first one shown larger in UI)

function slugify(s) {
  return String(s || '').toLowerCase().normalize('NFKD')
    .replace(/®|™/g, '').replace(/[^\w\s-]/g, '').trim()
    .replace(/[\s_]+/g, '-').replace(/-+/g, '-');
}

function resized(url, w) {
  const base = url.includes('/m/') ? url.split('/m/')[0] : url;
  return `${base}/m/${w}x0/filters:format(jpeg):quality(82)`;
}

function fetchToJpeg(url, outJpeg) {
  execFileSync('curl', ['-sL', '--max-time', '60', '-o', outJpeg, url], { stdio: 'pipe' });
  const sz = fs.statSync(outJpeg).size;
  if (sz < 500) throw new Error(`tiny download (${sz}b) for ${url}`);
  return sz;
}

function toWebp(inFile, outWebp, quality) {
  // flatten any alpha on white, then encode WebP via ffmpeg (no cwebp on VM)
  execFileSync('ffmpeg', [
    '-y', '-hide_banner', '-loglevel', 'error',
    '-i', inFile,
    '-f', 'lavfi', '-i', 'color=white',
    '-filter_complex', '[1][0]scale2ref[bg][fg];[bg][fg]overlay=shortest=1,format=rgb24',
    '-c:v', 'libwebp', '-quality', String(quality),
    outWebp,
  ], { stdio: 'pipe' });
}

const decor = JSON.parse(fs.readFileSync(DATA, 'utf8'));
let nSwatch = 0, nFail = 0;
const manifest = {};

for (const [family, schemes] of Object.entries(decor)) {
  manifest[family] = [];
  for (const scheme of schemes) {
    const sslug = slugify(scheme.name);
    const rec = { name: scheme.name, slug: sslug, description: scheme.description || '', swatches: [] };
    scheme.swatches.forEach((sw, i) => {
      const base = `${family}-${sslug}-sw${i + 1}`;
      try {
        const jpg = path.join(TMP, base + '.jpg');
        fetchToJpeg(resized(sw.url, SWATCH_W), jpg);
        toWebp(jpg, path.join(OUT_DIR, base + '.webp'), 82);
        rec.swatches.push({ kind: sw.kind, file: base + '.webp' });
        nSwatch++;
      } catch (e) { console.warn('  swatch FAIL', base, e.message); nFail++; }
    });
    manifest[family].push(rec);
    console.log(`${family}/${sslug}: ${rec.swatches.length} swatches (${rec.swatches.map((s) => s.kind).join(', ')})`);
  }
}

fs.writeFileSync(DATA, JSON.stringify(manifest, null, 2) + '\n');
console.log(`\nDone. swatches=${nSwatch} failures=${nFail}. Rewrote ${DATA} with local file refs.`);
