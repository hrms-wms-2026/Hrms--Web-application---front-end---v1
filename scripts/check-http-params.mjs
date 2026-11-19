#!/usr/bin/env node
/**
 * Guard: no new hand-built HttpParams.
 *
 * Query strings go through toHttpParams() in src/app/shared/data-access/api-params.ts (usually via
 * ApiClient), so empty values, false/0, dates and arrays follow one set of rules. This script counts
 * `new HttpParams(` per non-spec .ts file under src/app and fails when a file has more than its entry in
 * scripts/http-params-baseline.json. The baseline holds the files not migrated yet. It may only shrink.
 *
 *   node scripts/check-http-params.mjs           check (used by `npm run lint`)
 *   node scripts/check-http-params.mjs --update  rewrite the baseline after migrating a file
 *   node scripts/check-http-params.mjs --report  per-module table of what is left to migrate
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(root, 'src', 'app');
const BASELINE = path.join(root, 'scripts', 'http-params-baseline.json');
const HELPER = 'src/app/shared/data-access/api-params.ts';

const NEW_PARAMS = /new\s+HttpParams\s*\(/g;
const HTTP_CALL = /\bhttp\s*\.\s*(?:get|post|put|patch|delete|request)\s*[<(]/g;

function walk(dir, out) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (entry.name.endsWith('.ts') && !entry.name.endsWith('.spec.ts')) out.push(full);
  }
  return out;
}

const rel = (file) => path.relative(root, file).split(path.sep).join('/');
const files = walk(SRC, []).filter((f) => rel(f) !== HELPER);

const counts = {};
for (const file of files) {
  const n = (fs.readFileSync(file, 'utf8').match(NEW_PARAMS) ?? []).length;
  if (n) counts[rel(file)] = n;
}

if (process.argv.includes('--update')) {
  const sorted = Object.fromEntries(Object.entries(counts).sort(([a], [b]) => a.localeCompare(b)));
  fs.writeFileSync(BASELINE, JSON.stringify(sorted, null, 2) + '\n');
  console.log(`Baseline written: ${Object.keys(sorted).length} files, ${Object.values(sorted).reduce((a, b) => a + b, 0)} call sites.`);
  process.exit(0);
}

if (process.argv.includes('--report')) {
  const area = (file) => {
    const m = /^src\/app\/modules\/([^/]+)\//.exec(file);
    return m ? m[1] : file.split('/')[2];
  };
  const byArea = {};
  for (const file of files) {
    const text = fs.readFileSync(file, 'utf8');
    const httpCalls = (text.match(HTTP_CALL) ?? []).length;
    const params = counts[rel(file)] ?? 0;
    if (!httpCalls && !params) continue;
    const row = (byArea[area(rel(file))] ??= { files: 0, httpCalls: 0, params: 0 });
    row.files += 1;
    row.httpCalls += httpCalls;
    row.params += params;
  }
  const rows = Object.entries(byArea).sort(([, a], [, b]) => b.httpCalls - a.httpCalls);
  console.log('| Module | Files calling HttpClient | Raw HttpClient calls | `new HttpParams(` sites |');
  console.log('|---|---|---|---|');
  for (const [name, r] of rows) console.log(`| ${name} | ${r.files} | ${r.httpCalls} | ${r.params} |`);
  process.exit(0);
}

const baseline = fs.existsSync(BASELINE) ? JSON.parse(fs.readFileSync(BASELINE, 'utf8')) : {};
const over = Object.entries(counts).filter(([file, n]) => n > (baseline[file] ?? 0));
if (over.length) {
  console.error('✖ New hand-built HttpParams. Use ApiClient (src/app/shared/data-access/api-client.ts) or toHttpParams() instead:');
  for (const [file, n] of over) console.error(`  ${file}: ${n} (allowed ${baseline[file] ?? 0})`);
  process.exit(1);
}
const shrunk = Object.entries(baseline).filter(([file, n]) => (counts[file] ?? 0) < n).length;
console.log(`✔ No new hand-built HttpParams.${shrunk ? ` ${shrunk} file(s) now below baseline: run --update to lock it in.` : ''}`);
