#!/usr/bin/env node
/* ============================================================
   計 — 電卓ノートを、ターミナルで走らせる。

     node kei.js examples/旅費.kei      ファイルを清書して計算
     echo "5 km in mi" | node kei.js    パイプから一行

   左に書いた式、右に答え。散文や見出しはそのまま、計算だけ右に出る。
   ブラウザ無しで、成果物をそのまま試せる。依存ゼロ。
   ============================================================ */
import { run } from './js/core/kei.js';
import { readFileSync } from 'node:fs';

function display(width) {
  return (out) => {
    // 入力の見た目幅（全角=2）をそろえる
    const vis = (s) => [...s].reduce((w, c) => w + (/[^\x00-\xff｡-ﾟ]/.test(c) ? 2 : 1), 0);
    const col = Math.min(width, Math.max(...out.map((r) => vis((r.input || '').replace(/\s+$/, ''))), 0) + 2);
    const lines = [];
    for (const r of out) {
      const left = (r.input || '').replace(/\s+$/, '');
      if (r.kind === 'blank') { lines.push(''); continue; }
      const pad = ' '.repeat(Math.max(1, col - vis(left)));
      if (r.error) lines.push(`${left}${pad}\x1b[31m⟨!⟩ ${r.error}\x1b[0m`);
      else if (r.result === null) lines.push(`\x1b[2m${left}\x1b[0m`);            // 散文・見出しは淡く
      else lines.push(`${left}${pad}\x1b[33m= ${r.result}\x1b[0m`);               // 答えは暖色
    }
    return lines.join('\n');
  };
}

function main() {
  const file = process.argv[2];
  let src;
  if (file) src = readFileSync(file, 'utf8');
  else src = readFileSync(0, 'utf8');                  // stdin
  process.stdout.write(display(60)(run(src)) + '\n');
}
main();
