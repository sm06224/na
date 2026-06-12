import { wordToKana, formDistance, mutateForm } from './phonology.js';
import { CONCEPT_IDS } from './meaning.js';

/* ============================================================
   語彙 — ひとつの群（deme）が共有する辞書。
   概念ごとに「語形の候補」を強度つきで持つ（競合する同義語）。
   話すたびに強い語が選ばれ、通じれば強まり、使われねば薄れる。
   これが言葉の生死を駆動する。
   ============================================================ */

let _wid = 1;
export function _resetWordId(v = 1) { _wid = v; }

/* 1 つの語の項目 */
function makeEntry(form, bornYear, etymon = null) {
  return {
    wid: _wid++,
    form,                 // 音節 id の配列
    strength: 1,          // 0 になると死語
    born: bornYear,
    lastUsed: bornYear,
    uses: 0,
    success: 0,
    etymon,               // 由来（親語の wid）。語源年表に使う
  };
}

export class Lexicon {
  constructor() {
    // conceptId -> Entry[]（強い順は都度ソートでなく選択時に評価）
    this.byConcept = new Map(CONCEPT_IDS.map(id => [id, []]));
  }

  entries(conceptId) { return this.byConcept.get(conceptId) || []; }

  allEntries() {
    const out = [];
    for (const list of this.byConcept.values()) out.push(...list);
    return out;
  }

  /* その概念の「今いちばん流通している語」 */
  dominant(conceptId) {
    const list = this.entries(conceptId);
    let best = null;
    for (const e of list) if (!best || e.strength > best.strength) best = e;
    return best;
  }

  /* 概念を言うために語を選ぶ。基本は最強だが、ゆらぎで弱い語も稀に出る
     （これが新語に活躍の機会を与える）。 */
  chooseForm(conceptId, rng) {
    const list = this.entries(conceptId);
    if (list.length === 0) return null;
    const weights = list.map(e => e.strength * e.strength + 0.02);
    return list[rng.weighted(weights)];
  }

  /* 新語を作って登録する（既存と被らなければ） */
  coin(conceptId, form, year, etymon = null) {
    const list = this.entries(conceptId);
    if (list.some(e => formDistance(e.form, form) === 0)) return null;
    const e = makeEntry(form, year, etymon);
    list.push(e);
    return e;
  }

  /* 語の強化／減衰 */
  reinforce(entry, amount, year) {
    entry.strength = Math.min(8, entry.strength + amount);
    entry.lastUsed = year;
  }

  /* 1 ステップの自然減衰と死語の掃除。返り値は死んだ語の配列。 */
  decay(rate, year, minStrength = 0.04) {
    const dead = [];
    for (const [cid, list] of this.byConcept) {
      for (let i = list.length - 1; i >= 0; i--) {
        const e = list[i];
        e.strength *= (1 - rate);
        if (e.strength < minStrength && list.length > 0) {
          list.splice(i, 1);
          dead.push({ conceptId: cid, entry: e, year });
        }
      }
    }
    return dead;
  }

  /* 同義語の淘汰：圧倒的な語があれば弱い同義語を吸収（語彙の整理）。 */
  prune(year) {
    const merged = [];
    for (const [, list] of this.byConcept) {
      if (list.length < 2) continue;
      const dom = list.reduce((a, b) => (a.strength > b.strength ? a : b));
      for (let i = list.length - 1; i >= 0; i--) {
        const e = list[i];
        if (e === dom) continue;
        // 強い語が弱い語を大きく上回り、似ていれば吸収
        if (dom.strength > e.strength * 4 && formDistance(dom.form, e.form) <= 1) {
          dom.strength = Math.min(8, dom.strength + e.strength * 0.5);
          list.splice(i, 1);
          merged.push(e);
        }
      }
    }
    return merged;
  }

  /* 群を分けるときの複製（方言の出発点） */
  clone() {
    const lex = new Lexicon();
    for (const [cid, list] of this.byConcept) {
      lex.byConcept.set(cid, list.map(e => ({ ...e, form: e.form.slice() })));
    }
    return lex;
  }

  /* 集計：生きている語の総数 */
  size() {
    let n = 0;
    for (const list of this.byConcept.values()) n += list.length;
    return n;
  }
}

/* 2 つの語彙の相互理解度（0..1）。方言が通じ合うかを測る。
   各概念の優勢語が、相手の優勢語とどれだけ近いか。 */
export function mutualIntelligibility(lexA, lexB) {
  let total = 0, score = 0;
  for (const cid of CONCEPT_IDS) {
    const a = lexA.dominant(cid), b = lexB.dominant(cid);
    if (!a || !b) continue;
    total++;
    const d = formDistance(a.form, b.form);
    const maxLen = Math.max(a.form.length, b.form.length, 1);
    score += Math.max(0, 1 - d / maxLen);
  }
  return total ? score / total : 1;
}
