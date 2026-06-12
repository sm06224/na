import { RNG } from './rng.js';
import {
  makeStyle, coinMelody, varyMelody, melodyDistance, melodyToKana, memorability,
} from './scale.js';
/* memorability は deserialize（保存形式に mem を持たない）でのみ直接使う */
import { Repertoire, mutualResonance, _resetSongId } from './repertoire.js';
import { OCCASIONS, OCCASION_IDS, occasionById, NEIGHBORS } from './occasions.js';
import { Chronicle, EV } from './chronicle.js';

/* ============================================================
   世界 — 歌が無から生まれ、胸に残った節だけが受け継がれ、
   変奏され、群を越えて流行し、忘れられる。
   すべては「もう一度歌いたくなったか否か」が駆動する。
   1 step = 1 年。DOM を知らない。Node の中でも歌は流れる。
   ============================================================ */

export const LIMITS = {
  MAX_FLOCKS: 14,
  SPLIT_POP: 320,
  MIN_POP: 28,
  EPISODES_PER_FLOCK: 6,   // 1 年あたりの歌の座
  CONTACT_RANGE: 26,       // 群どうしの歌が届く距離
};

/* 群の名前（旋律とは別の、ただの呼び名） */
const NAME_SYL = [
  'ア', 'イ', 'ウ', 'エ', 'オ', 'カ', 'キ', 'ク', 'コ', 'サ', 'シ', 'ス', 'セ',
  'タ', 'チ', 'ツ', 'テ', 'ト', 'ナ', 'ニ', 'ヌ', 'ネ', 'ハ', 'ヒ', 'フ', 'ホ',
  'マ', 'ミ', 'ム', 'メ', 'モ', 'ヤ', 'ユ', 'ヨ', 'ラ', 'リ', 'ル', 'レ', 'ロ', 'ワ',
];
function flockName(rng) {
  let s = '';
  const n = 2 + rng.int(2);
  for (let i = 0; i < n; i++) s += rng.pick(NAME_SYL);
  return s;
}

export class World {
  constructor(seed = 1) {
    this.seed = seed >>> 0;
    this.rng = new RNG(this.seed ^ 0x07a0);
    this.year = 0;
    this.flocks = [];
    this.flockById = new Map();
    this.nextFlockId = 1;
    this.flockCounter = 0;
    this.chronicle = new Chronicle();
    this.history = [];
    this.relevance = this._baseRelevance();   // 場ごとの世界的な切実さ
    this.event = null;                         // 進行中の世界事件
    _resetSongId(1);
    this._genesis();
  }

  _baseRelevance() {
    const r = {};
    for (const o of OCCASIONS) r[o.id] = o.pressure;
    return r;
  }

  _genesis() {
    // 最初のひと群。歌をまだ知らない。
    const style = makeStyle(this.rng);
    const f = this._makeFlock(style, 100, 100, null);
    f.pop = 140;
    this.chronicle.add(this.year, EV.GENESIS,
      `${f.name}の民が現れた。まだ、ひとつの歌も知らない。`, { flockId: f.id });
  }

  _makeFlock(style, x, y, parent) {
    const id = this.nextFlockId++;
    const hue = (this.flockCounter++ * 79.5) % 360;
    const f = {
      id, style,
      name: flockName(this.rng),
      repertoire: parent ? parent.repertoire.clone() : new Repertoire(),
      x, y, hue,
      pop: 90,
      born: this.year,
      parent: parent ? parent.id : null,
      diedAt: null,
      driftStrength: 1,
      singStat: { moved: 0, attempts: 0 },
    };
    this.flocks.push(f);
    this.flockById.set(id, f);
    return f;
  }

  aliveFlocks() { return this.flocks.filter(f => f.diedAt === null); }

  /* ============================================================
     1 step = 1 年
     ============================================================ */
  step() {
    this.year++;
    this._worldEvent();

    for (const f of this.aliveFlocks()) {
      f.singStat = { moved: 0, attempts: 0 };
      for (let e = 0; e < LIMITS.EPISODES_PER_FLOCK; e++) {
        this._episode(f);
      }
      // 歌の自然減衰と忘却
      const dead = f.repertoire.decay(0.012, this.year);
      for (const { occasionId, song } of dead) {
        if (song.sings > 5) {  // 一度根づいた歌の忘却だけを記録（ノイズ抑制）
          this.chronicle.add(this.year, EV.DEATH,
            `${f.name}の民から「${melodyToKana(song.melody)}」（${occasionById[occasionId].label}）が忘れられた — 最後の歌い手が逝った`,
            { flockId: f.id, occasionId, melody: song.melody, x: f.x, y: f.y });
        }
      }
      if (this.year % 5 === 0) f.repertoire.prune();

      // 人口動態：よく歌が心に残る群ほど栄える（歌と結束の結びつき）
      this._population(f);
    }

    // 群どうしの接触（歌の流行・伝播）
    this._contacts();

    // 分派と沈黙
    this._splitAndDie();

    if (this.year % 2 === 0) this._sample();
  }

