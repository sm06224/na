import { RNG } from './rng.js';
import {
  OFF, EMPTY, getAssign, setAssign, isLocked, canWork, requestOf, requiredOn,
} from './model.js';
import {
  buildCtx, staffPenalty, coveragePenalty, pairPenalty, countsFor, W,
} from './rules.js';
import { isWeekend } from './time.js';

/* ============================================================
   ソルバ — 焼きなまし法（simulated annealing）。

   目的関数 = Σ スタッフ罰 + Σ 日別の人数過不足 + ペア罰 + 公平性
   （validate.js とまったく同じ尺度）

   増分評価：1 手で変わるのは「触ったスタッフの罰」「その日の
   過不足とペア」「公平性の集計」だけなので、そこだけ計算し直す。
   これで 1 案あたり数万手を 1 秒前後で打てる。
   ============================================================ */

/* 公平性の増分集計：分散 = Σx² - (Σx)²/n を和だけで持つ */
class FairAgg {
  constructor(counts, rules) {
    this.rules = rules;
    this.n = counts.length;
    this.sum = { total: 0, weekend: 0, night: 0 };
    this.sumsq = { total: 0, weekend: 0, night: 0 };
    for (const c of counts) this.add(c);
  }
  add(c) {
    for (const k of ['total', 'weekend', 'night']) {
      this.sum[k] += c[k];
      this.sumsq[k] += c[k] * c[k];
    }
  }
  remove(c) {
    for (const k of ['total', 'weekend', 'night']) {
      this.sum[k] -= c[k];
      this.sumsq[k] -= c[k] * c[k];
    }
  }
  penalty() {
    if (this.n < 2) return 0;
    const v = k => Math.max(0, this.sumsq[k] - (this.sum[k] * this.sum[k]) / this.n);
    let p = 0;
    if (this.rules.fairTotals) p += W.FAIR_TOTAL * v('total');
    if (this.rules.fairWeekends) p += W.FAIR_WE * v('weekend');
    if (this.rules.fairNights) p += W.FAIR_NIGHT * v('night');
    return p;
  }
}

/* そのセルに置ける値の一覧（休み希望・担当外・ロックを除外） */
function candidatesFor(plan, staff, day) {
  if (isLocked(plan, staff.id, day)) return null;     // 触らない
  const req = requestOf(staff, day);
  if (req && req.kind === 'off') return [OFF];        // 休み希望は絶対
  const out = [OFF];
  for (const st of plan.shiftTypes) {
    if (!canWork(staff, st.id)) continue;
    if (req && req.kind === 'ng' && req.shiftId === st.id) continue;
    out.push(st.id);
  }
  return out;
}

/* ---------- 初期解：今ある割当を尊重しつつ、不足を貪欲に埋める ---------- */
function greedyFill(plan, ctx, rng) {
  // 未定セルはいったん休みに
  for (const sf of plan.staff) {
    for (let d = 1; d <= ctx.days; d++) {
      if (isLocked(plan, sf.id, d)) continue;
      if (getAssign(plan, sf.id, d) === EMPTY) setAssign(plan, sf.id, d, OFF);
    }
  }
  // 日ごと・シフトごとに、足りないぶんを「出勤の少ない人」から
  const totals = new Map(plan.staff.map(s => [s.id, 0]));
  for (const sf of plan.staff) {
    for (let d = 1; d <= ctx.days; d++) {
      const v = getAssign(plan, sf.id, d);
      if (v !== OFF && v !== EMPTY) totals.set(sf.id, totals.get(sf.id) + 1);
    }
  }
  for (let d = 1; d <= ctx.days; d++) {
    const wd = ctx.weekdays[d];
    for (const st of plan.shiftTypes) {
      const need = requiredOn(st, d, wd);
      let got = 0;
      for (const sf of plan.staff) if (getAssign(plan, sf.id, d) === st.id) got++;
      while (got < need) {
        // 候補: 今日はまだ休みで、このシフトに入れる人
        const pool = plan.staff.filter(sf => {
          if (isLocked(plan, sf.id, d)) return false;
          if (getAssign(plan, sf.id, d) !== OFF) return false;
          const req = requestOf(sf, d);
          if (req && req.kind === 'off') return false;
          if (req && req.kind === 'ng' && req.shiftId === st.id) return false;
          return canWork(sf, st.id);
        });
        if (pool.length === 0) break;
        // 出勤がいちばん少ない人（同数なら乱数）
        pool.sort((a, b) =>
          (totals.get(a.id) - totals.get(b.id)) || (rng.next() - 0.5));
        const pick = pool[0];
        setAssign(plan, pick.id, d, st.id);
        totals.set(pick.id, totals.get(pick.id) + 1);
        got++;
      }
    }
  }
}

/* ============================================================
   本体。plan.assign を最良解に書き換えて結果を返す。
   ============================================================ */
