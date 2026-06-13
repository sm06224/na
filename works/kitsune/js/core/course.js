/* ============================================================
   行路 — 狐が仕掛け、追手が辿る、チェックポイントの列。

   コースはまるごと URL のかけら（#c=…）に畳まれる。サーバーは無い。
   リンクを渡すことが、遊びを渡すことのすべて。

   通過の証明は三つの流儀：
     gps   — 輪の中に入れば通った
     qr    — 現地に貼られた QR（#t=… のリンク）を標準カメラで読む。
             コース側にはトークンの SHA-256 しか入っていないので、
             リンクを解読しても答えは出ない
     photo — その場で一枚。写真そのものが証明であり、思い出
   ============================================================ */

// 合言葉に使う字母（紛らわしい I・L・O・0・1 を抜いた人が読める集合）。
// 鍵ではないが高エントロピーゆえ番人が驚くので、この行だけ見逃してもらう。
const TOKEN_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';   // gitleaks:allow
export const PROOFS = ['gps', 'qr', 'photo'];
export const MAX_CPS = 30;

/* ----- 小さな道具 ----- */

const te = new TextEncoder();
const td = new TextDecoder();

function b64urlFromBytes(bytes) {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  const b64 = (typeof btoa === 'function' ? btoa(bin)
    : Buffer.from(bytes).toString('base64'));
  return b64.replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
}

function bytesFromB64url(s) {
  const b64 = s.replaceAll('-', '+').replaceAll('_', '/');
  const bin = (typeof atob === 'function' ? atob(b64)
    : Buffer.from(b64, 'base64').toString('binary'));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/* ----- トークン（QR の答え合わせ） ----- */

export function randomToken(rand = Math.random) {
  let t = '';
  for (let i = 0; i < 5; i++) t += TOKEN_ALPHABET[(rand() * TOKEN_ALPHABET.length) | 0];
  return t;
}

export function normalizeToken(s) {
  // 字母に紛らわしい字（I・L・O・0・1）は最初から無いので、
  // 大文字に揃えて区切りを払うだけでよい
  return String(s ?? '').toUpperCase().replace(/[\s-]/g, '');
}

/* コース id と何番目かを混ぜて刻む。同じ答えの使い回しを許さない */
export async function tokenHash(courseId, idx, token) {
  const data = te.encode(`狐/${courseId}/${idx}/${normalizeToken(token)}`);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(digest)].slice(0, 6)
    .map(b => b.toString(16).padStart(2, '0')).join('');
}

export function randomId(rand = Math.random) {
  let t = '';
  for (let i = 0; i < 6; i++) t += TOKEN_ALPHABET[(rand() * TOKEN_ALPHABET.length) | 0];
  return t;
}

/* ----- コースの符号 ----- */

export function encodeCourse(course) {
  const lean = {
    v: 1,
    id: course.id,
    n: String(course.name ?? '').slice(0, 40),
    c: course.cps.map(cp => ({
      a: Math.round((cp.lat + 90) * 1e5),
      o: Math.round((cp.lon + 180) * 1e5),
      r: Math.max(10, Math.min(200, Math.round(cp.r ?? 25))),
      p: PROOFS.indexOf(cp.proof) >= 0 ? cp.proof : 'gps',
      n: String(cp.name ?? '').slice(0, 30),
      h: String(cp.hint ?? '').slice(0, 80),
      ...(cp.th ? { t: cp.th } : {}),
    })),
  };
  return 'c=' + b64urlFromBytes(te.encode(JSON.stringify(lean)));
}

