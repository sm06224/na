import { makePlan, makeShiftType, makeStaff, makePair } from './model.js';

/* ============================================================
   デモデータ — 小さな介護施設のひと月（12 人・4 シフト）。
   はじめて開いた人が 1 クリックで全機能を試せるように。
   ============================================================ */

export function demoPlan(year, month) {
  const early = makeShiftType({
    id: 'st-early', name: '早番', short: '早', color: '#e8b14f',
    start: '07:00', end: '16:00', breakMin: 60,
    required: [2, 2, 2, 2, 2, 2, 2],
  });
  const day = makeShiftType({
    id: 'st-day', name: '日勤', short: '日', color: '#6aa3d8',
    start: '09:00', end: '18:00', breakMin: 60,
    required: [2, 3, 3, 3, 3, 3, 2],
  });
  const late = makeShiftType({
    id: 'st-late', name: '遅番', short: '遅', color: '#a48ad4',
    start: '11:00', end: '20:00', breakMin: 60,
    required: [2, 2, 2, 2, 2, 2, 2],
  });
  const night = makeShiftType({
    id: 'st-night', name: '夜勤', short: '夜', color: '#5a6e8c',
    start: '16:00', end: '09:00', breakMin: 120,
    required: [1, 1, 1, 1, 1, 1, 1],
  });

  const all = ['st-early', 'st-day', 'st-late', 'st-night'];
  const noNight = ['st-early', 'st-day', 'st-late'];

  const staff = [
    makeStaff({ id: 'sf-01', name: '佐藤', canWork: all }),
    makeStaff({ id: 'sf-02', name: '鈴木', canWork: all }),
    makeStaff({ id: 'sf-03', name: '高橋', canWork: all }),
    makeStaff({ id: 'sf-04', name: '田中', canWork: all }),
    makeStaff({ id: 'sf-05', name: '伊藤', canWork: all }),
    makeStaff({ id: 'sf-06', name: '渡辺', canWork: noNight, memo: '夜勤不可' }),
    makeStaff({ id: 'sf-07', name: '山本', canWork: noNight, memo: '夜勤不可' }),
    makeStaff({ id: 'sf-08', name: '中村', canWork: all }),
    makeStaff({
      id: 'sf-09', name: '小林', canWork: noNight,
      maxPerWeek: 4, targetPerMonth: 14, memo: 'パート（週4まで）',
    }),
    makeStaff({
      id: 'sf-10', name: '加藤', canWork: ['st-day', 'st-late'],
      maxPerWeek: 3, targetPerMonth: 11, memo: 'パート（週3・日勤遅番のみ）',
    }),
    makeStaff({ id: 'sf-11', name: '吉田', canWork: all, memo: '新人' }),
    makeStaff({ id: 'sf-12', name: '山田', canWork: all, memo: 'リーダー' }),
  ];

  /* 希望休のサンプル（給料日後の週末などそれっぽく） */
  staff[0].requests = { 3: 'off', 4: 'off' };
  staff[1].requests = { 10: 'off', 25: 'off' };
  staff[2].requests = { 15: 'off' };
  staff[4].requests = { 7: 'off', 8: 'off', 9: 'off' };   // 3 連休の希望
  staff[6].requests = { 1: 'off', 22: 'off' };
  staff[8].requests = { 5: 'off', 12: 'off', 19: 'off', 26: 'off' };
  staff[10].requests = { 14: 'want:st-day' };             // 研修日は日勤希望

  const pairs = [
    /* 新人の吉田はリーダーの山田となるべく同じシフトに */
    makePair({ type: 'together', a: 'sf-11', b: 'sf-12', hard: false }),
  ];

  const now = new Date();
  return makePlan({
    title: 'デモ：あおぞら介護',
    year: year ?? now.getFullYear(),
    month: month ?? (now.getMonth() + 1),
    shiftTypes: [early, day, late, night],
    staff,
    pairs,
  });
}
