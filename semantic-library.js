export const SEMANTIC_SCHEMA_VERSION = 1;
export const SEMANTIC_CATALOG_PATH = 'catalog/catalog.json';
export const SEMANTIC_WORKS_PREFIX = 'catalog/works/';
export const SEMANTIC_ANNOTATIONS_PREFIX = 'annotations/';
export const PORTABLE_BUNDLE_VERSION = 1;

const RECORD_TYPE = 'books.work';
const CATALOG_TYPE = 'books.catalog';
const ANNOTATIONS_TYPE = 'books.annotations';
const PORTABLE_BUNDLE_TYPE = 'books.portable-library';

function isoNow(now) {
  return typeof now === 'function' ? now() : new Date().toISOString();
}

function uuidFallback() {
  const time = Date.now().toString(36);
  const random = Math.random().toString(36).slice(2, 14);
  return time + '-' + random;
}

export function createRecordId(kind, randomUUID = globalThis.crypto?.randomUUID?.bind(globalThis.crypto)) {
  const value = randomUUID ? randomUUID() : uuidFallback();
  return String(kind) + '_' + String(value).toLowerCase();
}

export function legacyBookIdFor(filename) {
  return String(filename)
    .replace(/\.[a-z0-9]{2,5}$/i, '')
    .replace(/[^a-zA-Z0-9-]+/g, '_')
    .replace(/^_+|_+$/g, '') || 'book';
}

function extensionOf(filename) {
  const match = String(filename || '').match(/\.([a-z0-9]+)$/i);
  return match ? match[1].toLowerCase() : '';
}

function titleFromFilename(filename) {
  return String(filename || '').replace(/\.[a-z0-9]+$/i, '');
}

function authorRecords(author, source = 'legacy-sidecar') {
  const names = Array.isArray(author) ? author : [author];
  return names
    .map((value) => typeof value === 'string' ? value.trim() : '')
    .filter(Boolean)
    .map((name) => ({ name, source }));
}

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value));
}