  /* 世界事件：ある場の切実さを一時的に押し上げる。
     旱の年には雨乞歌が急いで生まれ、磨かれる。 */
  _worldEvent() {
    if (this.event) {
      this.event.years--;
      if (this.event.years <= 0) {
        this.relevance[this.event.occasion] = occasionById[this.event.occasion].pressure;
        this.event = null;
      }
    } else if (this.rng.chance(0.04)) {
      const o = this.rng.pick(OCCASIONS);
      this.event = { occasion: o.id, years: 4 + this.rng.int(6) };
      this.relevance[o.id] = o.pressure * 3.2;
      const phrase = {
        lull: '夜泣きの冬がきた', work: '大きな普請が始まった', dirge: '疫病が群れを撫でた',
        feast: '豊作の年だ', love: '繁殖の季節だ', rain: '旱（ひでり）が続く',
        road: '群れが長い旅に出る', saga: '忘れてはならぬことが起きた',
      }[o.id] || '何かが起きた';
      this.chronicle.add(this.year, EV.WORLDEVENT,
        `${phrase} — 「${o.label}」が求められる`, { occasionId: o.id });
    }
  }

  /* ----- 歌の座の一場面 ----- */
  _episode(f) {
    // どの場で歌うか（世界的な切実さで重みづけ）
    const weights = OCCASION_IDS.map(id => this.relevance[id]);
    const oid = OCCASION_IDS[this.rng.weighted(weights)];
    const rep = f.repertoire;

    let song = rep.choose(oid, this.rng);
    f.singStat.attempts++;

    if (!song) {
      // 歌がない → その場で節が生まれる（音楽の発生の瞬間）
      const mel = coinMelody(f.style, this.rng);
      song = rep.coin(oid, mel, this.year);
      if (song) {
        rep.reinforce(song, 0.6, this.year);
        this.chronicle.add(this.year, EV.BIRTH,
          `${f.name}の民に「${melodyToKana(mel)}」が生まれた — ${occasionById[oid].label}`,
          { flockId: f.id, occasionId: oid, melody: mel, x: f.x, y: f.y });
      }
      return;
    }

    song.sings++;
    // 胸に残る確率は、愛され度 × 覚えやすさ。
    // ここに「フックのある節ほど生き残る」という音楽の淘汰圧が宿る。
    const p = (song.strength / (song.strength + 0.9)) * (0.5 + 0.5 * song.mem);
    if (this.rng.chance(p)) {
      // 残った → 強化（歌が群れの宝になっていく）
      rep.reinforce(song, 0.34, this.year);
      song.moved++;
      f.singStat.moved++;
    } else {
      // 残らない → 三つの道
      const roll = this.rng.float();
      if (roll < 0.45) {
        // 節回しを変えて歌い直す（変奏の誕生）
        const nm = varyMelody(song.melody, this.rng, f.driftStrength);
        if (melodyDistance(nm, song.melody) > 0) {
          const ve = rep.coin(oid, nm, this.year, song.sid);
          if (ve) {
            rep.reinforce(ve, 0.5, this.year);
            if (song.sings > 6 && ve.mem > song.mem + 0.1) {
              this.chronicle.add(this.year, EV.VAR,
                `${f.name}の民が「${melodyToKana(song.melody)}」を「${melodyToKana(nm)}」と歌い替えた — 前より口に残る`,
                { flockId: f.id, occasionId: oid, melody: nm, x: f.x, y: f.y });
            }
          }
        }
      } else if (roll < 0.62) {
        // まったく新しい歌が試される（競合の始まり）
        const mel = coinMelody(f.style, this.rng);
        const ne = rep.coin(oid, mel, this.year);
        if (ne) {
          rep.reinforce(ne, 0.5, this.year);
          this.chronicle.add(this.year, EV.BIRTH,
            `${f.name}の民の${occasionById[oid].label}に新しい節「${melodyToKana(mel)}」が現れた（旧「${melodyToKana(song.melody)}」と競う）`,
            { flockId: f.id, occasionId: oid, melody: mel, x: f.x, y: f.y });
        }
      } else if (roll < 0.78) {
        // 転用 → 近い場へ移されて、歌の役目がずれていく
        const neigh = NEIGHBORS[oid];
        if (neigh && neigh.length) {
          const noid = this.rng.pick(neigh);
          const drifted = rep.coin(noid, song.melody.slice(), this.year, song.sid);
          if (drifted) {
            rep.reinforce(drifted, 0.4, this.year);
            if (song.sings > 6) {
              this.chronicle.add(this.year, EV.SHIFT,
                `${f.name}の民の「${melodyToKana(song.melody)}」が${occasionById[oid].label}から${occasionById[noid].label}へ転じた`,
                { flockId: f.id, occasionId: noid, melody: song.melody, x: f.x, y: f.y });
            }
          }
        }
      }
      // else: その夜の歌は、ただ座に響かなかった
    }
  }

