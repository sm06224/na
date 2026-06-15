/* ============================================================
   籤 — 誰にも操作できない、みんなで確かめられるくじ。

   くじの結果を「入力の純粋関数」にする。順番も当選も、参加者と
   モードと“塩（種）”だけから一意に決まり、SHA-256 が逆算も細工も
   ふさぐ。だから——

     1. 引く側は「塩」を決め、その封（commitment＝塩のハッシュ）を
        結果より先にみんなへ配る。
     2. あとから塩を選び直しても封と合わない＝結果は書き換えられない。
     3. 誰でも、参加者・モード・塩を入れ直せば同じ結果を再現でき、
        身内びいきが無いことを自分の目で確かめられる。

   さらに「みんなの合言葉」を混ぜれば、引く側ですら結果を予見できない
   （正直な参加者が一人でもいれば公平）。コアは DOM を知らない。
   ============================================================ */

import { sha256Bytes, sha256Hex } from './sha256.js';

const TE = new TextEncoder();
export const VERSION = 1;

/* ----- 入力をそろえる（前後の空白を落とし、空行を捨てる） ----- */
export function normalizeEntrants(list) {
  return (list || []).map(s => String(s).trim()).filter(s => s.length > 0);
}
function normalizeWords(list) {
  // 合言葉は出した順に依存しない（みんなが対等）よう、整えて並べ替える
  return (list || []).map(s => String(s).trim()).filter(s => s.length > 0).sort();
}

/* ----- くじの全体を一意に表す正準文字列（結果を決めるものすべて） ----- */
function canonical(entrants, mode, count, salt, words) {
  return JSON.stringify(['kuji', VERSION, mode, count | 0, entrants, String(salt || ''), words]);
}

/* ----- 種から、偏りのない 32bit 整数列をつくる（SHA-256 のカウンタモード） ----- */
function makeStream(seed) {
  let counter = 0;
  let buf = new Uint8Array(0);
  let pos = 0;
  function refill() {
    const c = new Uint8Array(seed.length + 8);
    c.set(seed, 0);
    new DataView(c.buffer).setUint32(seed.length + 4, counter >>> 0);  // 64bit カウンタの下位
    buf = sha256Bytes(c);
    pos = 0;
    counter++;
  }
  return function next32() {
    if (pos + 4 > buf.length) refill();
    const v = ((buf[pos] << 24) | (buf[pos + 1] << 16) | (buf[pos + 2] << 8) | buf[pos + 3]) >>> 0;
    pos += 4;
    return v;
  };
}

/* [0, n) の偏りのない整数（剰余の偏りを棄却法で除く） */
function below(next, n) {
  if (n <= 0) throw new RangeError('n must be positive');
  const limit = Math.floor(0x100000000 / n) * n;
  let x;
  do { x = next(); } while (x >= limit);
  return x % n;
}

/* フィッシャー–イェーツ洗牌（決定的・偏りなし） */
function shuffle(arr, next) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = below(next, i + 1);
    const t = a[i]; a[i] = a[j]; a[j] = t;
  }
  return a;
}

/* ============================================================
   draw(inputs) — くじを一回引く
   inputs: { entrants:[], mode:'order'|'pick'|'groups', count, salt, words:[] }
   ============================================================ */
export function draw(inputs) {
  const entrants = normalizeEntrants(inputs.entrants);
  const mode = inputs.mode || 'order';
  const count = inputs.count | 0;
  const salt = String(inputs.salt || '');
  const words = normalizeWords(inputs.words);
  if (entrants.length === 0) throw new Error('参加者がいません');

  const canon = canonical(entrants, mode, count, salt, words);
  const seed = sha256Bytes(TE.encode(canon));
  const next = makeStream(seed);

  const order = shuffle(entrants, next);
  const id = sha256Hex(canon).slice(0, 8);   // 銘 — このくじの指紋

  const result = { mode, count, entrants, order, id };
  if (mode === 'pick') {
    const k = Math.max(0, Math.min(count, order.length));
    result.winners = order.slice(0, k);
  } else if (mode === 'groups') {
    const g = Math.max(1, Math.min(count, order.length));
    const groups = Array.from({ length: g }, () => []);
    order.forEach((name, i) => groups[i % g].push(name));   // 順に配る＝差は最大1人
    result.groups = groups;
  }
  return result;
}

/* ----- 封（commitment）— 結果より先に配る、塩への封蝋 ----- */
export function commitment(salt) {
  return sha256Hex('kuji-commit/v' + VERSION + '\n' + String(salt || ''));
}
export function verifyCommitment(commit, salt) {
  return commitment(salt) === String(commit || '').trim().toLowerCase();
}

/* ----- 検証：申告された結果が、入力から本当に導かれるか ----- */
function sameArray(a, b) {
  if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}
export function verify(inputs, claimed) {
  const fresh = draw(inputs);
  if (!claimed) return { ok: true, fresh };
  let ok = fresh.id === claimed.id && sameArray(fresh.order, claimed.order);
  if (ok && claimed.winners) ok = sameArray(fresh.winners || [], claimed.winners);
  if (ok && claimed.groups) {
    ok = Array.isArray(claimed.groups) && fresh.groups.length === claimed.groups.length
      && fresh.groups.every((g, i) => sameArray(g, claimed.groups[i]));
  }
  return { ok, fresh };
}

/* ----- 証拠（evidence）— 入力ぜんぶを畳んだ、誰でも再現できる一片 ----- */
export function encodeEvidence(inputs) {
  const payload = {
    v: VERSION,
    m: inputs.mode || 'order',
    c: inputs.count | 0,
    e: normalizeEntrants(inputs.entrants),
    s: String(inputs.salt || ''),
    w: normalizeWords(inputs.words),
  };
  const json = JSON.stringify(payload);
  const b64 = (typeof btoa === 'function')
    ? btoa(unescape(encodeURIComponent(json)))
    : Buffer.from(json, 'utf8').toString('base64');
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
export function decodeEvidence(str) {
  const b64 = String(str || '').replace(/-/g, '+').replace(/_/g, '/');
  const json = (typeof atob === 'function')
    ? decodeURIComponent(escape(atob(b64)))
    : Buffer.from(b64, 'base64').toString('utf8');
  const p = JSON.parse(json);
  return { mode: p.m, count: p.c | 0, entrants: p.e || [], salt: p.s || '', words: p.w || [] };
}