function jsonEqual(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function manifestPath(workId) {
  return SEMANTIC_WORKS_PREFIX + workId + '.json';
}

export function makeWorkManifest({
  filename,
  sidecar = null,
  now = () => new Date().toISOString(),
  createId = createRecordId,
}) {
  const createdAt = isoNow(now);
  const workId = createId('work');
  const editionId = createId('edition');
  const assetId = createId('asset');
  const legacyBookId = sidecar?.bookId || legacyBookIdFor(filename);
  const title = sidecar?.title || titleFromFilename(filename);
  const format = extensionOf(filename);

  return {
    schemaVersion: SEMANTIC_SCHEMA_VERSION,
    recordType: RECORD_TYPE,
    workId,
    title,
    authors: authorRecords(sidecar?.author),
    metadataProvenance: {
      title: sidecar?.title ? 'legacy-sidecar' : 'filename',
      authors: sidecar?.author ? 'legacy-sidecar' : null,
    },
    userMetadata: {
      rating: null,
      tags: [],
      shelves: [],
    },
    editions: [{
      editionId,
      language: null,
      identifiers: {},
      assetIds: [assetId],
      createdAt,
      updatedAt: createdAt,
    }],
    assets: [{
      assetId,
      editionId,
      sourcePath: 'library/' + filename,
      sourceFilename: filename,
      format,
      byteLength: null,
      fingerprint: null,
      fingerprintStatus: 'pending',
      availability: 'available',
      importedAt: createdAt,
      updatedAt: createdAt,
    }],
    legacy: {
      bookIds: [legacyBookId],
      sourceFilenames: [filename],
      sidecarPath: sidecar?.bookId ? 'notes/' + sidecar.bookId + '.json' : null,
    },
    createdAt,
    updatedAt: createdAt,
  };
}

export function updateWorkMetadata(manifest, sidecar, now = () => new Date().toISOString()) {
  if (!manifest || !sidecar) return { manifest, changed: false };
  const next = cloneJson(manifest);
  let changed = false;
  const title = typeof sidecar.title === 'string' ? sidecar.title.trim() : '';
  const authors = authorRecords(sidecar.author);
  if (title && next.title !== title && next.metadataProvenance?.title !== 'user') {
    next.title = title;
    next.metadataProvenance = {
      ...(next.metadataProvenance || {}),
      title: 'legacy-sidecar',
    };
    changed = true;
  }
  if (
    authors.length
    && !jsonEqual(next.authors, authors)
    && next.metadataProvenance?.authors !== 'user'
  ) {
    next.authors = authors;
    next.metadataProvenance = {
      ...(next.metadataProvenance || {}),
      authors: 'legacy-sidecar',
    };
    changed = true;
  }
  const legacyBookId = sidecar.bookId;
  if (legacyBookId && !next.legacy.bookIds.includes(legacyBookId)) {
    next.legacy.bookIds.push(legacyBookId);
    next.legacy.bookIds.sort();
    changed = true;
  }
  const sidecarPath = legacyBookId ? 'notes/' + legacyBookId + '.json' : null;
  if (sidecarPath && next.legacy.sidecarPath !== sidecarPath) {
    next.legacy.sidecarPath = sidecarPath;
    changed = true;
  }
  if (changed) next.updatedAt = isoNow(now);
  return { manifest: next, changed };
}

export function updateWorkDetails(
  manifest,
  { title, authors, tags, shelves, rating },
  now = () => new Date().toISOString(),
) {
  if (!manifest) return { manifest, changed: false };
  const next = cloneJson(manifest);
  const normalizedTitle = typeof title === 'string' ? title.trim() : next.title;
  const normalizedAuthors = (Array.isArray(authors) ? authors : [authors])
    .map((value) => typeof value === 'string' ? value.trim() : '')
    .filter(Boolean)
    .map((name) => ({ name, source: 'user' }));
  const normalizeList = (value) => Array.from(new Set(
    (Array.isArray(value) ? value : [value])
      .map((item) => typeof item === 'string' ? item.trim() : '')
      .filter(Boolean),
  )).sort((left, right) => left.localeCompare(right));
  const normalizedTags = normalizeList(tags);
  const normalizedShelves = normalizeList(shelves);
  const normalizedRating = rating == null || rating === ''
    ? null : Math.max(0, Math.min(5, Number(rating)));

  if (normalizedTitle) next.title = normalizedTitle;
  next.authors = normalizedAuthors;
  next.metadataProvenance = {
    ...(next.metadataProvenance || {}),
    title: 'user',
    authors: 'user',
  };
  next.userMetadata = {
    ...(next.userMetadata || {}),
    tags: normalizedTags,
    shelves: normalizedShelves,
    rating: Number.isFinite(normalizedRating) ? normalizedRating : null,
  };
  const comparableBefore = {
    title: manifest.title,
    authors: manifest.authors || [],
    userMetadata: manifest.userMetadata || {},
    metadataProvenance: manifest.metadataProvenance || {},
  };
  const comparableAfter = {
    title: next.title,
    authors: next.authors,
    userMetadata: next.userMetadata,
    metadataProvenance: next.metadataProvenance,
  };
  if (jsonEqual(comparableBefore, comparableAfter)) {
    return { manifest, changed: false };
  }
  next.updatedAt = isoNow(now);
  return { manifest: next, changed: true };
}

export function updateAssetFingerprint(
  manifest,
  assetId,
  { fingerprint, byteLength },
  now = () => new Date().toISOString(),
) {
  const next = cloneJson(manifest);
  const asset = next.assets.find((candidate) => candidate.assetId === assetId);
  if (!asset) return { manifest, changed: false };
  const normalizedLength = Number.isFinite(Number(byteLength))
    ? Number(byteLength) : null;
  if (
    asset.fingerprint === fingerprint
    && asset.byteLength === normalizedLength
    && asset.fingerprintStatus === 'complete'
  ) return { manifest, changed: false };
  const updatedAt = isoNow(now);
  asset.fingerprint = fingerprint;
  asset.byteLength = normalizedLength;
  asset.fingerprintStatus = 'complete';
  asset.updatedAt = updatedAt;
  next.updatedAt = updatedAt;
  return { manifest: next, changed: true };
}

export async function sha256Fingerprint(value) {
  let buffer;
  if (value instanceof ArrayBuffer) buffer = value;
  else if (ArrayBuffer.isView(value)) {
    buffer = value.buffer.slice(value.byteOffset, value.byteOffset + value.byteLength);
  } else {
    throw new Error('A binary value is required for asset fingerprinting.');
  }
  const digest = await globalThis.crypto.subtle.digest('SHA-256', buffer);
  return 'sha256:' + Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, '0')).join('');
}

function normalizeManifest(manifest) {
  if (
    !manifest
    || manifest.schemaVersion !== SEMANTIC_SCHEMA_VERSION
    || manifest.recordType !== RECORD_TYPE
    || typeof manifest.workId !== 'string'
    || !manifest.workId
    || !Array.isArray(manifest.editions)
    || !Array.isArray(manifest.assets)
  ) return null;
  return cloneJson(manifest);
}

