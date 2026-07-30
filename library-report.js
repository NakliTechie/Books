const CORE_STAGES = [
  'fingerprint',
  'passages',
  'lexicalIndex',
  'deterministicSemantics',
];

const FAILURE_STATUSES = new Set([
  'failed',
  'cancelled',
]);

const WAITING_STATUSES = new Set([
  'blocked',
  'blocked-by-embeddings',
  'pending',
  'queued',
  'waiting-for-model',
  'waiting-for-ocr',
  'waiting-for-provider',
  'waiting-for-stable-source',
]);

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function countBy(values, key) {
  const result = {};
  for (const value of values) {
    const name = typeof key === 'function' ? key(value) : value?.[key];
    const label = String(name || 'unknown');
    result[label] = (result[label] || 0) + 1;
  }
  return Object.fromEntries(
    Object.entries(result).sort(([left], [right]) => left.localeCompare(right)),
  );
}

function stageStatus(run, name) {
  return String(run?.stages?.[name]?.status || 'missing');
}

export function processingOutcome(run) {
  if (!run) return 'not-queued';
  if (run.cancelRequested) return 'cancelled';
  const statuses = Object.values(run.stages || {})
    .map((stage) => String(stage?.status || 'pending'));
  if (statuses.some((status) => FAILURE_STATUSES.has(status))) return 'failed';
  if (statuses.includes('waiting-for-ocr')) return 'waiting-for-ocr';
  if (statuses.includes('waiting-for-stable-source')) {
    return 'waiting-for-stable-source';
  }
  if (statuses.includes('running')) return 'running';
  if (CORE_STAGES.every((stage) => stageStatus(run, stage) === 'complete')) {
    return 'core-complete';
  }
  if (statuses.some((status) => WAITING_STATUSES.has(status))) return 'queued';
  return 'incomplete';
}

