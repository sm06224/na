/* ============================================================
   苔庭 — 庭は週番号の純粋関数である。
   garden(week) は、創世から week 週目の庭の SVG を返す。
   状態ファイルはない。壊れる状態がないので、ワークフローが
   何週眠っても、目覚めたとき苔は経った時間ぶん育っている。
   ============================================================ */

export const GENESIS = '2026-06-12';   // この庭が置かれた日
const W = 640, H = 320;

/* 決定的乱数（言・歌と同じ mulberry32） */
function rng(seed) {
  let s = seed | 0;
  return function () {
    s = (s + 0x6D2B79F5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* 日付（UTC）→ 週番号。創世の週が 0。 */
export function weekOf(date = new Date()) {
  const t0 = Date.parse(GENESIS + 'T00:00:00Z');
  const w = Math.floor((date.getTime() - t0) / (7 * 86400e3));
  return Math.max(0, w);
}

/* ----- 庭の不変の骨格（石と砂紋）。創世の seed から一度だけ決まる ----- */
function bones() {
  const r = rng(20260612);
  const stones = [];
  const n = 4;
  for (let i = 0; i < n; i++) {
    stones.push({
      x: 90 + (i + 0.5) * (W - 180) / n + (r() - 0.5) * 60,
      y: 120 + r() * 120,
      rx: 26 + r() * 30,
      ry: 16 + r() * 14,
      tilt: (r() - 0.5) * 18,
    });
  }
  return { stones };
}

/* ----- week 週目までに生えている苔 ----- */
function tufts(week, stones) {
  const out = [];
  for (let w = 0; w <= week; w++) {
    const r = rng(20260612 ^ (w * 2654435761));
    const born = 2 + (w % 4 === 0 ? 1 : 0);   // 週に 2〜3 株
    for (let k = 0; k < born; k++) {
      const s = stones[Math.floor(r() * stones.length)];
      // 石の根もと、日陰がわ（北＝上）に寄って生える。庭が古びるほど遠くへも
      const ang = -Math.PI / 2 + (r() - 0.5) * 2.4;
      const dist = s.ry + 4 + r() * (14 + Math.min(60, w * 0.5));
      const age = week - w;
      out.push({
        x: s.x + Math.cos(ang) * dist * 1.6,
        y: s.y + Math.sin(ang) * dist,
        r: Math.min(15, 2 + 2.1 * Math.sqrt(age + 0.5)),   // 歳月で太る
        hue: 95 + r() * 40,
        light: 24 + r() * 12,
        age,
        flower: r() < 0.05,    // ごくまれに、白い花
        seed: (w * 97 + k * 13) | 0,
      });
    }
  }
  return out;
}

/* ----- 描画部品 ----- */
const fmt = n => Math.round(n * 10) / 10;

function svgStones(stones) {
  let s = '';
  for (const st of stones) {
    s += `<g transform="rotate(${fmt(st.tilt)} ${fmt(st.x)} ${fmt(st.y)})">`
      + `<ellipse cx="${fmt(st.x)}" cy="${fmt(st.y)}" rx="${fmt(st.rx)}" ry="${fmt(st.ry)}" fill="#4c5150"/>`
      + `<ellipse cx="${fmt(st.x - st.rx * 0.22)}" cy="${fmt(st.y - st.ry * 0.3)}" rx="${fmt(st.rx * 0.6)}" ry="${fmt(st.ry * 0.5)}" fill="#5d6361"/>`
      + `</g>`;
  }
  return s;
}

function svgSand(stones) {
  // 砂紋：静かな横の波。石のまわりには同心の輪
  let s = '';
  for (let y = 60; y < H - 20; y += 16) {
    s += `<path d="M 20 ${y} Q ${W / 4} ${y - 4}, ${W / 2} ${y} T ${W - 20} ${y}" `
      + `fill="none" stroke="#222a22" stroke-width="1"/>`;
  }
  for (const st of stones) {
    for (let k = 1; k <= 2; k++) {
      s += `<ellipse cx="${fmt(st.x)}" cy="${fmt(st.y)}" rx="${fmt(st.rx + k * 11)}" ry="${fmt(st.ry + k * 8)}" `
        + `fill="none" stroke="#28302687" stroke-width="1"/>`;
    }
  }
  return s;
}

function svgTufts(list) {
  let s = '';
  for (const t of list) {
    const r2 = rng(t.seed ^ 0x6b6f6b65);
    // ひと株 = 小さな円の寄り合い
    for (let i = 0; i < 3; i++) {
      const dx = (r2() - 0.5) * t.r * 1.2;
      const dy = (r2() - 0.5) * t.r * 0.8;
      s += `<circle cx="${fmt(t.x + dx)}" cy="${fmt(t.y + dy)}" r="${fmt(t.r * (0.55 + r2() * 0.4))}" `
        + `fill="hsl(${fmt(t.hue)} 38% ${fmt(t.light)}%)" opacity="0.85"/>`;
    }
    // 古株はほのかに明るい芽を載せる
    if (t.age > 16) {
      s += `<circle cx="${fmt(t.x)}" cy="${fmt(t.y - t.r * 0.4)}" r="${fmt(t.r * 0.25)}" `
        + `fill="hsl(${fmt(t.hue + 10)} 45% ${fmt(t.light + 16)}%)" opacity="0.8"/>`;
    }
    if (t.flower && t.age > 10) {
      s += `<g fill="#e8ecdf" opacity="0.9">`
        + `<circle cx="${fmt(t.x - 2)}" cy="${fmt(t.y - t.r - 2)}" r="1.1"/>`
        + `<circle cx="${fmt(t.x + 2)}" cy="${fmt(t.y - t.r - 3)}" r="1.1"/>`
        + `<circle cx="${fmt(t.x)}" cy="${fmt(t.y - t.r - 5)}" r="1.1"/>`
        + `</g>`;
    }
  }
  return s;
}

/* ----- 歳月だけが連れてくる客 ----- */
function svgGuests(week, stones) {
  let s = '';
  const a = stones[0], b = stones[stones.length - 1];
  if (week >= 8) {
    // 八週目：石のかげにシダがひらく
    const x = a.x + a.rx * 0.9, y = a.y + 6;
    for (let i = -2; i <= 2; i++) {
      s += `<path d="M ${fmt(x)} ${fmt(y)} q ${fmt(8 + i * 7)} ${-18 - Math.abs(i) * -4}, ${fmt(16 + i * 11)} ${fmt(-26 + Math.abs(i) * 7)}" `
        + `fill="none" stroke="hsl(120 30% 34%)" stroke-width="1.6" stroke-linecap="round"/>`;
    }
  }
  if (week >= 26) {
    // 半年：きのこがふたつ
    const x = b.x - b.rx - 14, y = b.y + b.ry - 2;
    for (const [dx, h, r] of [[0, 9, 5], [9, 6, 3.5]]) {
      s += `<rect x="${fmt(x + dx - 1.4)}" y="${fmt(y - h)}" width="2.8" height="${h}" fill="#b7a98a" rx="1.2"/>`
        + `<ellipse cx="${fmt(x + dx)}" cy="${fmt(y - h)}" rx="${r}" ry="${fmt(r * 0.62)}" fill="#8a6648"/>`;
    }
  }
  if (week >= 52) {
    // 一年：石灯籠が立つ。誰が立てたのかは、誰も知らない
    const x = W - 86, y = H - 64;
    s += `<g fill="#565b58">`
      + `<rect x="${x - 9}" y="${y - 6}" width="18" height="10" rx="2"/>`
      + `<rect x="${x - 4}" y="${y - 26}" width="8" height="20"/>`
      + `<rect x="${x - 12}" y="${y - 34}" width="24" height="9" rx="2"/>`
      + `<rect x="${x - 8}" y="${y - 46}" width="16" height="12" fill="#3c403e"/>`
      + `<path d="M ${x - 16} ${y - 46} L ${x} ${y - 58} L ${x + 16} ${y - 46} Z"/>`
      + `<circle cx="${x}" cy="${y - 40}" r="2.6" fill="#ffd9a0" opacity="0.85"/>`
      + `</g>`;
  }
  if (week >= 156) {
    // 三年：蛙がきて、石の上に座る。それきり動かない
    const x = stones[1].x, y = stones[1].y - stones[1].ry - 4;
    s += `<g fill="#5a7d4a">`
      + `<ellipse cx="${fmt(x)}" cy="${fmt(y)}" rx="7" ry="4.6"/>`
      + `<circle cx="${fmt(x - 3.4)}" cy="${fmt(y - 4)}" r="2"/>`
      + `<circle cx="${fmt(x + 3.4)}" cy="${fmt(y - 4)}" r="2"/>`
      + `<circle cx="${fmt(x - 3.4)}" cy="${fmt(y - 4.4)}" r="0.8" fill="#1c2418"/>`
      + `<circle cx="${fmt(x + 3.4)}" cy="${fmt(y - 4.4)}" r="0.8" fill="#1c2418"/>`
      + `</g>`;
  }
  return s;
}

/* ----- 庭ぜんたい ----- */
export function garden(week) {
  const w = Math.max(0, week | 0);
  const { stones } = bones();
  const moss = tufts(w, stones);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" font-family="sans-serif">`
    + `<rect width="${W}" height="${H}" rx="12" fill="#141814"/>`
    + svgSand(stones)
    + svgTufts(moss)
    + svgStones(stones)
    + svgGuests(w, stones)
    + `<text x="${W - 16}" y="${H - 14}" text-anchor="end" font-size="10" fill="#49543f">`
    + `第${w}週 · ${GENESIS} から</text>`
    + `</svg>\n`;
}

/* コミットメッセージに添える、週がわりのひとこと */
const LINES = [
  '石の北側から、緑がひろがる',
  '誰も見ていない週も、苔は育っていた',
  '雨の記憶だけで生きられる植物がある',
  '庭は急がない',
  '先週との違いは、目を凝らさないとわからない',
  'さざれ石の巌となりて、苔のむすまで',
  '緑がすこし、濃くなった',
  '古い株の上に、新しい芽',
  '石は動かず、苔だけが動く（ゆっくりと）',
  '今週も、庭は庭のままである',
  '隙間がまたひとつ、緑に譲られた',
  '苔は地図を持たずに広がる',
];
export function lineOf(week) {
  return `苔 — 第${week}週: ${LINES[week % LINES.length]}`;
}
