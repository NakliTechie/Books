import assert from 'node:assert/strict';
import {
  makeOcrArtifact,
  ocrArtifactPath,
  removableOcrPaths,
  validateOcrArtifact,
} from '../ocr-artifact.js';

const artifact = makeOcrArtifact({
  workId:'work-scan',
  assetId:'asset-scan',
  sourceFingerprint:'sha256:scan',
  status:'needs-review',
  engine:{
    route:'browser',
    provider:'PaddleOCR.js',
    model:'PP-OCRv5',
    modelVersion:'0.4.2',
    runtime:'onnxruntime-web',
    local:true,
  },
  pages:[{
    pageIndex:0,
    width:1000,
    height:1400,
    confidence:0.92,
    language:'en',
    regions:[{
      regionId:'region-heading',
      kind:'heading',
      text:'A scanned chapter',
      confidence:0.96,
      box:{ x:100, y:80, width:600, height:80 },
      quoteHash:'sha256:heading',
    }, {
      regionId:'region-table',
      kind:'table',
      text:'A | B',
      confidence:0.74,
      box:{ x:100, y:300, width:800, height:500 },
    }],
  }],
});

assert.equal(artifact.recordType, 'books.ocr-artifact');
assert.equal(artifact.pages[0].regions[0].anchor.pageIndex, 0);
assert.deepEqual(validateOcrArtifact(artifact), []);
assert.equal(
  ocrArtifactPath('work-scan', 'asset-scan'),
  'semantic/work-scan/ocr/asset-scan.json',
);
assert.deepEqual(removableOcrPaths(artifact), [
  'semantic/work-scan/ocr/asset-scan.json',
]);
assert.deepEqual(validateOcrArtifact({
  ...artifact,
  pages:[{
    ...artifact.pages[0],
    regions:[{
      ...artifact.pages[0].regions[0],
      box:{ x:999, y:0, width:100, height:10 },
    }],
  }],
}), ['region-outside-page']);

console.log('Books OCR artifact contract: PASS');
