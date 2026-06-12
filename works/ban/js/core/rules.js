import {
  OFF, EMPTY, getAssign, canWork, requestOf, requiredOn,
  shiftStartMin, shiftEndAbsMin, shiftIsNight, autoTargetPerMonth,
  planDays, planWeekday,
} from './model.js';
import { restBetween, weekIndexOf, isWeekend } from './time.js';

/* ============================================================
   ルール — シフト表の良し悪しを数で語る。
   hard 違反（法・約束に関わる）は巨大な罰、soft は好みの濃淡。
   ソルバはこの合計を最小化し、検証パネルは内訳を表示する。
   ============================================================ */

export const W = {
  HARD: 10000,        // hard 違反 1 件あたり
  SHORT: 3000,        // 必要人数の不足 1 人あたり（法令系 hard よりは軽い）
  EXCESS: 500,        // 過剰配置 1 人あたり（人件費）
  TARGET: 55,         // 月の出勤目標からのずれ 1 日あたり
  WANT: 150,          // 希望シフトが通らなかった
  LONE: 30,           // 飛び石休（出・休・出）
  CHURN: 8,           // 隣接日でシフト種別が変わる
  TOGETHER: 50,       // 組ませたいペアが同日別シフト
  APART_SOFT: 400,    // 離したいペア（soft 設定時）が同じシフト
  FAIR_TOTAL: 6,      // 出勤数のばらつき（分散に掛ける）
  FAIR_WE: 10,        // 土日出勤のばらつき
  FAIR_NIGHT: 14,     // 夜勤数のばらつき
};

/* ---------- 評価コンテキスト（1 回だけ作って使い回す） ---------- */
export function buildCtx(plan) {
  const days = planDays(plan);
  const weekdays = [0];
  for (let d = 1; d <= days; d++) weekdays[d] = planWeekday(plan, d);
  const shiftById = new Map(plan.shiftTypes.map(s => [s.id, s]));
  const nightSet = new Set(plan.shiftTypes.filter(shiftIsNight).map(s => s.id));
  const startMin = new Map(plan.shiftTypes.map(s => [s.id, shiftStartMin(s)]));
  const endAbs = new Map(plan.shiftTypes.map(s => [s.id, shiftEndAbsMin(s)]));
  return {
    days, weekdays, shiftById, nightSet, startMin, endAbs,
    autoTarget: autoTargetPerMonth(plan),
    rules: plan.rules,
  };
}

const isWork = v => v !== OFF && v !== EMPTY;

/* ============================================================
   スタッフ単位の評価。
   collect に配列を渡すと violations を積む（UI 用）。
   返り値はペナルティ合計。
   ============================================================ */
