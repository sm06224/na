#!/usr/bin/env node
/* ============================================================
   謎 — Enigma を、ターミナルで回す。暗号化と復号は同じ操作。

     node nazo.js --key "I-II-III.B.AAA.AAA.AB CD" "ATTACK AT DAWN"
     echo "BDZGO" | node nazo.js                 # 既定の鍵で復号

   鍵の形： ロータ-ロータ-ロータ.反射器.リング.初期位置.プラグ
   同じ鍵を入れたときだけ、文は元に戻る。依存ゼロ。
   ============================================================ */
import { Enigma, unpackKey, packKey } from './js/core/enigma.js';
import { readFileSync } from 'node:fs';

const DEFAULT = 'I-II-III.B.AAA.AAA.';

function main() {
  const args = process.argv.slice(2);
  let key = DEFAULT, parts = [];
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--key' || args[i] === '-k') key = args[++i];
    else parts.push(args[i]);
  }
  let text = parts.join(' ');
  if (!text) text = readFileSync(0, 'utf8');        // stdin
  const settings = unpackKey(key);
  const out = new Enigma(settings).encode(text.replace(/\n+$/, ''));
  process.stdout.write(out + '\n');
}
main();

export { packKey };
