/* 台帳(names.jsonl) から 石碑(stele.svg) を彫る。
   node build.js   → 変わっていれば stele.svg を書き直す。
   苔の庭師と同じく、CI がこれを回して石を最新に保つ。 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { parseLedger, engrave } from './js/core/hi.js';

const here = dirname(fileURLToPath(import.meta.url));
const entries = parseLedger(readFileSync(join(here, 'names.jsonl'), 'utf8'));
const svg = engrave(entries);
const out = join(here, 'stele.svg');
let prev = '';
try { prev = readFileSync(out, 'utf8'); } catch {}
if (prev !== svg) { writeFileSync(out, svg); process.stdout.write(`碑に ${entries.length} の名を刻み直した`); }
else process.stdout.write('碑は変わっていない');
