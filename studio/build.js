#!/usr/bin/env node
/* ============================================================
   studio のビルダ — .mmd 図ひとつ → 自己完結の単一 HTML。
   エディタ本体（index.html ＋ ui/editor.css ＋ engine/render/ui のモジュール）を
   import/export を剥がして 1 枚に畳み、図の Mermaid を埋め込む。
   出来上がりは依存ゼロ・オフライン・どこでも開けるフル機能エディタ。
     node build.js examples/release.mmd            → dist/release.html
     node build.js examples/release.mmd out.html   → out.html
     node build.js --all                           → examples/*.mmd をすべて
   ============================================================ */
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { dirname, join, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const MODULES = ['engine/date.js', 'engine/parse.js', 'engine/layout.js',
  'engine/serialize.js', 'engine/import.js', 'render/draw.js', 'ui/editor.js'];

const read = (p) => readFileSync(join(HERE, p), 'utf8');
const strip = (s) => s.split('\n')
  .filter((l) => !/^\s*import\b/.test(l))
  .map((l) => l.replace(/^\s*export\s+(function|const|class|let)\b/, '$1'))
  .join('\n');

export function html(source) {
  const page = read('index.html'), css = read('ui/editor.css');
  const bundle = MODULES.map((m) => strip(read(m))).join('\n');
  return page
    .replace(/<link rel="stylesheet"[^>]*>/, `<style>\n${css}\n</style>`)
    .replace(/<script type="module">[\s\S]*?<\/script>/,
      `<script>\nwindow.STUDIO_SOURCE=${JSON.stringify(source)};\n${bundle}\nboot();\n</script>`);
}

const titleOf = (s) => { const m = /^\s*title\s+(.+)$/m.exec(s); return m ? m[1].trim() : null; };

export function build(input, output) {
  const source = readFileSync(input, 'utf8');
  const out = output || join(HERE, 'dist', basename(input).replace(/\.mmd$/, '') + '.html');
  writeFileSync(out, html(source));
  return out;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const argv = process.argv.slice(2);
  if (argv[0] === '--all') {
    const dir = join(HERE, 'examples');
    for (const f of readdirSync(dir).filter((f) => f.endsWith('.mmd')))
      console.log('built', build(join(dir, f)));
  } else if (argv.length) {
    console.log('built', build(argv[0], argv[1]));
  } else {
    console.error('usage: node build.js <file.mmd> [out.html]  |  node build.js --all');
    process.exit(1);
  }
}