function catalogPayload(manifests) {
  const aliases = {
    legacyBookIds: {},
    sourceFilenames: {},
  };
  const works = manifests
    .map((manifest) => {
      const sourceFilenames = manifest.assets
        .filter((asset) => asset.availability !== 'removed')
        .map((asset) => asset.sourceFilename)
        .filter(Boolean)
        .sort();
      for (const filename of sourceFilenames) {
        aliases.sourceFilenames[filename] = manifest.workId;
      }
      for (const bookId of manifest.legacy?.bookIds || []) {
        aliases.legacyBookIds[bookId] = manifest.workId;
      }
      return {
        workId: manifest.workId,
        title: manifest.title,
        authors: cloneJson(manifest.authors || []),
        sourceFilenames,
        assetCount: manifest.assets.filter((asset) => asset.availability !== 'removed').length,
        availableAssetCount: manifest.assets.filter((asset) => asset.availability === 'available').length,
        tags: cloneJson(manifest.userMetadata?.tags || []),
        shelves: cloneJson(manifest.userMetadata?.shelves || []),
        manifestPath: manifestPath(manifest.workId),
        updatedAt: manifest.updatedAt,
      };
    })
    .sort((left, right) => left.workId.localeCompare(right.workId));
  return { works, aliases };
}

export function rebuildCatalog(
  manifests,
  existingCatalog = null,
  now = () => new Date().toISOString(),
) {
  const payload = catalogPayload(manifests);
  const existingPayload = existingCatalog && {
    works: existingCatalog.works,
    aliases: existingCatalog.aliases,
  };
  const changed = (
    !existingCatalog
    || existingCatalog.schemaVersion !== SEMANTIC_SCHEMA_VERSION
    || existingCatalog.recordType !== CATALOG_TYPE
    || !jsonEqual(existingPayload, payload)
  );
  if (!changed) return { catalog: cloneJson(existingCatalog), changed: false };
  return {
    catalog: {
      schemaVersion: SEMANTIC_SCHEMA_VERSION,
      recordType: CATALOG_TYPE,
      revision: Math.max(0, Number(existingCatalog?.revision) || 0) + 1,
      works: payload.works,
      aliases: payload.aliases,
      updatedAt: isoNow(now),
    },
    changed: true,
  };
}

