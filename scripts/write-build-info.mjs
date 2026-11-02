import { writeFile } from 'node:fs/promises';

if (!/^[a-f0-9]{40}$/.test(process.env.BUILD_SHA ?? '')) {
  throw new Error('BUILD_SHA must contain the full tested commit SHA.');
}
await writeFile('frontend/dist/build-info.json', JSON.stringify({
  commit: process.env.BUILD_SHA,
  run: process.env.BUILD_RUN_URL ?? null,
  builtAt: new Date().toISOString(),
}, null, 2) + '\n');