export function solve(plan, opts = {}) {
  const {
    seed = 1,
    iterations = 24000,
    onProgress = null,
    t0 = 4000,
    t1 = 4,
  } = opts;

  const started = Date.now();
  const rng = new RNG(seed);
  const ctx = buildCtx(plan);
  const staffArr = plan.staff;
  const nStaff = staffArr.length;
  if (nStaff === 0 || plan.shiftTypes.length === 0) {
    return { score: 0, iterations: 0, elapsedMs: 0, improved: false };
  }

  greedyFill(plan, ctx, rng);

  /* 編集対象セルの一覧（ロック・休み希望専用セルを除く） */
  const editable = [];
  const candCache = new Map();   // "sid:d" -> candidates
  for (const sf of staffArr) {
    for (let d = 1; d <= ctx.days; d++) {
      const cands = candidatesFor(plan, sf, d);
      if (cands && cands.length > 1) {
        editable.push({ sf, d });
        candCache.set(`${sf.id}:${d}`, cands);
      }
    }
  }
  if (editable.length === 0) {
    return { score: 0, iterations: 0, elapsedMs: Date.now() - started, improved: false };
  }

  /* ---------- 現在スコアの構築 ---------- */
  const SP = new Map();   // staffId -> penalty
  const CP = [0];         // day -> coverage penalty
  const PP = [0];         // day -> pair penalty
  const counts = new Map();
  for (const sf of staffArr) {
    SP.set(sf.id, staffPenalty(plan, sf, ctx));
    counts.set(sf.id, countsFor(plan, sf, ctx));
  }
  for (let d = 1; d <= ctx.days; d++) {
    CP[d] = coveragePenalty(plan, d, ctx);
    PP[d] = pairPenalty(plan, d, ctx);
  }
  const fair = new FairAgg([...counts.values()], plan.rules);

  let score = [...SP.values()].reduce((a, b) => a + b, 0)
    + CP.reduce((a, b) => a + b, 0)
    + PP.reduce((a, b) => a + b, 0)
    + fair.penalty();

  let best = score;
  let bestAssign = snapshot(plan);
  const startScore = score;

  /* ---------- 1 手の適用と差分評価 ---------- */
  const applyCell = (sf, d, v) => {
    const oldV = getAssign(plan, sf.id, d);
    if (oldV === v) return null;

    const oldSP = SP.get(sf.id);
    const oldCP = CP[d], oldPP = PP[d];
    const oldFair = fair.penalty();
    const oldCount = counts.get(sf.id);

    setAssign(plan, sf.id, d, v);

    const newSP = staffPenalty(plan, sf, ctx);
    const newCP = coveragePenalty(plan, d, ctx);
    const newPP = pairPenalty(plan, d, ctx);
    const newCount = countsFor(plan, sf, ctx);
    fair.remove(oldCount);
    fair.add(newCount);
    const newFair = fair.penalty();

    const delta = (newSP - oldSP) + (newCP - oldCP) + (newPP - oldPP) + (newFair - oldFair);
    return {
      delta,
      commit() {
        SP.set(sf.id, newSP);
        CP[d] = newCP; PP[d] = newPP;
        counts.set(sf.id, newCount);
      },
      revert() {
        setAssign(plan, sf.id, d, oldV);
        fair.remove(newCount);
        fair.add(oldCount);
      },
    };
  };

  /* ---------- 焼きなまし ---------- */
  const coolRate = Math.pow(t1 / t0, 1 / iterations);
  let T = t0;
  for (let it = 0; it < iterations; it++) {
    T *= coolRate;

    if (rng.chance(0.65)) {
      /* 手 1: セルの値を変える */
      const { sf, d } = editable[rng.int(editable.length)];
      const cands = candCache.get(`${sf.id}:${d}`);
      const v = cands[rng.int(cands.length)];
      const move = applyCell(sf, d, v);
      if (!move) continue;
      if (move.delta <= 0 || rng.next() < Math.exp(-move.delta / T)) {
        move.commit();
        score += move.delta;
      } else {
        move.revert();
        continue;
      }
    } else {
      /* 手 2: 同じ日の二人を入れ替える（人数を保ったまま個人都合を直す） */
      const a = editable[rng.int(editable.length)];
      const d = a.d;
      const b = editable[rng.int(editable.length)];
      if (b.d !== d || b.sf.id === a.sf.id) continue;
      const va = getAssign(plan, a.sf.id, d);
      const vb = getAssign(plan, b.sf.id, d);
      if (va === vb) continue;
      // 相互に置けるか
      if (!candCache.get(`${a.sf.id}:${d}`).includes(vb)) continue;
      if (!candCache.get(`${b.sf.id}:${d}`).includes(va)) continue;

      const m1 = applyCell(a.sf, d, vb);
      if (!m1) continue;
      const m2 = applyCell(b.sf, d, va);
      if (!m2) { m1.revert(); continue; }
      const delta = m1.delta + m2.delta;
      if (delta <= 0 || rng.next() < Math.exp(-delta / T)) {
        m1.commit(); m2.commit();
        score += delta;
      } else {
        m2.revert(); m1.revert();
        continue;
      }
    }

    if (score < best) {
      best = score;
      bestAssign = snapshot(plan);
    }
    if (onProgress && it % 2000 === 0) onProgress(it / iterations, best);
  }

  restore(plan, bestAssign);
  return {
    score: best,
    startScore,
    iterations,
    elapsedMs: Date.now() - started,
    improved: best < startScore,
  };
}

/* ちょっとずつ実行して UI を固めない版 */
export async function solveAsync(plan, opts = {}) {
  const { iterations = 24000, chunk = 6000, onProgress } = opts;
  // 同期 solve をチャンクに割ると増分状態を持ち越せないので、
  // 反復回数を分割した「続けて焼く」方式にする：seed をずらして再加熱。
  let result = null;
  const rounds = Math.max(1, Math.ceil(iterations / chunk));
  for (let r = 0; r < rounds; r++) {
    result = solve(plan, {
      ...opts,
      iterations: chunk,
      seed: (opts.seed ?? 1) + r * 7919,
      t0: r === 0 ? (opts.t0 ?? 4000) : 400,   // 2 巡目以降は弱めに再加熱
      onProgress: null,
    });
    if (onProgress) onProgress((r + 1) / rounds, result.score);
    await new Promise(res => setTimeout(res, 0));
  }
  return result;
}

function snapshot(plan) {
  const out = {};
  for (const [sid, days] of Object.entries(plan.assign)) out[sid] = { ...days };
  return out;
}
function restore(plan, snap) {
  plan.assign = {};
  for (const [sid, days] of Object.entries(snap)) plan.assign[sid] = { ...days };
}