export function staffPenalty(plan, staff, ctx, collect = null) {
  const { days, weekdays, shiftById, nightSet, startMin, endAbs, rules } = ctx;
  let pen = 0;
  const add = (p, level, day, msg, rule) => {
    pen += p;
    if (collect) collect.push({ rule, level, staffId: staff.id, day, msg, penalty: p });
  };

  const maxConsec = staff.maxConsecutive ?? rules.maxConsecutive;
  const maxNights = staff.maxNightPerMonth ?? rules.maxNightPerMonth;
  const target = staff.targetPerMonth ?? ctx.autoTarget;

  let run = 0;            // 連勤
  let nightRun = 0;       // 夜勤の連続
  let nights = 0;         // 月の夜勤数
  let workTotal = 0;
  const weekCount = new Map();

  let prev = EMPTY;       // 前日の割当

  /* 前月末からの引き継ぎ：月初の連勤・夜勤連続・インターバルを正しく判定する。
     （月の夜勤回数・出勤数のカウントには含めない） */
  const tail = plan.prevTail?.[staff.id];
  if (tail && tail.length) {
    for (const tv of tail) {
      const w = isWork(tv);
      run = w ? run + 1 : 0;
      nightRun = (w && nightSet.has(tv)) ? nightRun + 1 : 0;
      prev = tv;
    }
  }
  for (let d = 1; d <= days; d++) {
    const v = getAssign(plan, staff.id, d);
    const working = isWork(v);
    const req = requestOf(staff, d);

    /* --- 希望（休み希望は絶対） --- */
    if (req) {
      if (req.kind === 'off' && working) {
        add(W.HARD, 'hard', d, `${staff.name}: ${d}日は休み希望なのに勤務`, 'request-off');
      } else if (req.kind === 'ng' && v === req.shiftId) {
        const st = shiftById.get(req.shiftId);
        add(W.HARD, 'hard', d, `${staff.name}: ${d}日の${st?.name ?? '?'}は不可希望`, 'request-ng');
      } else if (req.kind === 'want' && v !== req.shiftId) {
        const st = shiftById.get(req.shiftId);
        add(W.WANT, 'soft', d, `${staff.name}: ${d}日の${st?.name ?? '?'}希望が通っていない`, 'request-want');
      }
    }

    /* --- 担当できないシフト --- */
    if (working && !canWork(staff, v)) {
      const st = shiftById.get(v);
      add(W.HARD, 'hard', d, `${staff.name}: ${st?.name ?? '?'}は担当外（${d}日）`, 'skill');
    }

    /* --- 連勤 --- */
    if (working) {
      run++;
      if (run > maxConsec) {
        add(W.HARD, 'hard', d, `${staff.name}: ${run}連勤（上限 ${maxConsec}）`, 'consecutive');
      }
    } else run = 0;

    /* --- 夜勤の連続・回数 --- */
    if (working && nightSet.has(v)) {
      nights++;
      nightRun++;
      if (nightRun > rules.maxNightStreak) {
        add(W.HARD, 'hard', d, `${staff.name}: 夜勤${nightRun}連続（上限 ${rules.maxNightStreak}）`, 'night-streak');
      }
      if (nights > maxNights) {
        add(W.HARD, 'hard', d, `${staff.name}: 月${nights}回目の夜勤（上限 ${maxNights}）`, 'night-monthly');
      }
    } else if (working) nightRun = 0;
    /* 休みは夜勤連続を切る */
    if (!working) nightRun = 0;

    /* --- 勤務間インターバル（前日→当日） --- */
    if (working && isWork(prev)) {
      const rest = restBetween(endAbs.get(prev) ?? 1080, startMin.get(v) ?? 540, 1);
      const need = rules.minRestHours * 60;
      if (rest < need) {
        const pn = shiftById.get(prev), cn = shiftById.get(v);
        add(W.HARD, 'hard', d,
          `${staff.name}: ${d - 1}日${pn?.name ?? '?'}→${d}日${cn?.name ?? '?'} 休息${Math.max(0, Math.floor(rest / 60))}h（${rules.minRestHours}h 必要）`,
          'rest');
      }
    }

    /* --- 週の上限 --- */
    if (working) {
      workTotal++;
      const wk = weekIndexOf(plan.year, plan.month, d);
      const c = (weekCount.get(wk) || 0) + 1;
      weekCount.set(wk, c);
      if (staff.maxPerWeek !== null && staff.maxPerWeek !== undefined && c > staff.maxPerWeek) {
        add(W.HARD, 'hard', d, `${staff.name}: 週${c}日勤務（上限 ${staff.maxPerWeek}）`, 'weekly');
      }
    }

    /* --- 飛び石休（出・休・出） --- */
    if (rules.forbidLoneOff && d >= 2 && d < days) {
      // 評価は v が「休」の日に行う
      if (!working && v === OFF && isWork(prev)) {
        const next = getAssign(plan, staff.id, d + 1);
        if (isWork(next)) {
          add(W.LONE, 'soft', d, `${staff.name}: ${d}日が飛び石休`, 'lone-off');
        }
      }
    }

    /* --- シフト種別の入れ替わり（パターン安定の好み） --- */
    if (rules.preferStablePattern && working && isWork(prev) && prev !== v) {
      add(W.CHURN, 'soft', d, '', 'churn');
    }

    prev = v;
  }

  /* --- 月の出勤目標とのずれ（±1 日は許容） --- */
  const dev = Math.abs(workTotal - target);
  if (dev > 1) {
    add(W.TARGET * (dev - 1), 'soft', null,
      `${staff.name}: 出勤${workTotal}日（目標 ${target}日）`, 'target');
  }

  return pen;
}

/* ============================================================
   日単位の評価：必要人数の過不足
   ============================================================ */
export function coveragePenalty(plan, day, ctx, collect = null) {
  const wd = ctx.weekdays[day];
  let pen = 0;
  for (const st of plan.shiftTypes) {
    const req = requiredOn(st, day, wd);
    let got = 0;
    for (const sf of plan.staff) {
      if (getAssign(plan, sf.id, day) === st.id) got++;
    }
    if (got < req) {
      const p = W.SHORT * (req - got);
      pen += p;
      if (collect) collect.push({
        rule: 'coverage-short', level: 'short', day, shiftId: st.id,
        msg: `${day}日 ${st.name}: ${got}/${req} 人（${req - got} 人不足）`, penalty: p,
      });
    } else if (got > req) {
      const p = W.EXCESS * (got - req);
      pen += p;
      if (collect) collect.push({
        rule: 'coverage-excess', level: 'soft', day, shiftId: st.id,
        msg: `${day}日 ${st.name}: ${got}/${req} 人（${got - req} 人過剰）`, penalty: p,
      });
    }
  }
  return pen;
}

