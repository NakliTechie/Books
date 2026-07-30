export const PROCESSING_SCHEMA_VERSION = 1;
export const PASSAGE_EXTRACTOR_VERSION = 'passages-v1';
export const LEXICAL_INDEX_VERSION = 'lexical-v1';
export const DETERMINISTIC_SEMANTICS_VERSION = 'deterministic-semantics-v1';

const STOP_WORDS = new Set([
  'about', 'after', 'again', 'against', 'also', 'among', 'because', 'been',
  'before', 'being', 'between', 'both', 'could', 'does', 'doing', 'down',
  'during', 'each', 'from', 'further', 'have', 'having', 'here', 'into',
  'itself', 'more', 'most', 'other', 'over', 'same', 'should', 'some',
  'such', 'than', 'that', 'their', 'theirs', 'them', 'then', 'there',
  'these', 'they', 'this', 'those', 'through', 'under', 'until', 'very',
  'what', 'when', 'where', 'which', 'while', 'with', 'would', 'your',
]);

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value));
}

export function normalizePassageText(value) {
  return String(value || '')
    .replace(/\r\n?/g, '\n')
    .replace(/[\t\f\v ]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function tokenize(value) {
  const normalized = normalizePassageText(value).toLocaleLowerCase();
  return normalized.match(/[\p{L}\p{N}][\p{L}\p{N}'’-]*/gu) || [];
}

async function sha256Text(value) {
  const bytes = new TextEncoder().encode(String(value));
  const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes);
  return 'sha256:' + Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, '0')).join('');
}

function splitSection(text, maxChars) {
  const normalized = normalizePassageText(text);
  if (!normalized) return [];
  const paragraphs = normalized.split(/\n{2,}/);
  const chunks = [];
  let chunk = '';
  let sourceStart = 0;
  let cursor = 0;

  const pushChunk = () => {
    const value = chunk.trim();
    if (!value) return;
    chunks.push({
      text: value,
      start: sourceStart,
      end: sourceStart + value.length,
    });
    chunk = '';
  };

  for (const paragraph of paragraphs) {
    const trimmed = paragraph.trim();
    const paragraphStart = normalized.indexOf(trimmed, cursor);
    cursor = Math.max(cursor, paragraphStart + trimmed.length);
    if (!trimmed) continue;
    if (trimmed.length > maxChars) {
      pushChunk();
      for (let offset = 0; offset < trimmed.length; offset += maxChars) {
        const end = Math.min(trimmed.length, offset + maxChars);
        chunks.push({
          text: trimmed.slice(offset, end),
          start: paragraphStart + offset,
          end: paragraphStart + end,
        });
      }
      continue;
    }
    if (chunk && chunk.length + 2 + trimmed.length > maxChars) pushChunk();
    if (!chunk) sourceStart = paragraphStart;
    chunk += (chunk ? '\n\n' : '') + trimmed;
  }
  pushChunk();
  return chunks;
}

export async function segmentSections({
  workId,
  assetId,
  format,
  sections = [],
  maxChars = 1400,
}) {
  const passages = [];
  for (let sectionIndex = 0; sectionIndex < sections.length; sectionIndex++) {
    const section = sections[sectionIndex] || {};
    const normalized = normalizePassageText(section.text);
    const chunks = splitSection(normalized, maxChars);
    for (const chunk of chunks) {
      const quote = chunk.text.slice(0, 240);
      const passageId = [
        'passage',
        assetId,
        sectionIndex,
        chunk.start,
        chunk.end,
      ].join('_');
      passages.push({
        passageId,
        workId,
        assetId,
        extractorVersion: PASSAGE_EXTRACTOR_VERSION,
        order: passages.length,
        text: chunk.text,
        structure: {
          sectionIndex,
          label: section.label || null,
        },
        anchor: {
          format,
          normalizedRange: {
            start: chunk.start,
            end: chunk.end,
          },
          quote,
          quoteHash: await sha256Text(quote),
          engine: {
            ...(cloneJson(section.anchor || {})),
            fraction: normalized.length ? chunk.start / normalized.length : 0,
          },
        },
      });
    }
  }
  return passages;
}

export function buildLexicalIndex({ workId, title = '', authors = [], passages = [] }) {
  const postings = {};
  const termFrequency = {};
  const add = (term, passageIndex, weight = 1) => {
    if (!postings[term]) postings[term] = [];
    const last = postings[term][postings[term].length - 1];
    if (last !== passageIndex) postings[term].push(passageIndex);
    termFrequency[term] = (termFrequency[term] || 0) + weight;
  };

  const metadataText = [title]
    .concat(authors.map((author) => author?.name || author || ''))
    .join(' ');
  for (const term of tokenize(metadataText)) add(term, -1, 3);
  passages.forEach((passage, passageIndex) => {
    for (const term of tokenize(passage.text)) add(term, passageIndex, 1);
  });

  const sortedPostings = {};
  for (const term of Object.keys(postings).sort()) sortedPostings[term] = postings[term];
  return {
    schemaVersion: PROCESSING_SCHEMA_VERSION,
    recordType: 'books.lexical-index',
    indexVersion: LEXICAL_INDEX_VERSION,
    workId,
    passageIds: passages.map((passage) => passage.passageId),
    postings: sortedPostings,
    termFrequency,
  };
}

export function searchLexicalIndex(index, query) {
  const terms = Array.from(new Set(tokenize(query)));
  if (!terms.length || !index?.postings) return [];
  const scores = new Map();
  for (const term of terms) {
    for (const passageIndex of index.postings[term] || []) {
      if (passageIndex < 0) continue;
      scores.set(passageIndex, (scores.get(passageIndex) || 0) + 1);
    }
  }
  return Array.from(scores, ([passageIndex, score]) => ({
    passageIndex,
    passageId: index.passageIds[passageIndex],
    score: score / terms.length,
  })).sort((left, right) =>
    right.score - left.score || left.passageIndex - right.passageIndex);
}

export function extractDeterministicSemantics({
  workId,
  passages,
  lexicalIndex,
  maxConcepts = 16,
  maxScenes = 12,
}) {
  const candidates = Object.entries(lexicalIndex.termFrequency || {})
    .filter(([term]) => (
      term.length >= 4
      && !STOP_WORDS.has(term)
      && !/^\p{N}+$/u.test(term)
    ))
    .map(([term, frequency]) => {
      const passageIndexes = (lexicalIndex.postings[term] || [])
        .filter((index) => index >= 0);
      return {
        term,
        frequency,
        spread: passageIndexes.length,
        passageIndexes,
        score: frequency * (1 + Math.log2(1 + passageIndexes.length)),
      };
    })
    .filter((candidate) => candidate.passageIndexes.length > 0)
    .sort((left, right) =>
      right.score - left.score || left.term.localeCompare(right.term))
    .slice(0, maxConcepts);

  const concepts = candidates.map((candidate) => ({
    conceptId: 'concept_' + workId + '_' + candidate.term.replace(/[^\p{L}\p{N}-]+/gu, '_'),
    workId,
    label: candidate.term,
    kind: 'candidate-topic',
    description: null,
    confidence: Math.min(0.85, 0.35 + Math.log10(1 + candidate.score) / 3),
    evidence: candidate.passageIndexes.slice(0, 4).map((index) => ({
      passageId: passages[index].passageId,
      quoteHash: passages[index].anchor.quoteHash,
      weight: 1,
    })),
    generatedBy: {
      extractor: DETERMINISTIC_SEMANTICS_VERSION,
      mode: 'deterministic-local',
    },
    userState: {
      hidden: false,
      labelOverride: null,
    },
  }));

  const sectionFirstPassages = new Map();
  for (const passage of passages) {
    const sectionIndex = passage.structure.sectionIndex;
    if (!sectionFirstPassages.has(sectionIndex)) {
      sectionFirstPassages.set(sectionIndex, passage);
    }
  }
  const scenes = Array.from(sectionFirstPassages.values())
    .slice(0, maxScenes)
    .map((passage, index) => ({
      sceneId: 'scene_' + workId + '_' + String(index + 1),
      workId,
      label: passage.structure.label || 'Section ' + (passage.structure.sectionIndex + 1),
      kind: 'section-opening',
      description: passage.text.slice(0, 320),
      evidence: [{
        passageId: passage.passageId,
        quoteHash: passage.anchor.quoteHash,
        weight: 1,
      }],
      generatedBy: {
        extractor: DETERMINISTIC_SEMANTICS_VERSION,
        mode: 'deterministic-local',
      },
      userState: {
        hidden: false,
        labelOverride: null,
      },
    }));

  return {
    schemaVersion: PROCESSING_SCHEMA_VERSION,
    recordType: 'books.semantic-records',
    extractorVersion: DETERMINISTIC_SEMANTICS_VERSION,
    workId,
    concepts,
    scenes,
  };
}

export function makeProcessingRun({
  workId,
  assetId,
  previous = null,
  now = () => new Date().toISOString(),
}) {
  const createdAt = previous?.createdAt || now();
  return {
    schemaVersion: PROCESSING_SCHEMA_VERSION,
    recordType: 'books.processing-run',
    workId,
    assetId,
    stages: cloneJson(previous?.stages || {
      fingerprint: { status: 'pending' },
      passages: { status: 'pending' },
      lexicalIndex: { status: 'pending' },
      deterministicSemantics: { status: 'pending' },
      modelSemantics: { status: 'waiting-for-provider' },
    }),
    createdAt,
    updatedAt: previous?.updatedAt || createdAt,
  };
}

export function updateProcessingStage(
  run,
  stage,
  status,
  details = {},
  now = () => new Date().toISOString(),
) {
  const next = cloneJson(run);
  next.stages[stage] = {
    ...(next.stages[stage] || {}),
    ...cloneJson(details),
    status,
    updatedAt: now(),
  };
  next.updatedAt = next.stages[stage].updatedAt;
  return next;
}

export function passagesPath(workId) {
  return `semantic/${workId}/passages.json`;
}

export function semanticRecordsPath(workId) {
  return `semantic/${workId}/records.json`;
}

export function workLexicalIndexPath(workId) {
  return `indexes/works/${workId}.json`;
}

export function processingRunPath(workId) {
  return `jobs/${workId}.json`;
}
