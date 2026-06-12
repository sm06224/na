import { ITEMS, CATS } from './items.js';

/* ============================================================
   計算 — 家族構成 × 日数 → 我が家の備蓄リスト。
   DOM を知らない。Node でも同じリストが出る。
   ============================================================ */

export const DEFAULT_PROFILE = {
  adults: 2,    // 大人（中学生以上〜64歳）
  children: 0,  // 子ども（小学生以下、乳幼児を除く）
  infants: 0,   // 乳幼児（0〜2歳ごろ）
  elderly: 0,   // 高齢の家族（65歳〜）
  females: 0,   // 生理用品を使う人
  pets: 0,      // ペット（犬・猫など）
  days: 7,      // 備える日数（最低3日・推奨7日）
};

export function normalizeProfile(p = {}) {
  const out = { ...DEFAULT_PROFILE, ...p };
  for (const k of Object.keys(DEFAULT_PROFILE)) {
    out[k] = Math.max(0, Math.min(99, Math.floor(Number(out[k]) || 0)));
  }
  if (out.days < 1) out.days = 1;
  return out;
}

export function totalPeople(p) {
  return p.adults + p.children + p.infants + p.elderly;
}

/* 1 品目の必要量 */
export function quantity(item, profile) {
  const p = normalizeProfile(profile);
  let q = 0;
  if (item.per) {
    q += (item.per.adult || 0) * p.adults
       + (item.per.child || 0) * p.children
       + (item.per.infant || 0) * p.infants
       + (item.per.elderly || 0) * p.elderly
       + (item.per.female || 0) * p.females
       + (item.per.pet || 0) * p.pets;
    if (item.per.daily) q *= p.days;
  }
  if (item.fixed && totalPeople(p) > 0) q += item.fixed;
  return Math.ceil(q);
}

/* 全品目を分類ごとに。数量 0 の品目と、該当者のいない分類は出さない */
export function buildList(profile) {
  const p = normalizeProfile(profile);
  const out = [];
  for (const cat of CATS) {
    if (cat.need && p[cat.need] <= 0) continue;
    const items = [];
    for (const item of ITEMS) {
      if (item.cat !== cat.id) continue;
      const qty = quantity(item, p);
      if (qty <= 0) continue;
      items.push({ ...item, qty });
    }
    if (items.length) out.push({ ...cat, items });
  }
  return out;
}

/* 備え率：チェック済み品目数 / 全品目数（checked は id の集合） */
export function progress(list, checked) {
  let total = 0, done = 0;
  for (const cat of list) {
    for (const item of cat.items) {
      total++;
      if (checked.has(item.id)) done++;
    }
  }
  return { total, done, rate: total ? done / total : 0 };
}

/* 印刷・共有用のテキスト書き出し */
export function listToText(list, profile) {
  const p = normalizeProfile(profile);
  const who = [];
  if (p.adults) who.push(`大人${p.adults}`);
  if (p.children) who.push(`子ども${p.children}`);
  if (p.infants) who.push(`乳幼児${p.infants}`);
  if (p.elderly) who.push(`高齢の家族${p.elderly}`);
  if (p.pets) who.push(`ペット${p.pets}`);
  const lines = [
    `# 我が家の備蓄リスト（${who.join('・')}／${p.days}日分）`,
    '',
  ];
  for (const cat of list) {
    lines.push(`## ${cat.label}`);
    for (const item of cat.items) {
      lines.push(`[ ] ${item.name} … ${item.qty}${item.unit}`);
    }
    lines.push('');
  }
  lines.push('数量は公的な目安（農林水産省・内閣府・東京都・環境省）に基づく概算です。');
  return lines.join('\n');
}
