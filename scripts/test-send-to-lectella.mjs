import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  lectellaAcceptsImport,
  lectellaExportSlug,
  lectellaSendPlan,
  passageExportPath,
  passageMarkdownExport,
  workMarkdownExport,
} from '../library-report.js';

// PDF, Markdown and text go as the source file itself.
for (const backendId of ['fsa', 'crate']) {
  assert.deepEqual(lectellaSendPlan({ filename:'Paper.PDF', backendId }),
    { mode:'direct', format:'pdf', path:'library/Paper.PDF' });
  assert.equal(lectellaSendPlan({ filename:'notes.md', backendId }).mode, 'direct');
  assert.equal(lectellaSendPlan({ filename:'draft.txt', backendId }).path, 'library/draft.txt');
}

// EPUB and other formats go as a Markdown export beside the library.
assert.deepEqual(lectellaSendPlan({ filename:'Pride & Prejudice.epub', backendId:'fsa' }),
  { mode:'markdown', format:'epub', path:'exports/lectella/Pride-Prejudice.md' });
assert.equal(lectellaSendPlan({ filename:'Book.mobi', backendId:'crate' }).path, 'exports/lectella/Book.md');
assert.equal(lectellaSendPlan({ filename:'Café Été.fb2', backendId:'fsa' }).path, 'exports/lectella/Cafe-Ete.md');

// Browser storage, or no storage, cannot send, and says why.
for (const backendId of ['browser', null, undefined]) {
  const plan = lectellaSendPlan({ filename:'Paper.pdf', backendId });
  assert.equal(plan.mode, 'unavailable');
  assert.match(plan.reason, /Folder or Crate/);
  assert.match(plan.reason, /Browser storage/);
}

assert.equal(lectellaExportSlug(''), 'untitled');
assert.equal(lectellaExportSlug('../../etc/passwd'), 'etc-passwd');
assert.ok(lectellaExportSlug('x'.repeat(300)).length <= 80);

// Only an import target named lectella shows the action.
assert.equal(lectellaAcceptsImport([{ appId:'lectella', action:'import', label:'Add to Lectella' }]), true);
assert.equal(lectellaAcceptsImport([{ appId:'lectella', action:'edit' }]), false);
assert.equal(lectellaAcceptsImport([{ appId:'notes', action:'import' }]), false);
assert.equal(lectellaAcceptsImport([]), false);
assert.equal(lectellaAcceptsImport(undefined), false);

const markdown = workMarkdownExport({
  title:'Pride and Prejudice',
  authors:['Jane Austen'],
  sourceFilename:'Pride.epub',
  sections:[
    { label:'Chapter 1', text:'It is a truth\nuniversally acknowledged.\n\nSecond   paragraph.' },
    { label:'', text:'   ' },
    { label:'', text:'Untitled section text.' },
  ],
});
assert.equal(markdown, [
  '# Pride and Prejudice',
  '',
  'By Jane Austen',
  '',
  'Source: Pride.epub (exported from Lorewell)',
  '',
  '## Chapter 1',
  '',
  'It is a truth universally acknowledged.',
  '',
  'Second paragraph.',
  '',
  '## Section 3',
  '',
  'Untitled section text.',
  '',
].join('\n'));
assert.equal(workMarkdownExport({ sections:[] }), '# Untitled\n');

const passage = passageMarkdownExport({
  workTitle:'Pride and Prejudice',
  authors:['Jane Austen'],
  sourceFilename:'Pride.epub',
  annotation:{ kind:'highlight', target:{ exact:'Line one\nLine two' }, body:'My note.' },
});
assert.equal(passage, [
  '# Passage from Pride and Prejudice',
  '',
  'By Jane Austen',
  '',
  '> Line one',
  '> Line two',
  '',
  'My note.',
  '',
  'Source: Pride.epub (exported from Lorewell)',
  '',
].join('\n'));
assert.equal(
  passageExportPath({ workTitle:'Pride and Prejudice', annotationId:'ann_42/../x' }),
  'exports/lectella/passages/Pride-and-Prejudice-ann_42x.md',
);

// The app wires the action only through the vendored SDK, never hand-written messages.
const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
const appScript = html.slice(html.indexOf('/* naklios-sdk:end */'));
assert.ok(appScript.includes('naklios.files.experimental_sendTo(LECTELLA_APP_ID'));
assert.ok(appScript.includes('naklios.files.experimental_targets(path)'));
assert.ok(!/naklios:file:(sendTo|targets)/.test(appScript), 'Lorewell must not post naklios:file messages itself');
assert.ok(appScript.includes('data-action="send-lectella" hidden'), 'the action starts hidden until the host lists Lectella');

console.log('send-to-lectella: ok');
