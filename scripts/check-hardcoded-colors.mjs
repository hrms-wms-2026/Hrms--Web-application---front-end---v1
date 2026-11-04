#!/usr/bin/env node
/**
 * Guard: no new hard-coded colours in components.
 *
 * Every colour should come from src/app/shared/styles/theme-tokens.css (var(--color-*) / var(--shadow-*)),
 * so light/dark mode and the accent presets re-skin the whole app. This script counts, per file:
 *   - hex colours (#fff, #2563eb, ...) that are not a var(--x, #hex) fallback
 *   - Tailwind palette colour utilities (bg-white, text-slate-500, bg-blue-600, ...)
 * and fails when a file has more than its entry in scripts/hardcoded-colors-baseline.json.
 *
 * The baseline holds the colours that are intentional data (chart series, legend swatches, the
 * task-kind palette, colour pickers, brand logos) plus anything not migrated yet. It may only shrink.
 *
 *   node scripts/check-hardcoded-colors.mjs           check (used by `npm run lint`)
 *   node scripts/check-hardcoded-colors.mjs --update  rewrite the baseline after removing colours
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(root, 'src', 'app');
const BASELINE = path.join(root, 'scripts', 'hardcoded-colors-baseline.json');
// Public marketing pages have their own design and dark mode; the token file is the source itself.
const SKIP = [/[\\/]modules[\\/]public[\\/]/, /theme-tokens\.css$/, /\.spec\.ts$/];

const HEX = /(var\(--[a-z0-9-]+,\s*)?#[0-9a-fA-F]{3,8}\b/g;
const TW_COLOR = /(?<![\w-])(?:[a-z-]+:)*(?:bg|text|border|ring|divide|outline|from|via|to)-(?:white|black|slate|gray|zinc|neutral|stone|red|rose|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink)(?:-\d{2,3})?(?:\/\d{1,3})?(?![\w-])/g;
// HTML character references such as &#10005; are not colours.
const ENTITY = /&#\d+;/g;

function walk(dir, out) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (/\.(css|html|ts)$/.test(entry.name) && !SKIP.some((re) => re.test(full))) out.push(full);
  }
  return out;
}

function count(file) {
  const text = fs.readFileSync(file, 'utf8').replace(ENTITY, '');
  let n = 0;
  for (const m of text.matchAll(HEX)) if (!m[1]) n++;
  if (!file.endsWith('.css')) n += (text.match(TW_COLOR) ?? []).length;
  return n;
}

const counts = {};
for (const file of walk(SRC, [])) {
  const n = count(file);
  if (n) counts[path.relative(root, file).split(path.sep).join('/')] = n;
}

if (process.argv.includes('--update')) {
  const sorted = Object.fromEntries(Object.entries(counts).sort(([a], [b]) => a.localeCompare(b)));
  fs.writeFileSync(BASELINE, JSON.stringify(sorted, null, 2) + '\n');
  console.log(`Baseline written: ${Object.keys(sorted).length} files, ${Object.values(sorted).reduce((a, b) => a + b, 0)} colours.`);
  process.exit(0);
}

const baseline = fs.existsSync(BASELINE) ? JSON.parse(fs.readFileSync(BASELINE, 'utf8')) : {};
const over = Object.entries(counts).filter(([file, n]) => n > (baseline[file] ?? 0));
if (over.length) {
  console.error('✖ Hard-coded colours added. Use theme tokens from src/app/shared/styles/theme-tokens.css instead:');
  for (const [file, n] of over) console.error(`  ${file}: ${n} (allowed ${baseline[file] ?? 0})`);
  console.error('If a colour is intentional data (chart series, picker swatch, brand logo), run');
  console.error('`node scripts/check-hardcoded-colors.mjs --update` and explain it in the commit.');
  process.exit(1);
}
const shrunk = Object.entries(baseline).filter(([file, n]) => (counts[file] ?? 0) < n).length;
console.log(`✔ No new hard-coded colours.${shrunk ? ` ${shrunk} file(s) now below baseline: run --update to lock it in.` : ''}`);
