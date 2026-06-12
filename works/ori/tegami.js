/* ============================================================
   手紙を織る。

   「らドレドレドーそーー」— seed 20260612 の「歌」の世界で、
   紀元 2 年、最初の民の恋歌として生まれた節。
   その旋律を、同じ種で布に織り、tegami.svg として残す。

   node tegami.js で、いつでも同じ布が一画素ちがわず織り直せる。
   ============================================================ */

import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { kanaToMelody } from './js/core/kana.js';
import { weave, clothToSVG, fingerprint } from './js/core/loom.js';

export const TEGAMI = {
  kana: 'らドレドレドーそーー',
  seed: 20260612,
  warp: 72,
  rows: 120,
};

export function weaveTegami() {
  const { kana, ...opts } = TEGAMI;
  return weave(kanaToMelody(kana), opts);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const cloth = weaveTegami();
  const path = join(dirname(fileURLToPath(import.meta.url)), 'tegami.svg');
  writeFileSync(path, clothToSVG(cloth));
  console.log(`織り上がり — 銘「${fingerprint(cloth)}」 → ${path}`);
}
