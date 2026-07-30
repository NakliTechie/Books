import { cp, mkdir, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const outputDir = resolve(projectRoot, 'dist');

await rm(outputDir, { recursive: true, force: true });
await mkdir(outputDir, { recursive: true });
await Promise.all([
  cp(resolve(projectRoot, 'index.html'), resolve(outputDir, 'index.html')),
  cp(resolve(projectRoot, 'semantic-library.js'), resolve(outputDir, 'semantic-library.js')),
  cp(resolve(projectRoot, 'semantic-processing.js'), resolve(outputDir, 'semantic-processing.js')),
  cp(resolve(projectRoot, 'semantic-ai.js'), resolve(outputDir, 'semantic-ai.js')),
  cp(resolve(projectRoot, 'local-ai-sidecar.js'), resolve(outputDir, 'local-ai-sidecar.js')),
  cp(resolve(projectRoot, '_headers'), resolve(outputDir, '_headers')),
  cp(resolve(projectRoot, 'vendor'), resolve(outputDir, 'vendor'), { recursive: true }),
]);

console.log('Built Cloudflare static assets in dist/');
