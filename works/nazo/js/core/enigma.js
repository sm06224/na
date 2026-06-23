/* ============================================================
   謎 — Enigma を、無から。第二次大戦の暗号機を、依存ゼロで忠実に。

   鍵を押すとローターが回り（右は毎回、切り欠きで次へ送る——あの
   「ダブルステッピング」の癖まで）、電流はプラグボード→三つのローター→
   反射器→ローターを逆順に→プラグボードと巡り、ランプが灯る。
   暗号化と復号は同じ操作（可逆）。そして——どの文字も、自分自身には
   絶対に化けない（Enigma の宿命の弱点）。

   コアは DOM を知らない。同じ設定（鍵）からは、寸分たがわず同じ暗号文。
   ============================================================ */

const A = 65;
const idx = (c) => c.charCodeAt(0) - A;
const chr = (i) => String.fromCharCode(A + ((i % 26) + 26) % 26);

// 史実のローター配線と切り欠き（turnover notch）、反射器。
export const ROTORS = {
  I:   { wiring: 'EKMFLGDQVZNTOWYHXUSPAIBRCJ', notch: 'Q' },
  II:  { wiring: 'AJDKSIRUXBLHWTMCQGZNPYFVOE', notch: 'E' },
  III: { wiring: 'BDFHJLCPRTXVZNYEIWGAKMUSQO', notch: 'V' },
  IV:  { wiring: 'ESOVPZJAYQUIRHXLNFTGKDCMWB', notch: 'J' },
  V:   { wiring: 'VZBRGITYUPSDNHLXAWMJQOFECK', notch: 'Z' },
};
export const REFLECTORS = {
  B: 'YRUHQSLDPXNGOKMIEBFZCWVJAT',
  C: 'FVPJIAOYEDRZXWGCTKUQSBNMHL',
};

class Rotor {
  constructor(name, ring, pos) {
    const r = ROTORS[name];
    if (!r) throw new Error(`知らないローター: ${name}`);
    this.name = name;
    this.fwd = [...r.wiring].map(idx);
    this.bwd = Array(26);
    this.fwd.forEach((v, i) => { this.bwd[v] = i; });
    this.notch = idx(r.notch);
    this.ring = typeof ring === 'string' ? idx(ring) : ring;   // Ringstellung 0–25
    this.pos = typeof pos === 'string' ? idx(pos) : pos;       // Grundstellung 0–25
  }
  atNotch() { return this.pos === this.notch; }
  step() { this.pos = (this.pos + 1) % 26; }
  forward(c) { const x = (c + this.pos - this.ring + 26) % 26; return (this.fwd[x] - this.pos + this.ring + 26) % 26; }
  backward(c) { const x = (c + this.pos - this.ring + 26) % 26; return (this.bwd[x] - this.pos + this.ring + 26) % 26; }
}

class Plugboard {
  constructor(pairs = []) {
    this.map = Array.from({ length: 26 }, (_, i) => i);
    for (const p of pairs) {
      if (!p || p.length < 2) continue;
      const a = idx(p[0].toUpperCase()), b = idx(p[1].toUpperCase());
      this.map[a] = b; this.map[b] = a;
    }
  }
  swap(c) { return this.map[c]; }
}

const norm = (s, fallback) => {
  if (Array.isArray(s)) return s.map((x) => (typeof x === 'string' ? idx(x.toUpperCase()) : x));
  if (typeof s === 'string') return [...s.toUpperCase()].map(idx);
  return fallback;
};

export class Enigma {
  /* settings = {
       rotors:    ['I','II','III'],   // 左→右（左がいちばん遅い）
       reflector: 'B',
       rings:     'AAA',              // Ringstellung（各ローター）
       positions: 'AAA',             // 初期位置（窓に見える文字）
       plugs:     ['AB','CD', …]      // プラグボード（対）
     } */
  constructor(s) {
    const rings = norm(s.rings, [0, 0, 0]);
    const pos = norm(s.positions, [0, 0, 0]);
    this.left = new Rotor(s.rotors[0], rings[0], pos[0]);
    this.mid = new Rotor(s.rotors[1], rings[1], pos[1]);
    this.right = new Rotor(s.rotors[2], rings[2], pos[2]);
    const ref = REFLECTORS[s.reflector || 'B'];
    if (!ref) throw new Error(`知らない反射器: ${s.reflector}`);
    this.reflector = [...ref].map(idx);
    this.plug = new Plugboard(s.plugs);
  }

  // 鍵を押すたび、信号が流れる前にローターが進む（爪機構＝ダブルステッピング）。
  advance() {
    const midAtNotch = this.mid.atNotch();
    const rightAtNotch = this.right.atNotch();
    if (midAtNotch) { this.mid.step(); this.left.step(); }
    else if (rightAtNotch) { this.mid.step(); }
    this.right.step();
  }

  encodeChar(ch) {
    this.advance();
    let c = idx(ch);
    c = this.plug.swap(c);
    c = this.right.forward(c);
    c = this.mid.forward(c);
    c = this.left.forward(c);
    c = this.reflector[c];
    c = this.left.backward(c);
    c = this.mid.backward(c);
    c = this.right.backward(c);
    c = this.plug.swap(c);
    return chr(c);
  }

  // 窓に見える三文字（左→右）。
  window() { return chr(this.left.pos) + chr(this.mid.pos) + chr(this.right.pos); }

  // 文字列を暗号化／復号（同じ操作）。A–Z 以外はそのまま素通し。
  encode(text) {
    let out = '';
    for (const ch of text.toUpperCase()) {
      out += (ch >= 'A' && ch <= 'Z') ? this.encodeChar(ch) : ch;
    }
    return out;
  }
}

// 一回きりの変換（設定を消費しない使い捨て機械）。
export function cipher(settings, text) { return new Enigma(settings).encode(text); }

/* ---- 鍵（設定）を一本の文字列に畳む・ひらく。会える種：同じ鍵だけが開く ----
   形： ロータ-ロータ-ロータ.反射器.リング.初期位置.プラグ
   例： I-II-III.B.AAA.AAA.ABCD                                         */
export function packKey(s) {
  const rings = Array.isArray(s.rings) ? s.rings.join('') : s.rings;
  const pos = Array.isArray(s.positions) ? s.positions.join('') : s.positions;
  const plugs = (s.plugs || []).join('').toUpperCase();
  return `${s.rotors.join('-')}.${s.reflector || 'B'}.${rings}.${pos}.${plugs}`;
}
export function unpackKey(str) {
  const [rotors, reflector, rings, positions, plugs = ''] = String(str).trim().split('.');
  const pairs = [];
  const p = plugs.toUpperCase().replace(/[^A-Z]/g, '');
  for (let i = 0; i + 1 < p.length; i += 2) pairs.push(p[i] + p[i + 1]);
  return { rotors: rotors.split('-'), reflector: reflector || 'B', rings, positions, plugs: pairs };
}
