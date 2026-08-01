import assert from 'node:assert/strict';
import {
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import {
  buildLexicalIndex,
  extractDeterministicSemantics,
  segmentSections,
} from '../semantic-processing.js';
import {
  makeSourceGroundedIdeas,
} from '../idea-graph.js';
import {
  makeSemanticUnits,
} from '../echoes.js';

const fixture = mkdtempSync(join(tmpdir(), 'books-executor-parity-'));
process.on('exit', () => rmSync(fixture, { recursive:true, force:true }));
const sourceText = [
  '# Feedback',
  '',
  'Fast feedback changes future behaviour.',
  '',
  'A durable library preserves evidence and context.',
].join('\n');
writeFileSync(join(fixture, 'Feedback.md'), sourceText);
execFileSync(
  'python3',
  [
    new URL('./books-index.py', import.meta.url).pathname,
    fixture,
    '--no-embeddings',
  ],
  { stdio:'pipe' },
);
const catalog = JSON.parse(readFileSync(
  join(fixture, '.books', 'catalog', 'catalog.json'),
  'utf8',
));
const workId = catalog.works[0].workId;
const manifest = JSON.parse(readFileSync(
  join(fixture, '.books', 'catalog', 'works', workId + '.json'),
  'utf8',
));
const asset = manifest.assets[0];
const nativePassageRecord = JSON.parse(readFileSync(
  join(fixture, '.books', 'semantic', workId, 'passages.json'),
  'utf8',
));
const nativeLexical = JSON.parse(readFileSync(
  join(fixture, '.books', 'indexes', 'works', workId + '.json'),
  'utf8',
));
const nativeSemantics = JSON.parse(readFileSync(
  join(fixture, '.books', 'semantic', workId, 'records.json'),
  'utf8',
));
const nativeIdeas = JSON.parse(readFileSync(
  join(fixture, '.books', 'semantic', workId, 'ideas.json'),
  'utf8',
));
const nativeUnits = JSON.parse(readFileSync(
  join(fixture, '.books', 'semantic', workId, 'units.json'),
  'utf8',
));

const browserPassages = await segmentSections({
  workId,
  assetId:asset.assetId,
  format:'md',
  sections:[{
    label:'Feedback',
    text:sourceText.replace(/^# Feedback\n+/, ''),
    anchor:{ kind:'text-offset', sectionIndex:0 },
  }],
});
const browserLexical = buildLexicalIndex({
  workId,
  title:manifest.title,
  authors:manifest.authors,
  passages:browserPassages,
});
const browserSemantics = extractDeterministicSemantics({
  workId,
  passages:browserPassages,
  lexicalIndex:browserLexical,
});
const browserIdeas = makeSourceGroundedIdeas({
  workId,
  semanticRecord:{
    ...browserSemantics,
    sourceFingerprint:asset.fingerprint,
  },
  passages:browserPassages,
});
const browserUnits = makeSemanticUnits({
  workId,
  semanticRecord:{
    ...browserSemantics,
    sourceFingerprint:asset.fingerprint,
  },
  passages:browserPassages,
});

assert.equal(nativePassageRecord.assetId, asset.assetId);
assert.deepEqual(
  nativePassageRecord.passages.map((passage) => ({
    passageId:passage.passageId,
    text:passage.text,
    label:passage.structure.label,
    quoteHash:passage.anchor.quoteHash,
    range:passage.anchor.normalizedRange,
    paragraphs:passage.paragraphs.map((paragraph) => ({
      paragraphId:paragraph.paragraphId,
      text:paragraph.text,
      quoteHash:paragraph.anchor.quoteHash,
      textHash:paragraph.anchor.textHash,
      range:paragraph.anchor.normalizedRange,
      structure:paragraph.structure,
    })),
  })),
  browserPassages.map((passage) => ({
    passageId:passage.passageId,
    text:passage.text,
    label:passage.structure.label,
    quoteHash:passage.anchor.quoteHash,
    range:passage.anchor.normalizedRange,
    paragraphs:passage.paragraphs.map((paragraph) => ({
      paragraphId:paragraph.paragraphId,
      text:paragraph.text,
      quoteHash:paragraph.anchor.quoteHash,
      textHash:paragraph.anchor.textHash,
      range:paragraph.anchor.normalizedRange,
      structure:paragraph.structure,
    })),
  })),
  'browser and native executors produce the same passage identity and evidence anchors',
);
assert.deepEqual(nativeLexical.postings, browserLexical.postings);
assert.deepEqual(nativeLexical.termFrequency, browserLexical.termFrequency);
assert.deepEqual(
  nativeSemantics.concepts.map((concept) => ({
    label:concept.label,
    evidence:concept.evidence.map((row) => row.passageId),
  })),
  browserSemantics.concepts.map((concept) => ({
    label:concept.label,
    evidence:concept.evidence.map((row) => row.passageId),
  })),
);
assert.deepEqual(
  nativeSemantics.scenes.map((scene) => ({
    sceneId:scene.sceneId,
    label:scene.label,
    kind:scene.kind,
    description:scene.description,
    evidence:scene.evidence.map((row) => row.passageId),
  })),
  browserSemantics.scenes.map((scene) => ({
    sceneId:scene.sceneId,
    label:scene.label,
    kind:scene.kind,
    description:scene.description,
    evidence:scene.evidence.map((row) => row.passageId),
  })),
  'browser and native executors produce the same section-grounded scenes',
);
assert.deepEqual(
  nativeIdeas.ideas.map((idea) => ({
    label:idea.label,
    evidence:idea.evidence.map((row) => row.passageId),
  })),
  browserIdeas.ideas.map((idea) => ({
    label:idea.label,
    evidence:idea.evidence.map((row) => row.passageId),
  })),
);
assert.deepEqual(
  nativeUnits.units.map((unit) => ({
    unitId:unit.unitId,
    kind:unit.kind,
    lens:unit.lens,
    statement:unit.statement,
    evidence:unit.evidence.map((row) => ({
      passageId:row.passageId,
      paragraphId:row.paragraphId,
      quoteHash:row.quoteHash,
      textHash:row.textHash,
      order:row.order,
      positionFraction:row.positionFraction,
    })),
  })),
  browserUnits.units.map((unit) => ({
    unitId:unit.unitId,
    kind:unit.kind,
    lens:unit.lens,
    statement:unit.statement,
    evidence:unit.evidence.map((row) => ({
      passageId:row.passageId,
      paragraphId:row.paragraphId,
      quoteHash:row.quoteHash,
      textHash:row.textHash,
      order:row.order,
      positionFraction:row.positionFraction,
    })),
  })),
  'browser and native executors produce the same typed semantic units',
);

// M16 — a long non-BMP paragraph must fragment identically across executors.
// 800 astral code points = 1600 UTF-16 units, above the 1400-unit passage
// budget; a code-point splitter would keep it whole while a UTF-16 splitter
// makes two fragments, so this fixture discriminates the two algorithms.
const astralFixture = mkdtempSync(join(tmpdir(), 'books-astral-parity-'));
process.on('exit', () => rmSync(astralFixture, { recursive:true, force:true }));
const astralParagraph = '\u{1F4A1}'.repeat(800);
const astralSource = ['# Sparks', '', astralParagraph].join('\n');
writeFileSync(join(astralFixture, 'Sparks.md'), astralSource);
execFileSync(
  'python3',
  [new URL('./books-index.py', import.meta.url).pathname, astralFixture, '--no-embeddings'],
  { stdio:'pipe' },
);
const astralCatalog = JSON.parse(readFileSync(
  join(astralFixture, '.books', 'catalog', 'catalog.json'), 'utf8'));
const astralWorkId = astralCatalog.works[0].workId;
const astralManifest = JSON.parse(readFileSync(
  join(astralFixture, '.books', 'catalog', 'works', astralWorkId + '.json'), 'utf8'));
const astralAsset = astralManifest.assets[0];
const nativeAstralPassages = JSON.parse(readFileSync(
  join(astralFixture, '.books', 'semantic', astralWorkId, 'passages.json'), 'utf8'));
const browserAstralPassages = await segmentSections({
  workId:astralWorkId,
  assetId:astralAsset.assetId,
  format:'md',
  sections:[{
    label:'Sparks',
    text:astralParagraph,
    anchor:{ kind:'text-offset', sectionIndex:0 },
  }],
});
const projectAstral = (passages) => passages.map((passage) => ({
  passageId:passage.passageId,
  paragraphs:passage.paragraphs.map((paragraph) => ({
    paragraphId:paragraph.paragraphId,
    text:paragraph.text,
    range:paragraph.anchor.normalizedRange,
    structure:paragraph.structure,
  })),
}));
const nativeAstralFragments = nativeAstralPassages.passages.flatMap(
  (passage) => passage.paragraphs);
assert.ok(nativeAstralFragments.length >= 2,
  'a 1600-unit astral paragraph fragments into at least two parts');
assert.deepEqual(
  projectAstral(nativeAstralPassages.passages),
  projectAstral(browserAstralPassages),
  'browser and native executors fragment non-BMP paragraphs identically (M16)',
);

console.log('Books browser/native executor parity: PASS');