export function decodeCourse(fragment) {
  const m = String(fragment || '').replace(/^#/, '').match(/(?:^|&)c=([^&]+)/);
  if (!m) return null;
  try {
    const lean = JSON.parse(td.decode(bytesFromB64url(m[1])));
    if (lean.v !== 1 || !lean.id || !Array.isArray(lean.c)) return null;
    if (lean.c.length < 1 || lean.c.length > MAX_CPS) return null;
    const cps = lean.c.map(c => {
      const lat = c.a / 1e5 - 90, lon = c.o / 1e5 - 180;
      if (!Number.isFinite(lat) || !Number.isFinite(lon) ||
          lat < -90 || lat > 90 || lon < -180 || lon > 180) throw 0;
      return {
        lat, lon,
        r: Math.max(10, Math.min(200, c.r | 0)),
        proof: PROOFS.includes(c.p) ? c.p : 'gps',
        name: String(c.n ?? ''),
        hint: String(c.h ?? ''),
        th: typeof c.t === 'string' ? c.t : null,
      };
    });
    return { id: String(lean.id).slice(0, 12), name: String(lean.n ?? ''), cps };
  } catch {
    return null;
  }
}

/* ----- 通過のしるし（QR が運ぶもの） ----- */

export function encodeToken(courseId, idx, token) {
  return `t=${courseId}.${idx}.${normalizeToken(token)}`;
}

export function decodeToken(fragment) {
  const m = String(fragment || '').replace(/^#/, '')
    .match(/(?:^|&)t=([^.&]+)\.(\d+)\.([^&]+)/);
  if (!m) return null;
  return { id: m[1], idx: Number(m[2]), token: m[3] };
}

/* ============================================================
   追跡 — 追手の歩み。状態は外の器（localStorage 等）に保存できる。
   チェックポイントは順番に解錠される。先回りは効かない。
   ============================================================ */

export class Hunt {
  constructor(course, saved = null) {
    this.course = course;
    this.startedAt = null;
    this.passed = [];          // [{ at, proof, photo? }]
    if (saved) this.load(saved);
  }

  load(json) {
    try {
      const s = typeof json === 'string' ? JSON.parse(json) : json;
      if (s && s.id === this.course.id) {
        this.startedAt = s.startedAt ?? null;
        this.passed = Array.isArray(s.passed) ? s.passed.slice(0, this.course.cps.length) : [];
      }
    } catch { /* 壊れた記録からは、最初から */ }
    return this;
  }

  save() {
    return JSON.stringify({ id: this.course.id, startedAt: this.startedAt, passed: this.passed });
  }

  begin(now = Date.now()) {
    if (this.startedAt === null) this.startedAt = now;
  }

  get started() { return this.startedAt !== null; }
  get currentIdx() { return this.passed.length; }
  get current() { return this.course.cps[this.currentIdx] ?? null; }
  get done() { return this.started && this.passed.length >= this.course.cps.length; }

  elapsed(now = Date.now()) {
    if (!this.started) return 0;
    const end = this.done ? this.passed[this.passed.length - 1].at : now;
    return Math.max(0, end - this.startedAt);
  }

  /* GPS 証明：いまの的が gps で、輪の中にいれば通る */
  passGps(distanceM, now = Date.now()) {
    const cp = this.current;
    if (!this.started || !cp || cp.proof !== 'gps') return false;
    if (!(distanceM <= cp.r)) return false;
    this.passed.push({ at: now, proof: 'gps' });
    return true;
  }

  /* 写真証明：撮ったという事実で通る（写真は思い出として残す） */
  passPhoto(thumb, now = Date.now()) {
    const cp = this.current;
    if (!this.started || !cp || cp.proof !== 'photo') return false;
    this.passed.push({ at: now, proof: 'photo', photo: thumb ?? null });
    return true;
  }

  /* QR 証明：トークンの SHA-256 が合えば通る。的しか受け付けない */
  async passToken(idx, token, now = Date.now()) {
    const cp = this.current;
    if (!this.started || !cp || cp.proof !== 'qr') return false;
    if (idx !== this.currentIdx || !cp.th) return false;
    const h = await tokenHash(this.course.id, idx, token);
    if (h !== cp.th) return false;
    this.passed.push({ at: now, proof: 'qr' });
    return true;
  }

  /* 結果のことば（共有用） */
  summary(now = Date.now()) {
    const ms = this.elapsed(now);
    const mm = Math.floor(ms / 60000), ss = Math.floor(ms / 1000) % 60;
    const lines = [`狐「${this.course.name || '名なしの行路'}」 ${this.passed.length}/${this.course.cps.length} 通過`];
    if (this.done) lines.push(`タイム ${mm}分${String(ss).padStart(2, '0')}秒`);
    this.passed.forEach((p, i) => {
      const t = Math.floor((p.at - this.startedAt) / 60000);
      lines.push(`  ${i + 1}. ${this.course.cps[i].name || `第${i + 1}の的`} — ${t}分 (${p.proof})`);
    });
    return lines.join('\n');
  }
}
