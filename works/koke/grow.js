#!/usr/bin/env node
/* 苔をひと巡りぶん育てて、garden.svg に描き直す。
   標準出力にコミットメッセージを 1 行だけ吐く。
   状態ファイルはない — 庭は今日の日付の純粋関数。 */
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { garden, lineOf, weekOf } from './js/core/garden.js';

const week = weekOf(new Date());
const here = dirname(fileURLToPath(import.meta.url));
writeFileSync(join(here, 'garden.svg'), garden(week));
console.log(lineOf(week));
