import assert from 'node:assert/strict';
import { gzipSync } from 'node:zlib';
import {
  arxivSourceUrl,
  parseArxivId,
  texEngineFor,
  texMainCandidates,
  texProjectName,
  unpackTexSource,
} from '../tex-source.js';

const encode = text => new TextEncoder().encode(text);

function tarEntry(name, body, type = '0') {
  const data = typeof body === 'string' ? encode(body) : body;
  const header = new Uint8Array(512);
  header.set(encode(name.slice(0, 100)), 0);
  header.set(encode('0000644\0'), 100);
  header.set(encode(data.length.toString(8).padStart(11, '0') + '\0'), 124);
  header.set(encode('        '), 148);
  header[156] = type.charCodeAt(0);
  header.set(encode('ustar\x0000'), 257);
  const sum = header.reduce((total, byte) => total + byte, 0);
  header.set(encode(sum.toString(8).padStart(6, '0') + '\0 '), 148);
  const padded = new Uint8Array(Math.ceil(data.length / 512) * 512);
  padded.set(data);
  return [header, padded];
}

function tar(entries) {
  const blocks = entries.flatMap(entry => tarEntry(...entry));
  blocks.push(new Uint8Array(1024));
  const out = new Uint8Array(blocks.reduce((total, block) => total + block.length, 0));
  let offset = 0;
  for (const block of blocks) {
    out.set(block, offset);
    offset += block.length;
  }
  return out;
}

const whole = '\\documentclass{article}\n\\begin{document}\nHi\n\\end{document}\n';

assert.equal(parseArxivId('2401.12345'), '2401.12345');
assert.equal(parseArxivId(' arXiv:2401.12345v2 '), '2401.12345v2');
assert.equal(parseArxivId('https://arxiv.org/abs/2401.12345'), '2401.12345');
assert.equal(parseArxivId('https://arxiv.org/pdf/2401.12345v1.pdf'), '2401.12345v1');
assert.equal(parseArxivId('hep-th/9901001'), 'hep-th/9901001');
assert.equal(parseArxivId('https://example.com/2401.12345'), null);
assert.equal(parseArxivId('../etc/passwd'), null);
assert.equal(arxivSourceUrl('2401.12345'), 'https://arxiv.org/src/2401.12345');

const archive = tar([
  ['main.tex', whole],
  ['figs/', '', '5'],
  ['figs/a.pdf', new Uint8Array([1, 2, 3])],
  ['link.tex', '', '2'],
  ['../escape.tex', whole],
  ['/etc/passwd', 'x'],
  ['._main.tex', 'x'],
]);
const paths = async bytes => (await unpackTexSource(bytes, 'x.tar.gz')).map(file => file.path);
assert.deepEqual(await paths(archive), ['main.tex', 'figs/a.pdf'],
  'plain tar keeps regular project files and drops links, dotfiles and escaping paths');
assert.deepEqual(await paths(gzipSync(archive)), ['main.tex', 'figs/a.pdf'], 'gzipped tar unpacks');
assert.deepEqual([...(await unpackTexSource(archive, 'x.tar'))[1].bytes], [1, 2, 3], 'binary bytes survive');

const longName = 'd/'.repeat(60) + 'deep.tex';
assert.deepEqual(await paths(tar([['././@LongLink', longName + '\0', 'L'], ['short', whole]])), [longName],
  'GNU long names apply to the next entry');

const gzipped = await unpackTexSource(gzipSync(encode(whole)), 'arXiv-2401.12345');
assert.equal(gzipped[0].path, 'main.tex', 'arXiv single-file sources are gzipped .tex with no name');
assert.equal((await unpackTexSource(encode(whole), 'paper.tex'))[0].path, 'paper.tex');

await assert.rejects(unpackTexSource(encode('%PDF-1.7'), 'x'), /no LaTeX source/);
await assert.rejects(unpackTexSource(encode('hello'), 'notes.txt'), /Choose a/);
const damaged = tar([['main.tex', whole]]);
damaged.set(tar([['a.tex', 'x']]).subarray(0, 512), 1024);
damaged[1024 + 3] ^= 1;
await assert.rejects(unpackTexSource(damaged, 'x.tar'), /damaged/);

const file = (path, text) => ({ path, bytes:encode(text) });
assert.deepEqual(texMainCandidates([
  file('sections/intro.tex', 'Hello'),
  file('figs/plot.tex', '\\documentclass{standalone}\n\\begin{document}\\end{document}'),
  file('appendix/supp.tex', whole),
  file('commented.tex', '% \\documentclass{article}\n% \\begin{document}\n'),
  file('notes.tex', whole + '% padding to make this file larger than main.tex'),
  file('main.tex', whole),
]).map(item => item.path), ['main.tex', 'notes.tex', 'appendix/supp.tex'],
'whole documents only, shallow and conventionally named first');

assert.equal(texEngineFor('\\usepackage{amsmath}'), 'pdflatex');
assert.equal(texEngineFor('\\usepackage[no-math]{fontspec}'), 'xelatex');
assert.equal(texEngineFor('\\usepackage{luacode}'), 'lualatex');
assert.equal(texMainCandidates([file('m.tex', '\\usepackage{x}' + whole), file('n.tex', whole)])[0].engine, 'pdflatex');
assert.equal(texProjectName('arXiv-2401.12345.tar.gz'), 'arXiv-2401.12345');
assert.equal(texProjectName('../my paper (v2).tgz'), 'my-paper-v2');
assert.equal(texProjectName('...'), 'paper');

console.log('tex source tests passed');
