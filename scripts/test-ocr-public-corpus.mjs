import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const manifest = JSON.parse(readFileSync(
  new URL('../test/ocr-public-corpus.json', import.meta.url),
  'utf8',
));
assert.equal(manifest.recordType, 'books.ocr-public-corpus');
assert.equal(manifest.schemaVersion, 1);
assert.equal(manifest.fixtures.length, 6);

const ids = new Set();
const featureSet = new Set();
for (const fixture of manifest.fixtures) {
  assert.ok(!ids.has(fixture.id), `duplicate fixture ${fixture.id}`);
  ids.add(fixture.id);
  assert.match(fixture.filename, /^[a-z0-9-]+\.jpg$/);
  assert.match(fixture.url, /^https:\/\//);
  assert.match(fixture.sourcePage, /^https:\/\//);
  assert.match(fixture.rightsPage, /^https:\/\//);
  assert.match(fixture.sha256, /^[a-f0-9]{64}$/);
  assert.ok(fixture.byteLength > 100_000);
  assert.ok(Array.isArray(fixture.features) && fixture.features.length);
  assert.ok(Array.isArray(fixture.expectedRegions));
  fixture.features.forEach((feature) => featureSet.add(feature));
}

for (const required of [
  'born-scanned',
  'photographed-page',
  'handwritten',
  'formula',
  'complex-table',
  'authored-figures',
  'multi-column',
  'reading-order',
  'negative-control',
]) {
  assert.ok(featureSet.has(required), `missing OCR corpus class ${required}`);
}

const negative = manifest.fixtures.find(
  (fixture) => fixture.features.includes('negative-control'),
);
assert.equal(negative.expectedText, '');
assert.equal(negative.expectedOutcome, 'needs-review');
assert.ok(
  manifest.fixtures
    .filter((fixture) => !fixture.features.includes('negative-control'))
    .every((fixture) => fixture.expectedText.length >= 20),
);

console.log('Books public OCR corpus contract: PASS');