  _population(f) {
    const rate = f.singStat.attempts
      ? f.singStat.moved / f.singStat.attempts : 0;
    // 歌が心を結ぶ群は増え、歌の冷めた群は緩やかに縮む
    const cap = 360;
    let r = 0.04 * (rate - 0.45) + 0.012 * (1 - f.pop / cap);
    r += this.rng.gauss(0, 0.01);
    f.pop = Math.max(0, f.pop * (1 + r));
  }

  /* 群どうしが出会い、歌が旅をする */
  _contacts() {
    const alive = this.aliveFlocks();
    for (let i = 0; i < alive.length; i++) {
      for (let j = i + 1; j < alive.length; j++) {
        const A = alive[i], B = alive[j];
        const dx = A.x - B.x, dy = A.y - B.y;
        if (dx * dx + dy * dy > LIMITS.CONTACT_RANGE * LIMITS.CONTACT_RANGE) continue;
        if (!this.rng.chance(0.5)) continue;
        this._spread(A, B);
        this._spread(B, A);
      }
    }
  }

  /* B の愛唱歌が A へ渡る（流行）。覚えやすい歌ほど遠くまで旅をする。 */
  _spread(A, B) {
    const oid = this.rng.pick(OCCASION_IDS);
    const bDom = B.repertoire.dominant(oid);
    if (!bDom) return;
    const aList = A.repertoire.entries(oid);
    // 既に同じ節を知っていれば、その歌を少し強めるだけ（共鳴）
    const have = aList.find(s => melodyDistance(s.melody, bDom.melody) === 0);
    if (have) { A.repertoire.reinforce(have, 0.2, this.year); return; }
    // A の愛唱歌が強いときは入り込めない（土着の歌は守られる）
    const aDom = A.repertoire.dominant(oid);
    if (aDom && aDom.strength > 3.5) return;
    if (this.rng.chance(0.12 + 0.3 * bDom.mem)) {
      // 旅の途中で、節は土地の歌い口に馴染む（訛って取り入れられる）
      let mel = bDom.melody.slice();
      if (this.rng.chance(0.6)) mel = varyMelody(mel, this.rng, A.driftStrength);
      const sp = A.repertoire.coin(oid, mel, this.year, bDom.sid);
      if (sp) {
        A.repertoire.reinforce(sp, 0.6, this.year);
        if (bDom.sings > 6) {
          this.chronicle.add(this.year, EV.SPREAD,
            `「${melodyToKana(bDom.melody)}」（${occasionById[oid].label}）が${B.name}から${A.name}へ渡った — 歌は群れを越える`,
            { flockId: A.id, occasionId: oid, melody: mel, x: A.x, y: A.y });
        }
      }
    }
  }

  _splitAndDie() {
    // 沈黙（群の消滅とともに、その歌も失われる）
    for (const f of this.aliveFlocks()) {
      if (f.pop < LIMITS.MIN_POP) {
        f.diedAt = this.year;
        const songs = f.repertoire.size();
        this.chronicle.add(this.year, EV.FLOCKDEATH,
          `${f.name}の民が絶え、${songs}の歌が二度と歌われなくなった`,
          { flockId: f.id, x: f.x, y: f.y });
      }
    }
    // 分派（節回しの方言の誕生）
    const alive = this.aliveFlocks();
    if (alive.length >= LIMITS.MAX_FLOCKS) return;
    for (const f of alive) {
      if (f.pop > LIMITS.SPLIT_POP && this.rng.chance(0.5)) {
        const ang = this.rng.float(0, Math.PI * 2);
        const dist = 18 + this.rng.float(0, 16);
        const x = Math.max(0, Math.min(200, f.x + Math.cos(ang) * dist));
        const y = Math.max(0, Math.min(200, f.y + Math.sin(ang) * dist));
        // 子は親の歌い口を少し変えて受け継ぐ（節回しの訛りの素地）
        const style = this._driftStyle(f.style);
        const child = this._makeFlock(style, x, y, f);
        // 旅立つ群は、すべての歌い手を連れて行けない（創始者効果）
        child.repertoire.bottleneck(this.rng);
        child.pop = f.pop * 0.42;
        f.pop *= 0.58;
        child.driftStrength = 1.4;   // 分かれたては節が揺れやすい
        this.chronicle.add(this.year, EV.SPLIT,
          `${f.name}の民から${child.name}の民が分かれた — やがて違う節回しに育つ`,
          { flockId: child.id, x, y });
        break;
      }
    }
  }