/* ============================================================
   日単位の評価：ペア制約
   ============================================================ */
export function pairPenalty(plan, day, ctx, collect = null) {
  let pen = 0;
  for (const pr of plan.pairs) {
    const va = getAssign(plan, pr.a, day);
    const vb = getAssign(plan, pr.b, day);
    const aw = isWork(va), bw = isWork(vb);
    if (pr.type === 'apart') {
      if (aw && bw && va === vb) {
        const p = pr.hard ? W.HARD : W.APART_SOFT;
        pen += p;
        if (collect) {
          const an = plan.staff.find(s => s.id === pr.a)?.name ?? '?';
          const bn = plan.staff.find(s => s.id === pr.b)?.name ?? '?';
          collect.push({
            rule: 'pair-apart', level: pr.hard ? 'hard' : 'soft', day,
            msg: `${day}日: ${an} と ${bn} が同じシフト（離す設定）`, penalty: p,
          });
        }
      }
    } else { /* together: 同日に働くなら同じシフトが望ましい */
      if (aw && bw && va !== vb) {
        pen += W.TOGETHER;
        if (collect) {
          const an = plan.staff.find(s => s.id === pr.a)?.name ?? '?';
          const bn = plan.staff.find(s => s.id === pr.b)?.name ?? '?';
          collect.push({
            rule: 'pair-together', level: 'soft', day,
            msg: `${day}日: ${an} と ${bn} が別シフト（組ませる設定）`, penalty: W.TOGETHER,
          });
        }
      }
    }
  }
  return pen;
}

/* ============================================================
   公平性 — 「あの人ばかり土日休み」をなくす。
   counts: 各スタッフの {total, weekend, night} 配列。
   分散（×重み）をペナルティにする。
   ============================================================ */
export function fairnessPenalty(counts, rules, collect = null) {
  let pen = 0;
  const variance = arr => {
    if (arr.length < 2) return 0;
    const sum = arr.reduce((a, b) => a + b, 0);
    const sumsq = arr.reduce((a, b) => a + b * b, 0);
    return Math.max(0, sumsq - (sum * sum) / arr.length);
  };
  if (rules.fairTotals) {
    const v = variance(counts.map(c => c.total));
    pen += W.FAIR_TOTAL * v;
    if (collect && v > counts.length) collect.push({
      rule: 'fair-total', level: 'soft',
      msg: `出勤日数に偏りがある（分散 ${v.toFixed(1)}）`, penalty: W.FAIR_TOTAL * v,
    });
  }
  if (rules.fairWeekends) {
    const v = variance(counts.map(c => c.weekend));
    pen += W.FAIR_WE * v;
    if (collect && v > counts.length) collect.push({
      rule: 'fair-weekend', level: 'soft',
      msg: `土日出勤に偏りがある（分散 ${v.toFixed(1)}）`, penalty: W.FAIR_WE * v,
    });
  }
  if (rules.fairNights) {
    const v = variance(counts.map(c => c.night));
    pen += W.FAIR_NIGHT * v;
    if (collect && v > counts.length) collect.push({
      rule: 'fair-night', level: 'soft',
      msg: `夜勤回数に偏りがある（分散 ${v.toFixed(1)}）`, penalty: W.FAIR_NIGHT * v,
    });
  }
  return pen;
}

/* スタッフごとの実績カウント（公平性・統計に使う） */
export function countsFor(plan, staff, ctx) {
  const { days, weekdays, nightSet } = ctx;
  const c = { total: 0, weekend: 0, night: 0, minutes: 0 };
  for (let d = 1; d <= days; d++) {
    const v = getAssign(plan, staff.id, d);
    if (!isWork(v)) continue;
    c.total++;
    if (isWeekend(weekdays[d])) c.weekend++;
    if (nightSet.has(v)) c.night++;
    const st = ctx.shiftById.get(v);
    if (st) c.minutes += (ctx.endAbs.get(v) - ctx.startMin.get(v)) - (st.breakMin || 0);
  }
  return c;
}
