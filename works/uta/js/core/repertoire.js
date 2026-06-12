import { melodyDistance, memorability } from './scale.js';
import { OCCASION_IDS } from './occasions.js';

/* ============================================================
   持ち歌 — ひとつの群（flock）が共有する歌の蔵。
   場ごとに「節の候補」を愛され度つきで持つ（競合する歌）。
   歌うたびに強い歌が選ばれ、胸に残れば強まり、歌われねば薄れる。
   これが歌の生死を駆動する。
   ============================================================ */

let _sid = 1;
export function _resetSongId(v = 1) { _sid = v; }

/* 1 つの歌の項目 */
function makeSong(melody, bornYear, origin = null) {
  return {
    sid: _sid++,
    melody,               // 音符 id の配列
    mem: memorability(melody),   // 覚えやすさ（節は不変なので持ち越せる）
    strength: 1,          // 愛され度。0 になると忘れられる
    born: bornYear,
    lastSung: bornYear,
    sings: 0,
    moved: 0,             // 胸に残った回数
    origin,               // 由来（親歌の sid）。歌の系譜に使う
  };
}

export class Repertoire {
  constructor() {
    // occasionId -> Song[]
    this.byOccasion = new Map(OCCASION_IDS.map(id => [id, []]));
  }

  entries(occasionId) { return this.byOccasion.get(occasionId) || []; }

  allSongs() {
    const out = [];
    for (const list of this.byOccasion.values()) out.push(...list);
    return out;
  }

  /* その場で「今いちばん愛されている歌」 */
  dominant(occasionId) {
    const list = this.entries(occasionId);
    let best = null;
    for (const s of list) if (!best || s.strength > best.strength) best = s;
    return best;
  }

  /* 歌う歌を選ぶ。愛され、かつ口に残る歌ほど座に出やすい。
     ゆらぎで新しい歌にも出番がある。 */
  choose(occasionId, rng) {
    const list = this.entries(occasionId);
    if (list.length === 0) return null;
    const weights = list.map(s => (s.strength * s.strength + 0.02) * (0.4 + s.mem));
    return list[rng.weighted(weights)];
  }

  /* 新しい歌を蔵に入れる（既存の節と被らなければ）。
     蔵には限りがある — 溢れたら、いちばん愛されていない歌が場所を譲る。 */
  coin(occasionId, melody, year, origin = null) {
    const list = this.entries(occasionId);
    if (list.some(s => melodyDistance(s.melody, melody) === 0)) return null;
    if (list.length >= 12) {
      let wi = 0;
      for (let i = 1; i < list.length; i++) if (list[i].strength < list[wi].strength) wi = i;
      list.splice(wi, 1);
    }
    const s = makeSong(melody, year, origin);
    list.push(s);
    return s;
  }

  /* 歌の強化／減衰 */
  reinforce(song, amount, year) {
    song.strength = Math.min(8, song.strength + amount);
    song.lastSung = year;
  }

  /* 1 ステップの自然減衰と忘却の掃除。覚えやすい歌ほど忘れられにくい
     （これがフックへの淘汰圧の片翼）。返り値は忘れられた歌の配列。 */
  decay(rate, year, minStrength = 0.04) {
    const dead = [];
    for (const [oid, list] of this.byOccasion) {
      for (let i = list.length - 1; i >= 0; i--) {
        const s = list[i];
        s.strength *= (1 - rate * (1.35 - 0.85 * s.mem));
        if (s.strength < minStrength) {
          list.splice(i, 1);
          dead.push({ occasionId: oid, song: s, year });
        }
      }
    }
    return dead;
  }

  /* 似た歌の淘汰：圧倒的な歌があれば、よく似た弱い歌を吸収する。 */
  prune() {
    const merged = [];
    for (const [, list] of this.byOccasion) {
      if (list.length < 2) continue;
      const dom = list.reduce((a, b) => (a.strength > b.strength ? a : b));
      for (let i = list.length - 1; i >= 0; i--) {
        const s = list[i];
        if (s === dom) continue;
        if (dom.strength > s.strength * 4 && melodyDistance(dom.melody, s.melody) <= 2) {
          dom.strength = Math.min(8, dom.strength + s.strength * 0.5);
          list.splice(i, 1);
          merged.push(s);
        }
      }
    }
    return merged;
  }

  /* 旅立ちの口承の細り（創始者効果）：分かれて出てゆく群は、
     すべての歌い手を連れて行けない。歌は一部しか渡らず、渡った歌も
     うろ覚えになる。ここから方言は始まる。 */
  bottleneck(rng, keep = 0.75, dim = 0.55) {
    for (const [, list] of this.byOccasion) {
      for (let i = list.length - 1; i >= 0; i--) {
        if (!rng.chance(keep)) { list.splice(i, 1); continue; }
        list[i].strength *= dim;
      }
    }
  }

  /* 群を分けるときの複製（節回しの方言の出発点） */
  clone() {
    const rep = new Repertoire();
    for (const [oid, list] of this.byOccasion) {
      rep.byOccasion.set(oid, list.map(s => ({ ...s, melody: s.melody.slice() })));
    }
    return rep;
  }

  /* 集計：覚えられている歌の総数 */
  size() {
    let n = 0;
    for (const list of this.byOccasion.values()) n += list.length;
    return n;
  }
}

/* 2 つの群の歌がどれだけ響き合うか（0..1）。
   各場の最愛の歌が、相手のそれとどれだけ近いか。方言判定に使う。 */
export function mutualResonance(repA, repB) {
  let total = 0, score = 0;
  for (const oid of OCCASION_IDS) {
    const a = repA.dominant(oid), b = repB.dominant(oid);
    if (!a || !b) continue;
    total++;
    const d = melodyDistance(a.melody, b.melody);
    const maxLen = Math.max(a.melody.length, b.melody.length, 1);
    score += Math.max(0, 1 - d / maxLen);
  }
  return total ? score / total : 1;
}