  _driftStyle(style) {
    const reg = style.reg.slice(), dur = style.dur.slice();
    for (let k = 0; k < 3; k++) {
      reg[this.rng.int(reg.length)] *= this.rng.float(0.4, 1.8);
      dur[this.rng.int(dur.length)] *= this.rng.float(0.6, 1.6);
    }
    const leap = Math.max(0.05, Math.min(0.5, style.leap * this.rng.float(0.7, 1.4)));
    return { reg, dur, leap };
  }

  _sample() {
    const alive = this.aliveFlocks();
    let songs = 0, pop = 0, moved = 0, attempts = 0;
    let catchSum = 0, catchN = 0;
    for (const f of alive) {
      songs += f.repertoire.size();
      pop += f.pop;
      moved += f.singStat.moved;
      attempts += f.singStat.attempts;
      for (const oid of OCCASION_IDS) {
        const d = f.repertoire.dominant(oid);
        if (d) { catchSum += d.mem; catchN++; }
      }
    }
    this.history.push({
      year: this.year,
      flocks: alive.length,
      songs,
      pop: Math.round(pop),
      resonance: attempts ? moved / attempts : 0,
      catchiness: catchN ? catchSum / catchN : 0,   // 愛唱歌の覚えやすさの平均
    });
    if (this.history.length > 1200) this.history.splice(0, this.history.length - 1200);
  }

  /* 二群の歌の響き合い（系統樹・方言判定に使う） */
  resonance(a, b) {
    return mutualResonance(a.repertoire, b.repertoire);
  }

  /* ----- 保存と復元 ----- */
  serialize() {
    return {
      version: 1,
      seed: this.seed,
      year: this.year,
      nextFlockId: this.nextFlockId,
      flockCounter: this.flockCounter,
      relevance: this.relevance,
      event: this.event,
      flocks: this.flocks.map(f => ({
        id: f.id, name: f.name, style: f.style,
        x: f.x, y: f.y, hue: f.hue, pop: f.pop, born: f.born,
        parent: f.parent, diedAt: f.diedAt, driftStrength: f.driftStrength,
        rep: this._serializeRep(f.repertoire),
      })),
      chronicle: this.chronicle.entries.slice(-2500),
      history: this.history.slice(-800),
    };
  }

  _serializeRep(rep) {
    const out = {};
    for (const [oid, list] of rep.byOccasion) {
      out[oid] = list.map(s => ({
        sid: s.sid, melody: s.melody, strength: s.strength, born: s.born,
        lastSung: s.lastSung, sings: s.sings, moved: s.moved, origin: s.origin,
      }));
    }
    return out;
  }

  static deserialize(data) {
    const w = Object.create(World.prototype);
    w.seed = data.seed;
    w.rng = new RNG((data.seed ^ (data.year * 2654435761)) >>> 0);
    w.year = data.year;
    w.nextFlockId = data.nextFlockId;
    w.flockCounter = data.flockCounter;
    w.relevance = data.relevance;
    w.event = data.event;
    w.flocks = [];
    w.flockById = new Map();
    for (const ff of data.flocks) {
      const rep = new Repertoire();
      for (const oid of OCCASION_IDS) {
        rep.byOccasion.set(oid, (ff.rep[oid] || []).map(s =>
          ({ ...s, melody: s.melody.slice(), mem: memorability(s.melody) })));
      }
      const f = {
        id: ff.id, name: ff.name, style: ff.style,
        x: ff.x, y: ff.y, hue: ff.hue, pop: ff.pop, born: ff.born,
        parent: ff.parent, diedAt: ff.diedAt, driftStrength: ff.driftStrength,
        repertoire: rep, singStat: { moved: 0, attempts: 0 },
      };
      w.flocks.push(f);
      w.flockById.set(f.id, f);
    }
    w.chronicle = new Chronicle();
    w.chronicle.entries = data.chronicle || [];
    w.history = data.history || [];
    return w;
  }
}