function normalizedGroupingText(value) {
  return String(value || '')
    .normalize('NFKC')
    .toLocaleLowerCase()
    .replace(/[\p{P}\p{S}]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function groupingKeyFor(manifest) {
  const title = normalizedGroupingText(manifest?.title);
  const authors = (manifest?.authors || [])
    .map((author) => normalizedGroupingText(author?.name))
    .filter(Boolean)
    .sort();
  return {
    title,
    authors,
    key: title + '\n' + authors.join('|'),
  };
}

export function validateSemanticLibrary({
  sourceFilenames = [],
  manifests = [],
  catalog = null,
  annotations = [],
} = {}) {
  const errors = [];
  const warnings = [];
  const validManifests = [];
  const workIds = new Set();
  const assetIds = new Set();
  const claimedSources = new Map();
  const sourceSet = new Set(
    sourceFilenames.filter((filename) => typeof filename === 'string' && filename),
  );

  manifests.forEach((candidate, index) => {
    const manifest = normalizeManifest(candidate);
    if (!manifest) {
      errors.push({
        code: 'invalid-work-manifest',
        message: 'Work manifest ' + (index + 1) + ' is invalid or uses an unsupported schema.',
      });
      return;
    }
    validManifests.push(manifest);
    if (workIds.has(manifest.workId)) {
      errors.push({
        code: 'duplicate-work-id',
        workId: manifest.workId,
        message: 'Work id ' + manifest.workId + ' appears more than once.',
      });
    }
    workIds.add(manifest.workId);
    for (const asset of manifest.assets) {
      if (!asset?.assetId) {
        errors.push({
          code: 'missing-asset-id',
          workId: manifest.workId,
          message: 'A source asset in ' + manifest.title + ' has no identity.',
        });
      } else if (assetIds.has(asset.assetId)) {
        errors.push({
          code: 'duplicate-asset-id',
          assetId: asset.assetId,
          message: 'Asset id ' + asset.assetId + ' appears more than once.',
        });
      }
      if (asset?.assetId) assetIds.add(asset.assetId);
      if (!asset?.sourceFilename) continue;
      const claims = claimedSources.get(asset.sourceFilename) || [];
      claims.push(manifest.workId);
      claimedSources.set(asset.sourceFilename, claims);
    }
  });

  for (const [filename, claims] of claimedSources) {
    if (claims.length > 1) {
      errors.push({
        code: 'source-claimed-by-multiple-works',
        filename,
        workIds: claims,
        message: filename + ' is claimed by multiple works.',
      });
    }
    if (!sourceSet.has(filename)) {
      warnings.push({
        code: 'missing-source',
        filename,
        workId: claims[0],
        message: filename + ' is represented in portable metadata but its original is missing.',
      });
    }
  }
  for (const filename of sourceSet) {
    if (!claimedSources.has(filename)) {
      warnings.push({
        code: 'untracked-source',
        filename,
        message: filename + ' has no portable work manifest yet.',
      });
    }
  }

  for (const record of annotations) {
    if (!record || record.recordType !== ANNOTATIONS_TYPE || !record.workId) {
      errors.push({
        code: 'invalid-annotations-record',
        message: 'A portable annotations record is invalid.',
      });
    } else if (!workIds.has(record.workId)) {
      warnings.push({
        code: 'orphan-annotations',
        workId: record.workId,
        message: 'Annotations for ' + record.workId + ' have no matching work manifest.',
      });
    }
  }

  const fingerprintGroups = new Map();
  for (const manifest of validManifests) {
    for (const asset of manifest.assets) {
      if (!asset?.fingerprint || asset.fingerprintStatus !== 'complete') continue;
      const rows = fingerprintGroups.get(asset.fingerprint) || [];
      rows.push({
        workId: manifest.workId,
        title: manifest.title,
        assetId: asset.assetId,
        filename: asset.sourceFilename,
      });
      fingerprintGroups.set(asset.fingerprint, rows);
    }
  }
  const exactDuplicates = Array.from(fingerprintGroups, ([fingerprint, assets]) => ({
    fingerprint,
    assets,
  })).filter((group) => group.assets.length > 1);
  for (const duplicate of exactDuplicates) {
    warnings.push({
      code: 'exact-duplicate-assets',
      fingerprint: duplicate.fingerprint,
      message: duplicate.assets.map((asset) => asset.filename).join(', ') +
        ' contain identical source bytes.',
    });
  }

  const groupingCandidates = new Map();
  for (const manifest of validManifests) {
    const grouping = groupingKeyFor(manifest);
    if (!grouping.title) continue;
    const rows = groupingCandidates.get(grouping.key) || [];
    rows.push({
      workId: manifest.workId,
      title: manifest.title,
      authors: (manifest.authors || []).map((author) => author.name),
      formats: Array.from(new Set(
        manifest.assets.map((asset) => asset.format).filter(Boolean),
      )).sort(),
    });
    groupingCandidates.set(grouping.key, rows);
  }
  const groupingSuggestions = Array.from(groupingCandidates.values())
    .filter((works) => works.length > 1)
    .map((works) => ({
      confidence: works.every((work) => work.authors.length) ? 'likely' : 'possible',
      reason: works.every((work) => work.authors.length)
        ? 'matching normalized title and authors'
        : 'matching normalized title; author evidence is incomplete',
      works,
    }));

  const rebuilt = rebuildCatalog(
    validManifests,
    catalog,
    () => catalog?.updatedAt || new Date(0).toISOString(),
  );
  if (rebuilt.changed) {
    warnings.push({
      code: 'catalog-needs-rebuild',
      message: 'The rebuildable catalog does not match the canonical work manifests.',
    });
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    exactDuplicates,
    groupingSuggestions,
    catalogNeedsRebuild: rebuilt.changed,
    rebuiltCatalog: rebuilt.catalog,
    summary: {
      sources: sourceSet.size,
      works: validManifests.length,
      assets: validManifests.reduce((sum, manifest) => sum + manifest.assets.length, 0),
      annotationRecords: annotations.length,
    },
  };
}

function safeBundleFilename(value) {
  return typeof value === 'string'
    && value.length > 0
    && value.length <= 500
    && !value.includes('/')
    && !value.includes('\\')
    && value !== '.'
    && value !== '..';
}

export function createPortableBundle({
  manifests = [],
  annotations = [],
  legacySidecars = [],
  assets = [],
  libraryLabel = null,
  now = () => new Date().toISOString(),
} = {}) {
  return {
    bundleVersion: PORTABLE_BUNDLE_VERSION,
    recordType: PORTABLE_BUNDLE_TYPE,
    semanticSchemaVersion: SEMANTIC_SCHEMA_VERSION,
    exportedAt: isoNow(now),
    libraryLabel: libraryLabel ? String(libraryLabel) : null,
    assets: cloneJson(assets),
    records: {
      works: cloneJson(manifests),
      annotations: cloneJson(annotations),
      legacySidecars: cloneJson(legacySidecars),
    },
    omittedRebuildableData: [
      'catalog/catalog.json',
      'passages/',
      'indexes/',
      'semantics/',
      'processing/',
      'covers/',
    ],
  };
}

export function validatePortableBundle(bundle) {
  const errors = [];
  const warnings = [];
  if (!bundle || bundle.recordType !== PORTABLE_BUNDLE_TYPE) {
    errors.push({
      code: 'invalid-bundle-type',
      message: 'This is not a Books portable-library bundle.',
    });
  }
  if (bundle?.bundleVersion !== PORTABLE_BUNDLE_VERSION) {
    errors.push({
      code: 'unsupported-bundle-version',
      message: 'Bundle version ' + String(bundle?.bundleVersion) + ' is not supported.',
    });
  }
  if (bundle?.semanticSchemaVersion > SEMANTIC_SCHEMA_VERSION) {
    errors.push({
      code: 'future-semantic-schema',
      message: 'This bundle uses a newer semantic-library schema.',
    });
  }

  const works = Array.isArray(bundle?.records?.works) ? bundle.records.works : [];
  const annotations = Array.isArray(bundle?.records?.annotations)
    ? bundle.records.annotations : [];
  const legacySidecars = Array.isArray(bundle?.records?.legacySidecars)
    ? bundle.records.legacySidecars : [];
  const assets = Array.isArray(bundle?.assets) ? bundle.assets : [];
  if (!Array.isArray(bundle?.records?.works)) {
    errors.push({ code: 'missing-work-records', message: 'The bundle has no work-record list.' });
  }
  if (!Array.isArray(bundle?.assets)) {
    errors.push({ code: 'missing-assets', message: 'The bundle has no source-asset list.' });
  }

  const filenames = new Set();
  for (const asset of assets) {
    if (!safeBundleFilename(asset?.filename)) {
      errors.push({
        code: 'unsafe-asset-filename',
        message: 'A bundled source has an unsafe filename.',
      });
      continue;
    }
    if (filenames.has(asset.filename)) {
      errors.push({
        code: 'duplicate-bundle-filename',
        filename: asset.filename,
        message: asset.filename + ' appears more than once in the bundle.',
      });
    }
    filenames.add(asset.filename);
    if (typeof asset.dataBase64 !== 'string' || !asset.dataBase64) {
      errors.push({
        code: 'missing-asset-data',
        filename: asset.filename,
        message: asset.filename + ' has no encoded original bytes.',
      });
    }
  }
  for (const sidecar of legacySidecars) {
    if (
      !sidecar
      || !safeBundleFilename(sidecar.sourceFilename)
      || typeof sidecar.bookId !== 'string'
      || !/^[a-zA-Z0-9_-]{1,240}$/.test(sidecar.bookId)
    ) {
      errors.push({
        code: 'unsafe-legacy-sidecar',
        message: 'A legacy reading-data record has an unsafe identity.',
      });
    }
  }

  const libraryValidation = validateSemanticLibrary({
    sourceFilenames: Array.from(filenames),
    manifests: works,
    annotations,
  });
  errors.push(...libraryValidation.errors);
  warnings.push(
    ...libraryValidation.warnings.filter(
      (warning) => warning.code !== 'catalog-needs-rebuild',
    ),
  );
  return {
    valid: errors.length === 0,
    errors,
    warnings,
    summary: {
      works: works.length,
      assets: assets.length,
      annotationRecords: annotations.length,
      legacySidecars: legacySidecars.length,
    },
  };
}

export function reconcileSemanticLibrary({
  sourceFilenames = [],
  sidecars = [],
  existingManifests = [],
  existingCatalog = null,
  now = () => new Date().toISOString(),
  createId = createRecordId,
} = {}) {
  const availableSources = new Set(
    sourceFilenames.filter((value) => typeof value === 'string' && value),
  );
  const sidecarByFilename = new Map(
    sidecars
      .filter((sidecar) => sidecar && typeof sidecar.sourceFilename === 'string')
      .map((sidecar) => [sidecar.sourceFilename, sidecar]),
  );
  const manifests = existingManifests
    .map(normalizeManifest)
    .filter(Boolean);
  const changedWorkIds = new Set();
  const assetByFilename = new Map();

  for (const manifest of manifests) {
    for (const asset of manifest.assets) {
      if (asset?.sourceFilename && !assetByFilename.has(asset.sourceFilename)) {
        assetByFilename.set(asset.sourceFilename, { manifest, asset });
      }
    }
  }

  for (const filename of availableSources) {
    const known = assetByFilename.get(filename);
    if (!known) {
      const manifest = makeWorkManifest({
        filename,
        sidecar: sidecarByFilename.get(filename) || null,
        now,
        createId,
      });
      manifests.push(manifest);
      changedWorkIds.add(manifest.workId);
      assetByFilename.set(filename, { manifest, asset: manifest.assets[0] });
      continue;
    }
    if (known.asset.availability !== 'available') {
      known.asset.availability = 'available';
      known.asset.updatedAt = isoNow(now);
      known.manifest.updatedAt = known.asset.updatedAt;
      changedWorkIds.add(known.manifest.workId);
    }
    const metadataUpdate = updateWorkMetadata(
      known.manifest,
      sidecarByFilename.get(filename),
      now,
    );
    if (metadataUpdate.changed) {
      const index = manifests.indexOf(known.manifest);
      manifests[index] = metadataUpdate.manifest;
      changedWorkIds.add(metadataUpdate.manifest.workId);
      for (const asset of metadataUpdate.manifest.assets) {
        if (asset?.sourceFilename) {
          assetByFilename.set(asset.sourceFilename, {
            manifest: metadataUpdate.manifest,
            asset,
          });
        }
      }
    }
  }

  for (const manifest of manifests) {
    for (const asset of manifest.assets) {
      if (
        asset.availability !== 'removed'
        && !availableSources.has(asset.sourceFilename)
        && asset.availability !== 'missing'
      ) {
        asset.availability = 'missing';
        asset.updatedAt = isoNow(now);
        manifest.updatedAt = asset.updatedAt;
        changedWorkIds.add(manifest.workId);
      }
    }
  }

  const catalogResult = rebuildCatalog(manifests, existingCatalog, now);
  return {
    manifests,
    catalog: catalogResult.catalog,
    changedManifests: manifests.filter((manifest) => changedWorkIds.has(manifest.workId)),
    catalogChanged: catalogResult.changed,
  };
}

export function workForFilename(catalog, filename) {
  const workId = catalog?.aliases?.sourceFilenames?.[filename];
  if (!workId) return null;
  return catalog.works.find((work) => work.workId === workId) || null;
}

export function semanticManifestPath(workId) {
  return manifestPath(workId);
}

export function semanticAnnotationsPath(workId) {
  return SEMANTIC_ANNOTATIONS_PREFIX + workId + '.json';
}

export function addPortableAnnotation(
  record,
  {
    workId,
    kind = 'highlight',
    label = '',
    body = '',
    color = 'yellow',
    target,
    conceptIds = [],
  },
  now = () => new Date().toISOString(),
  createId = createRecordId,
) {
  if (!workId || !target) throw new Error('A work and target are required for an annotation.');
  const timestamp = isoNow(now);
  const base = (
    record
    && record.schemaVersion === SEMANTIC_SCHEMA_VERSION
    && record.recordType === ANNOTATIONS_TYPE
    && record.workId === workId
  ) ? cloneJson(record) : {
    schemaVersion: SEMANTIC_SCHEMA_VERSION,
    recordType: ANNOTATIONS_TYPE,
    workId,
    revision: 0,
    annotations: [],
    positions: [],
    preferences: [],
    legacy: { bookIds: [] },
  };
  const annotation = {
    annotationId: createId('annotation'),
    kind,
    label:String(label || ''),
    body:String(body || ''),
    color:String(color || 'yellow'),
    target:cloneJson(target),
    conceptIds:Array.from(new Set(conceptIds.filter(Boolean))),
    createdAt:timestamp,
    updatedAt:timestamp,
    deletedAt:null,
  };
  base.annotations.push(annotation);
  base.revision = Math.max(0, Number(base.revision) || 0) + 1;
  base.updatedAt = timestamp;
  return { record:base, annotation };
}

export function updatePortableAnnotation(
  record,
  annotationId,
  changes,
  now = () => new Date().toISOString(),
) {
  if (!record?.annotations) return { record, changed:false };
  const next = cloneJson(record);
  const annotation = next.annotations.find((item) => item.annotationId === annotationId);
  if (!annotation) return { record, changed:false };
  const allowed = ['label', 'body', 'color', 'conceptIds'];
  let changed = false;
  for (const key of allowed) {
    if (!(key in changes)) continue;
    const value = key === 'conceptIds'
      ? Array.from(new Set((changes[key] || []).filter(Boolean)))
      : String(changes[key] ?? '');
    if (!jsonEqual(annotation[key], value)) {
      annotation[key] = value;
      changed = true;
    }
  }
  if (!changed) return { record, changed:false };
  annotation.updatedAt = isoNow(now);
  next.revision = Math.max(0, Number(next.revision) || 0) + 1;
  next.updatedAt = annotation.updatedAt;
  return { record:next, changed:true };
}

export function tombstonePortableAnnotation(
  record,
  annotationId,
  now = () => new Date().toISOString(),
) {
  if (!record?.annotations) return { record, changed:false };
  const next = cloneJson(record);
  const annotation = next.annotations.find((item) => item.annotationId === annotationId);
  if (!annotation || annotation.deletedAt) return { record, changed:false };
  const timestamp = isoNow(now);
  annotation.deletedAt = timestamp;
  annotation.updatedAt = timestamp;
  next.revision = Math.max(0, Number(next.revision) || 0) + 1;
  next.updatedAt = timestamp;
  return { record:next, changed:true };
}

function normalizeAnchorText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim().toLocaleLowerCase();
}

export function reanchorPortableAnnotations(
  record,
  passages,
  now = () => new Date().toISOString(),
) {
  if (!record?.annotations || !Array.isArray(passages)) {
    return { record, changed:false, unresolved:[] };
  }
  const next = cloneJson(record);
  let changed = false;
  const unresolved = [];
  const passageById = new Map(passages.map((passage) => [passage.passageId, passage]));
  for (const annotation of next.annotations) {
    if (annotation.deletedAt || annotation.kind !== 'highlight' || !annotation.target?.exact) {
      continue;
    }
    const needle = normalizeAnchorText(annotation.target.exact);
    const current = passageById.get(annotation.target.passageId);
    if (current && normalizeAnchorText(current.text).includes(needle)) {
      if (annotation.anchorState !== 'resolved') {
        annotation.anchorState = 'resolved';
        changed = true;
      }
      continue;
    }
    const candidates = passages.filter((passage) =>
      normalizeAnchorText(passage.text).includes(needle));
    if (candidates.length === 1) {
      const previousPassageId = annotation.target.passageId || null;
      annotation.target.passageId = candidates[0].passageId;
      annotation.target.passageQuoteHash = candidates[0].anchor?.quoteHash || null;
      annotation.anchorState = 'resolved';
      annotation.anchorHistory = (annotation.anchorHistory || []).concat([{
        previousPassageId,
        passageId:candidates[0].passageId,
        reanchoredAt:isoNow(now),
      }]);
      annotation.updatedAt = annotation.anchorHistory.at(-1).reanchoredAt;
      changed = true;
    } else {
      if (annotation.anchorState !== 'unresolved') {
        annotation.anchorState = 'unresolved';
        annotation.updatedAt = isoNow(now);
        changed = true;
      }
      unresolved.push(annotation.annotationId);
    }
  }
  if (!changed) return { record, changed:false, unresolved };
  next.revision = Math.max(0, Number(next.revision) || 0) + 1;
  next.updatedAt = isoNow(now);
  return { record:next, changed:true, unresolved };
}

function legacySourceKey(bookId, kind, sourceId) {
  return [bookId, kind, sourceId || 'default'].join(':');
}

function portableTarget(asset, engine, position) {
  return {
    assetId: asset?.assetId || null,
    sourceFilename: asset?.sourceFilename || null,
    selectors: [{
      type: 'legacy-engine-position',
      engine: engine || asset?.format || null,
      value: cloneJson(position || {}),
    }],
  };
}

function upsertLegacyRecord({
  existingByKey,
  key,
  kind,
  createId,
  createdAt,
  bookId,
  fields,
}) {
  const existing = existingByKey.get(key);
  return {
    ...(existing || {}),
    annotationId: existing?.annotationId || createId('annotation'),
    kind,
    ...fields,
    legacySource: { key, bookId },
    createdAt: existing?.createdAt || createdAt,
    updatedAt: fields.updatedAt || existing?.updatedAt || createdAt,
  };
}

export function reconcileLegacyAnnotations({
  manifest,
  sidecars = [],
  existingRecord = null,
  now = () => new Date().toISOString(),
  createId = createRecordId,
} = {}) {
  if (!manifest?.workId) {
    throw new Error('A valid work manifest is required to migrate annotations.');
  }
  const existing = (
    existingRecord
    && existingRecord.schemaVersion === SEMANTIC_SCHEMA_VERSION
    && existingRecord.recordType === ANNOTATIONS_TYPE
    && existingRecord.workId === manifest.workId
  ) ? cloneJson(existingRecord) : null;
  const existingLegacy = new Map(
    (existing?.annotations || [])
      .filter((record) => record?.legacySource?.key)
      .map((record) => [record.legacySource.key, record]),
  );
  const incomingBookIds = new Set(
    sidecars
      .filter((sidecar) => sidecar?.sourceFilename)
      .map((sidecar) => sidecar.bookId || legacyBookIdFor(sidecar.sourceFilename)),
  );
  const untouchedAnnotations = (existing?.annotations || [])
    .filter((record) => (
      !record?.legacySource?.key
      || !incomingBookIds.has(record.legacySource.bookId)
    ));
  const untouchedPositions = (existing?.positions || [])
    .filter((record) => !incomingBookIds.has(record?.legacySource?.bookId));
  const untouchedPreferences = (existing?.preferences || [])
    .filter((record) => !incomingBookIds.has(record?.legacySource?.bookId));
  const migrated = [];
  const positions = [];
  const preferences = [];
  const migrationTime = isoNow(now);

  for (const sidecar of sidecars) {
    if (!sidecar || typeof sidecar.sourceFilename !== 'string') continue;
    const asset = manifest.assets.find(
      (candidate) => candidate.sourceFilename === sidecar.sourceFilename,
    );
    if (!asset) continue;
    const bookId = sidecar.bookId || legacyBookIdFor(sidecar.sourceFilename);
    const engine = sidecar.engine || asset.format || null;

    if (sidecar.position && typeof sidecar.position === 'object') {
      positions.push({
        positionId: 'position_' + asset.assetId,
        assetId: asset.assetId,
        target: portableTarget(asset, engine, sidecar.position),
        lastOpened: sidecar.lastOpened || null,
        legacySource: {
          key: legacySourceKey(bookId, 'position', asset.assetId),
          bookId,
        },
      });
    }

    if (sidecar.readerPrefs && typeof sidecar.readerPrefs === 'object') {
      preferences.push({
        assetId: asset.assetId,
        values: cloneJson(sidecar.readerPrefs),
        legacySource: {
          key: legacySourceKey(bookId, 'preferences', asset.assetId),
          bookId,
        },
      });
    }

    const bookmarks = Array.isArray(sidecar.bookmarks) ? sidecar.bookmarks : [];
    for (let index = 0; index < bookmarks.length; index++) {
      const bookmark = bookmarks[index] || {};
      const sourceId = bookmark.id || String(index);
      const key = legacySourceKey(bookId, 'bookmark', sourceId);
      migrated.push(upsertLegacyRecord({
        existingByKey: existingLegacy,
        key,
        kind: 'bookmark',
        createId,
        createdAt: bookmark.ts || migrationTime,
        bookId,
        fields: {
          label: typeof bookmark.label === 'string' ? bookmark.label : '',
          body: '',
          target: portableTarget(asset, engine, bookmark.position),
          updatedAt: bookmark.ts || migrationTime,
        },
      }));
    }

    if (typeof sidecar.note === 'string' && sidecar.note.trim()) {
      const key = legacySourceKey(bookId, 'book-note', asset.assetId);
      migrated.push(upsertLegacyRecord({
        existingByKey: existingLegacy,
        key,
        kind: 'note',
        createId,
        createdAt: migrationTime,
        bookId,
        fields: {
          label: 'Book note',
          body: sidecar.note,
          target: {
            assetId: asset.assetId,
            sourceFilename: asset.sourceFilename,
            selectors: [{ type: 'whole-work' }],
          },
        },
      }));
    }
  }

  const annotations = untouchedAnnotations
    .concat(migrated)
    .sort((left, right) => left.annotationId.localeCompare(right.annotationId));
  positions.push(...untouchedPositions);
  preferences.push(...untouchedPreferences);
  positions.sort((left, right) => left.assetId.localeCompare(right.assetId));
  preferences.sort((left, right) => left.assetId.localeCompare(right.assetId));
  const payload = {
    annotations,
    positions,
    preferences,
    legacy: {
      bookIds: Array.from(new Set(
        (existing?.legacy?.bookIds || []).concat(
          sidecars
            .filter((sidecar) => sidecar?.sourceFilename)
            .map((sidecar) => sidecar.bookId || legacyBookIdFor(sidecar.sourceFilename)),
        ),
      )).sort(),
    },
  };
  const existingPayload = existing && {
    annotations: existing.annotations || [],
    positions: existing.positions || [],
    preferences: existing.preferences || [],
    legacy: existing.legacy || { bookIds: [] },
  };
  if (existing && jsonEqual(existingPayload, payload)) {
    return { record: existing, changed: false };
  }
  return {
    record: {
      schemaVersion: SEMANTIC_SCHEMA_VERSION,
      recordType: ANNOTATIONS_TYPE,
      workId: manifest.workId,
      revision: Math.max(0, Number(existing?.revision) || 0) + 1,
      ...payload,
      updatedAt: migrationTime,
    },
    changed: true,
  };
}
