#!/usr/bin/env node
/* ============================================================
   envelope のビルダ — ツール一式を自己完結の単一 HTML に畳む。
   仕様 §8「単一ファイル・ローカル動作・外部依存なし」の実現手段。
   モジュール（core/model.js → ui/charts.js → ui/main.js）の
   import/export を剥がして 1 本の <script> に連結するだけ——
   コアが DOM もネットも知らない純粋関数だから、これで壊れない。
     node build.js               → dist/envelope.html
     node build.js out.html      → out.html
   ============================================================ */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const MODULES = ['js/core/model.js', 'js/ui/charts.js', 'js/ui/tex.js', 'js/ui/main.js'];

const read = (p) => readFileSync(join(HERE, p), 'utf8');
const strip = (s) => s
  .replace(/^import\s[\s\S]*?from\s+'[^']*';\s*$/mg, '')      // import 文（複数行でも）を丸ごと除去
  .split('\n')
  .map((l) => l.replace(/^export\s+(function|const|class|let)\b/, '$1'))
  .join('\n')
  .replace(/<\/script/g, '<\\/script');   // 埋め込み先の <script> を早期終端させない

export function html() {
  const page = read('index.html');
  const bundle = MODULES.map((m) => strip(read(m))).join('\n');
  return page.replace(/<script type="module">[\s\S]*?<\/script>/,
    `<script>\n${bundle}\nboot();\n</script>`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const out = process.argv[2] || join(HERE, 'dist', 'envelope.html');
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, html());
  console.log('built', out);
}
