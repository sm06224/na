/* ============================================================
   段取り — schedule. 配膳の時刻から逆算して、各工程を割りつける。
   DOM を知らない。同じ入力なら、いつでも同じ段取り。

   考え方（資源制約つき後ろ向き貪欲法）：
     ・あなたの手・こんろ・オーブンは「同時に使える数」が限られる。
       手は人数、こんろは口数、オーブンは台数。
     ・各料理は工程が一本の鎖（前の工程が終わってから次へ）。
     ・配膳時刻 serve に間に合うよう、各工程を「できるだけ遅く」
       （＝熱いうちに仕上がるよう）置く。資源がぶつかるときだけ、
       置けるところまで早める。
     ・煮込みや炊飯など「放っておける」工程は資源を食わないので、
       重なってよい。だから段取りは、放置時間をどう活かすかになる。
     ・長い料理から先に良い時間帯を取る（残り時間が少ない順）。

   返すのは「いつ何をするか」の時刻つきの計画。誰の手も二つには
   ならず、こんろもオーブンも溢れない——それをテストが見張る。
   ============================================================ */

import { needs, isIdle, totalMin } from './dishes.js';

export const DEFAULT_KITCHEN = { cooks: 1, burners: 2, ovens: 1 };

/* 分 → "H:MM"（24時制）。 */
export function hhmm(min) {
  const m = ((Math.round(min) % 1440) + 1440) % 1440;
  return Math.floor(m / 60) + ':' + String(m % 60).padStart(2, '0');
}
/* "H:MM" / "HH:MM" → 分。 */
export function parseHHMM(s) {
  const m = String(s).match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const h = +m[1], mm = +m[2];
  if (h > 47 || mm > 59) return null;
  return h * 60 + mm;
}

/* 工程が要る資源を、台帳のキーごとに 1 ずつ。 */
function load(kitchen) {
  return { hands: kitchen.cooks | 0, heat: kitchen.burners | 0, oven: kitchen.ovens | 0 };
}

/* ============================================================
   schedule(dishes, opts)
     opts: { serve (分・既定 18:00=1080), kitchen:{cooks,burners,ovens} }
   返り値:
     { serve, kitchen, startAt, dishes:[{...,start,end,wait,steps:[{...,start,end}]}],
       events:[{at,end,dishId,dishName,emoji,name,min,res,idle}], warnings:[] }
   ============================================================ */
export function schedule(dishList, opts = {}) {
  const serve = opts.serve == null ? 18 * 60 : opts.serve | 0;
  const kitchen = { ...DEFAULT_KITCHEN, ...(opts.kitchen || {}) };
  const cap = load(kitchen);

  // 時間軸：配膳より前へどれだけ遡れるか（全工程を直列に並べた最悪＋余裕）。
  const horizon = dishList.reduce((a, d) => a + totalMin(d), 0) + 120;
  const base = serve - horizon;                 // この時刻が index 0
  const N = horizon + 1;
  const use = {
    hands: new Int16Array(N), heat: new Int16Array(N), oven: new Int16Array(N),
  };
  const idx = m => m - base;

  const free = (st, s) => {                       // [s, s+min) が空いているか
    const rs = needs(st);
    for (let m = s; m < s + st.min; m++) {
      const i = idx(m);
      if (i < 0) return false;
      for (const r of rs) if (use[r][i] + 1 > cap[r]) return false;
    }
    return true;
  };
  const reserve = (st, s) => {
    const rs = needs(st);
    for (let m = s; m < s + st.min; m++) {
      const i = idx(m);
      for (const r of rs) use[r][i] += 1;
    }
  };

  // 出来たてで出したい料理（fresh 高）から、配膳ぎわの良い時間帯を確保する。
  // 同じ鮮度なら、長い（残り時間の少ない）料理を先に。
  const fresh = d => (d.fresh == null ? 2 : d.fresh);
  const order = dishList.map((d, i) => ({ d, i }))
    .sort((a, b) => fresh(b.d) - fresh(a.d) || totalMin(b.d) - totalMin(a.d) || a.i - b.i);

  const warnings = [];
  const out = new Map();

  for (const { d } of order) {
    const placed = [];
    let nextStart = serve;                        // この時刻までに（後ろの工程の手前まで）に終える
    let infeasible = false;
    for (let k = d.steps.length - 1; k >= 0; k--) {
      const st = d.steps[k];
      // できるだけ遅く：終わりが nextStart になる位置から、空くまで早める。
      let s = nextStart - st.min;
      while (s >= base && !free(st, s)) s--;
      if (s < base) { infeasible = true; break; }
      reserve(st, s);
      placed.unshift({ ...st, start: s, end: s + st.min, res: needs(st), idle: isIdle(st) });
      nextStart = s;
    }
    if (infeasible) {
      warnings.push(`「${d.name}」は資源が足りず置けません。こんろ／オーブン／人数を増やすか、品を減らしてください。`);
      continue;
    }
    const start = placed[0].start, end = placed[placed.length - 1].end;
    out.set(d, { id: d.id, name: d.name, emoji: d.emoji, note: d.note, start, end, wait: serve - end, steps: placed });
  }

  // もとの順序で並べ直し、行事（イベント）の時刻順リストを作る。
  const dishes = dishList.map(d => out.get(d)).filter(Boolean);
  const events = [];
  for (const dd of dishes) for (const st of dd.steps) {
    events.push({ at: st.start, end: st.end, dishId: dd.id, dishName: dd.name, emoji: dd.emoji, name: st.name, min: st.min, res: st.res, idle: st.idle });
  }
  events.sort((a, b) => a.at - b.at || (a.idle - b.idle));

  const startAt = events.length ? events[0].at : serve;
  if (startAt < serve - horizon + 60) warnings.push('品数が多く、かなり早い時刻から始める必要があります。');

  return { serve, kitchen, startAt, dishes, events, warnings };
}

/* ある時刻 now に「いま着手すべき／進行中」の工程を拾う（live 表示用）。 */
export function activeAt(plan, now) {
  return plan.events.filter(e => e.at <= now && now < e.end);
}
/* 次に着手する工程（now 以降で最も早い開始）。 */
export function nextAfter(plan, now) {
  let best = null;
  for (const e of plan.events) if (e.at >= now && (!best || e.at < best.at)) best = e;
  return best;
}