export function buildLibraryReport({
  library = null,
  inventory = null,
  catalog = null,
  manifests = [],
  jobs = [],
  passages = [],
  semantics = [],
  ideas = [],
  graph = null,
  generatedAt = new Date().toISOString(),
} = {}) {
  const manifestById = new Map(
    asArray(manifests).map((record) => [record.workId, record]),
  );
  const jobById = new Map(asArray(jobs).map((record) => [record.workId, record]));
  const passageById = new Map(
    asArray(passages).map((record) => [record.workId, record]),
  );
  const semanticById = new Map(
    asArray(semantics).map((record) => [record.workId, record]),
  );
  const ideaById = new Map(asArray(ideas).map((record) => [record.workId, record]));
  const links = asArray(graph?.links);
  const linkCountByWork = new Map();
  for (const link of links) {
    for (const workId of new Set([link.leftWorkId, link.rightWorkId])) {
      if (!workId) continue;
      linkCountByWork.set(workId, (linkCountByWork.get(workId) || 0) + 1);
    }
  }

  const catalogWorks = asArray(catalog?.works);
  const knownWorkIds = new Set([
    ...catalogWorks.map((work) => work.workId),
    ...manifestById.keys(),
    ...jobById.keys(),
  ]);
  const catalogById = new Map(catalogWorks.map((work) => [work.workId, work]));
  const issues = [];
  const works = Array.from(knownWorkIds, (workId) => {
    const manifest = manifestById.get(workId);
    const projection = catalogById.get(workId);
    const run = jobById.get(workId);
    const assetRows = asArray(manifest?.assets);
    const availableAssets = assetRows.filter(
      (asset) => asset.availability === 'available',
    );
    const missingAssets = assetRows.filter(
      (asset) => asset.availability === 'missing',
    );
    const workIssues = [];
    if (!manifest) workIssues.push('missing-work-manifest');
    if (!projection) workIssues.push('missing-catalog-projection');
    if (!availableAssets.length) workIssues.push('no-available-source');
    if (missingAssets.length) workIssues.push('missing-source');
    if (!run) workIssues.push('not-queued');
    if (run?.error) workIssues.push('processing-error');
    const outcome = processingOutcome(run);
    if (outcome === 'failed') workIssues.push('processing-failed');
    if (outcome === 'waiting-for-ocr') workIssues.push('ocr-required');
    if (outcome === 'waiting-for-stable-source') {
      workIssues.push('unstable-source');
    }
    for (const code of workIssues) {
      issues.push({ code, workId, title:manifest?.title || projection?.title || workId });
    }
    const passageRecord = passageById.get(workId);
    const semanticRecord = semanticById.get(workId);
    const ideaRecord = ideaById.get(workId);
    return {
      workId,
      title:manifest?.title || projection?.title || 'Untitled',
      formats:Array.from(new Set(
        assetRows.map((asset) => asset.format).filter(Boolean),
      )).sort(),
      sourceFilenames:assetRows
        .map((asset) => asset.sourceFilename)
        .filter(Boolean)
        .sort(),
      availableAssetCount:availableAssets.length,
      missingAssetCount:missingAssets.length,
      processing: {
        outcome,
        executorClass:run?.executorClass || null,
        updatedAt:run?.updatedAt || null,
        error:run?.error || null,
        stages:Object.fromEntries(
          Object.entries(run?.stages || {}).map(([name, stage]) => [
            name,
            {
              status:stage?.status || 'pending',
              attempts:Number(stage?.attempts) || 0,
              error:stage?.error || null,
              provider:stage?.provider || null,
              model:stage?.model || null,
            },
          ]),
        ),
      },
      passageCount:asArray(passageRecord?.passages).length
        || Number(run?.stages?.passages?.passageCount) || 0,
      conceptCount:asArray(semanticRecord?.concepts).length
        || Number(run?.stages?.deterministicSemantics?.conceptCount) || 0,
      sceneCount:asArray(semanticRecord?.scenes).length
        || Number(run?.stages?.deterministicSemantics?.sceneCount) || 0,
      ideaCount:asArray(ideaRecord?.ideas).length,
      relationshipCount:linkCountByWork.get(workId) || 0,
      issues:Array.from(new Set(workIssues)).sort(),
    };
  }).sort((left, right) =>
    left.title.localeCompare(right.title) || left.workId.localeCompare(right.workId));

  for (const collision of asArray(inventory?.collisions)) {
    issues.push({
      code:'path-collision',
      collisionKey:collision.collisionKey,
      paths:collision.paths,
    });
  }
  if (inventory && inventory.completed !== true) {
    issues.push({ code:'incomplete-inventory-generation' });
  }

  return {
    schemaVersion:1,
    recordType:'books.library-report',
    generatedAt,
    library:library ? {
      libraryId:library.libraryId || null,
      rootName:library.rootName || null,
      schemaVersion:library.schemaVersion || null,
    } : null,
    inventory:inventory ? {
      generation:Number(inventory.generation) || 0,
      scannedAt:inventory.scannedAt || null,
      completed:inventory.completed === true,
      counts:inventory.counts || {},
      collisionCount:asArray(inventory.collisions).length,
    } : null,
    totals: {
      works:works.length,
      availableWorks:works.filter((work) => work.availableAssetCount > 0).length,
      missingWorks:works.filter((work) => work.availableAssetCount === 0).length,
      passages:works.reduce((sum, work) => sum + work.passageCount, 0),
      concepts:works.reduce((sum, work) => sum + work.conceptCount, 0),
      scenes:works.reduce((sum, work) => sum + work.sceneCount, 0),
      ideas:works.reduce((sum, work) => sum + work.ideaCount, 0),
      relationships:links.length,
      issues:issues.length,
    },
    processingOutcomes:countBy(works, (work) => work.processing.outcome),
    issueCounts:countBy(issues, 'code'),
    works,
    issues:issues.sort((left, right) =>
      String(left.code).localeCompare(String(right.code))
        || String(left.title || '').localeCompare(String(right.title || ''))),
  };
}

export function formatLibraryReport(report) {
  const lines = [
    '# Books library report',
    '',
    `Generated: ${report.generatedAt}`,
    report.library?.rootName
      ? `Library: ${report.library.rootName} (${report.library.libraryId || 'no id'})`
      : 'Library: unknown',
    '',
    '## Summary',
    '',
    `- Works: ${report.totals.works} (${report.totals.availableWorks} with an available source)`,
    `- Passages: ${report.totals.passages}`,
    `- Concepts / scenes / ideas: ${report.totals.concepts} / ${report.totals.scenes} / ${report.totals.ideas}`,
    `- Cross-book relationships: ${report.totals.relationships}`,
    `- Issues: ${report.totals.issues}`,
    '',
    '## Processing',
    '',
  ];
  for (const [outcome, count] of Object.entries(report.processingOutcomes)) {
    lines.push(`- ${outcome}: ${count}`);
  }
  lines.push('', '## Works', '');
  for (const work of report.works) {
    const issueSuffix = work.issues.length
      ? ` · issues: ${work.issues.join(', ')}`
      : '';
    lines.push(
      `- ${work.title} — ${work.processing.outcome} · ` +
      `${work.passageCount} passages · ${work.ideaCount} ideas · ` +
      `${work.relationshipCount} relationships${issueSuffix}`,
    );
  }
  if (report.issues.length) {
    lines.push('', '## Issue counts', '');
    for (const [code, count] of Object.entries(report.issueCounts)) {
      lines.push(`- ${code}: ${count}`);
    }
  }
  return lines.join('\n') + '\n';
}
