export const OCR_ARTIFACT_SCHEMA_VERSION = 1;
export const OCR_ARTIFACT_STATUSES = Object.freeze([
  'unavailable',
  'queued',
  'running',
  'partial',
  'complete',
  'failed',
  'needs-review',
]);
export const OCR_REGION_KINDS = Object.freeze([
  'text',
  'heading',
  'list',
  'table',
  'formula',
  'figure',
  'caption',
  'footnote',
  'unknown',
]);

const STATUS_SET = new Set(OCR_ARTIFACT_STATUSES);
const REGION_KIND_SET = new Set(OCR_REGION_KINDS);

function finite(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function normalizedBox(value) {
  const box = value || {};
  return {
    x:Math.max(0, finite(box.x)),
    y:Math.max(0, finite(box.y)),
    width:Math.max(0, finite(box.width)),
    height:Math.max(0, finite(box.height)),
  };
}

export function ocrArtifactPath(workId, assetId) {
  if (!workId || !assetId) throw new Error('OCR artifacts require work and asset IDs');
  return `semantic/${workId}/ocr/${assetId}.json`;
}

export function makeOcrArtifact({
  workId,
  assetId,
  sourceFingerprint,
  status = 'queued',
  pages = [],
  engine = null,
  error = null,
  updatedAt = new Date().toISOString(),
} = {}) {
  if (!workId || !assetId || !sourceFingerprint) {
    throw new Error('OCR artifacts require workId, assetId, and sourceFingerprint');
  }
  if (!STATUS_SET.has(status)) throw new Error(`Unsupported OCR status: ${status}`);
  const normalizedPages = pages.map((page, pageOffset) => {
    const pageIndex = Math.max(0, Number(page.pageIndex ?? pageOffset) || 0);
    const regions = (page.regions || []).map((region, regionOffset) => ({
      regionId:String(
        region.regionId
        || `ocr_${assetId}_${pageIndex}_${regionOffset + 1}`,
      ),
      kind:REGION_KIND_SET.has(region.kind) ? region.kind : 'unknown',
      text:String(region.text || ''),
      confidence:Math.max(0, Math.min(1, finite(region.confidence))),
      box:normalizedBox(region.box),
      order:Math.max(0, Number(region.order ?? regionOffset) || 0),
      anchor:{
        format:'pdf',
        pageIndex,
        coordinateSpace:'source-page-pixels',
        quoteHash:region.quoteHash ? String(region.quoteHash) : null,
      },
    })).sort((left, right) => left.order - right.order);
    return {
      pageIndex,
      width:Math.max(1, finite(page.width, 1)),
      height:Math.max(1, finite(page.height, 1)),
      rotation:finite(page.rotation),
      language:page.language ? String(page.language) : null,
      confidence:Math.max(0, Math.min(1, finite(page.confidence))),
      text:String(page.text || regions.map((region) => region.text).join('\n')),
      regions,
    };
  }).sort((left, right) => left.pageIndex - right.pageIndex);
  return {
    schemaVersion:OCR_ARTIFACT_SCHEMA_VERSION,
    recordType:'books.ocr-artifact',
    workId:String(workId),
    assetId:String(assetId),
    sourceFingerprint:String(sourceFingerprint),
    status,
    pages:normalizedPages,
    engine:engine ? {
      route:String(engine.route || 'unknown'),
      provider:engine.provider ? String(engine.provider) : null,
      model:engine.model ? String(engine.model) : null,
      modelVersion:engine.modelVersion ? String(engine.modelVersion) : null,
      runtime:engine.runtime ? String(engine.runtime) : null,
      local:engine.local === true,
    } : null,
    error:error ? {
      code:String(error.code || 'ocr-failed'),
      message:String(error.message || error),
      retryable:error.retryable !== false,
    } : null,
    updatedAt:String(updatedAt),
  };
}

export function validateOcrArtifact(record) {
  const issues = [];
  if (record?.recordType !== 'books.ocr-artifact') {
    issues.push('invalid-record-type');
  }
  if (record?.schemaVersion !== OCR_ARTIFACT_SCHEMA_VERSION) {
    issues.push('unsupported-schema-version');
  }
  if (!record?.workId || !record?.assetId || !record?.sourceFingerprint) {
    issues.push('missing-source-identity');
  }
  if (!STATUS_SET.has(record?.status)) issues.push('invalid-status');
  const pageIndexes = new Set();
  for (const page of record?.pages || []) {
    if (pageIndexes.has(page.pageIndex)) issues.push('duplicate-page-index');
    pageIndexes.add(page.pageIndex);
    if (!(page.width > 0) || !(page.height > 0)) {
      issues.push('invalid-page-dimensions');
    }
    const regionIds = new Set();
    for (const region of page.regions || []) {
      if (!region.regionId || regionIds.has(region.regionId)) {
        issues.push('duplicate-or-missing-region-id');
      }
      regionIds.add(region.regionId);
      if (!REGION_KIND_SET.has(region.kind)) issues.push('invalid-region-kind');
      if (region.anchor?.pageIndex !== page.pageIndex) {
        issues.push('mismatched-page-anchor');
      }
      const box = region.box || {};
      if (
        box.x < 0
        || box.y < 0
        || box.width < 0
        || box.height < 0
        || box.x + box.width > page.width + 0.01
        || box.y + box.height > page.height + 0.01
      ) {
        issues.push('region-outside-page');
      }
    }
  }
  return Array.from(new Set(issues)).sort();
}

export function removableOcrPaths(record) {
  if (!record?.workId || !record?.assetId) return [];
  return [ocrArtifactPath(record.workId, record.assetId)];
}
