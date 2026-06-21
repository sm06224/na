/* 永遠にオープンな issue #120 を読み、まだ刻まれていない名を台帳に「足すだけ」。
   消さない・並べ替えない・書き換えない。CI が定期的に回す（手で走らせてもよい）。
     node sync.js          # GitHub API から取得（GITHUB_TOKEN があれば優先で使う）
   API に届かない環境では何もせず静かに終わる（台帳が真実のままでよい）。 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { parseLedger, ledgerToText, appendName, nameFromComment } from './js/core/hi.js';

const here = dirname(fileURLToPath(import.meta.url));
const path = join(here, 'names.jsonl');
const REPO = process.env.HI_REPO || 'sm06224/na';
const ISSUE = process.env.HI_ISSUE || '120';

async function fetchComments() {
  const headers = { 'accept': 'application/vnd.github+json', 'user-agent': 'hi-stele' };
  if (process.env.GITHUB_TOKEN) headers.authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  const all = [];
  for (let page = 1; page <= 10; page++) {
    const url = `https://api.github.com/repos/${REPO}/issues/${ISSUE}/comments?per_page=100&page=${page}`;
    const res = await fetch(url, { headers });
    if (!res.ok) throw new Error(`GitHub API ${res.status}`);
    const batch = await res.json();
    all.push(...batch);
    if (batch.length < 100) break;
  }
  return all;
}

(async () => {
  let comments;
  try { comments = await fetchComments(); }
  catch (e) { process.stdout.write(`issue に届かなかった（${e.message}）。台帳はそのまま。`); return; }

  let entries = parseLedger(readFileSync(path, 'utf8'));
  let added = 0;
  for (const c of comments) {
    const parsed = nameFromComment(c.body || '');
    if (!parsed) continue;
    const r = appendName(entries, { name: parsed.name, glyph: parsed.glyph, via: `issue#${ISSUE}` });
    if (r.added) { entries = r.entries; added++; process.stdout.write(`新しい名を刻む：${parsed.name}\n`); }
  }
  if (added) writeFileSync(path, ledgerToText(entries));
  process.stdout.write(added ? `${added} の名を足した` : '足す名は無かった');
})();
