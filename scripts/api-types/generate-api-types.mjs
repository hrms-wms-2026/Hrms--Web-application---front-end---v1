#!/usr/bin/env node
// Generates src/app/shared/api-types/backend-api.generated.ts from the backend Swagger document.
//
//   npm run api:types                          # from the local backend (https://localhost:7229)
//   npm run api:types -- --input swagger.json  # from a saved document (CI artifact)
//   npm run api:types -- --url <swagger url>   # from another backend (or set API_SWAGGER_URL)
//   npm run api:types:check [-- --input ...]   # fail if the committed file is out of date
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import {
  DEFAULT_SWAGGER_URL,
  GENERATED_PATH,
  download,
  generateTypes,
  sameContent,
} from './api-types-lib.mjs';

async function readSource(values) {
  if (values.input) {
    return readFile(values.input, 'utf8');
  }
  const url = values.url ?? process.env.API_SWAGGER_URL ?? DEFAULT_SWAGGER_URL;
  try {
    return await download(url);
  } catch (error) {
    const reason =
      error.message ||
      error.code ||
      error.errors?.map((e) => e.message).join('; ') ||
      String(error);
    throw new Error(
      `Could not read ${url}: ${reason}
` +
        'Is the backend running in Development (Swagger is only on in Development)? ' +
        'Or pass a saved document with --input <file>.',
    );
  }
}

async function main() {
  const { values } = parseArgs({
    options: {
      input: { type: 'string' },
      url: { type: 'string' },
      check: { type: 'boolean', default: false },
    },
  });

  const text = await readSource(values);
  let doc;
  try {
    doc = JSON.parse(text);
  } catch (e) {
    throw new Error(
      `Swagger document from ${values.input ?? 'the backend'} is not valid JSON: ${e.message}`,
    );
  }
  const target = resolve(GENERATED_PATH);
  const generated = await generateTypes(doc, target);

  if (values.check) {
    const current = await readFile(target, 'utf8').catch((e) => {
      if (e.code === 'ENOENT') return '';
      throw e;
    });
    if (!sameContent(current, generated)) {
      console.error(
        `${GENERATED_PATH} is out of date with the backend contract.
` + 'Run `npm run api:types` and commit the result.',
      );
      process.exit(1);
    }
    console.log(`${GENERATED_PATH} matches the backend contract.`);
    return;
  }

  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, generated);
  console.log(`Wrote ${GENERATED_PATH}`);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
