import { RNG } from './rng.js';
import { makeProfile, coinWord, mutateForm, sampleSyl, demeName, wordToKana, formDistance } from './phonology.js';
import { Lexicon, mutualIntelligibility, _resetWordId } from './lexicon.js';
import { CONCEPTS, CONCEPT_IDS, conceptById, NEIGHBORS } from './meaning.js';
import { Chronicle, EV } from './chronicle.js';

/* ============================================================
   世界 — 言葉が無から生まれ、定着し、訛り、方言に分かれ、
   意味がずれ、死語になる。すべては「通じたか否か」が駆動する。
   1 step = 1 年。DOM を知らない。Node の中でも言語史は流れる。
   ============================================================ */

export const LIMITS = {
  MAX_DEMES: 14,
  SPLIT_POP: 320,
  MIN_POP: 28,
  EPISODES_PER_DEME: 6,    // 1 年あたりの発話機会
  CONTACT_RANGE: 26,       // 群どうしが言葉を交わす距離
};

export class World {
  constructor(seed = 1) {
    this.seed = seed >>> 0;
    this.rng = new RNG(this.seed ^ 0x10ec);
    this.year = 0;
    this.demes = [];
    this.demeById = new Map();
    this.nextDemeId = 1;
    this.demeCounter = 0;
    this.chronicle = new Chronicle();
    this.history = [];
    this.relevance = this._baseRelevance();   // 概念ごとの世界的な必要度
    this.event = null;                          // 進行中の世界事件
    _resetWordId(1);
    this._genesis();
  }

  _baseRelevance() {
    const r = {};
    for (const c of CONCEPTS) r[c.id] = c.pressure;
    return r;
  }

  _genesis() {
    // 最初のひと群。言葉をまだ持たない。
    const profile = makeProfile(this.rng);
    const d = this._makeDeme(profile, 100, 100, null);
    d.pop = 140;
    this.chronicle.add(this.year, EV.GENESIS,
      `${d.name}の民が現れた。まだ、ひとつの言葉も持たない。`, { demeId: d.id });
  }

  _makeDeme(profile, x, y, parent) {
    const id = this.nextDemeId++;
    const hue = (this.demeCounter++ * 79.5) % 360;
    const d = {
      id, profile,
      name: demeName(profile, this.rng),
      lexicon: parent ? parent.lexicon.clone() : new Lexicon(),
      x, y, hue,
      pop: 90,
      born: this.year,
      parent: parent ? parent.id : null,
      diedAt: null,
      driftStrength: 1,
      comStat: { success: 0, attempts: 0 },
    };
    this.demes.push(d);
    this.demeById.set(id, d);
    return d;
  }

  aliveDemes() { return this.demes.filter(d => d.diedAt === null); }

  /* ============================================================
     1 step = 1 年
     ============================================================ */
  step() {
    this.year++;
    this._worldEvent();

    for (const d of this.aliveDemes()) {
      d.comStat = { success: 0, attempts: 0 };
      for (let e = 0; e < LIMITS.EPISODES_PER_DEME; e++) {
        this._episode(d);
      }
      // 語彙の自然減衰と掃除
      const dead = d.lexicon.decay(0.012, this.year);
      for (const { conceptId, entry } of dead) {
        if (entry.uses > 5) {  // 一度根づいた語の死だけを記録（ノイズ抑制）
          this.chronicle.add(this.year, EV.DEATH,
            `${d.name}で「${wordToKana(entry.form)}」（${conceptById[conceptId].label}）が死語になった`,
            { demeId: d.id, conceptId, form: entry.form, x: d.x, y: d.y });
        }
      }
      if (this.year % 5 === 0) d.lexicon.prune(this.year);

      // 人口動態：よく通じ合う群ほど栄える（言語と生存の結びつき）
      this._population(d);
    }

    // 群どうしの接触（借用・収束）
    this._contacts();

    // 分裂と消滅
    this._splitAndDie();

    if (this.year % 2 === 0) this._sample();
  }

  /* 世界事件：ある概念の必要度を一時的に押し上げる。
     「捕食者の季節」には predator の語が急いで作られ、磨かれる。 */
  _worldEvent() {
    if (this.event) {
      this.event.years--;
      if (this.event.years <= 0) {
        this.relevance[this.event.concept] = conceptById[this.event.concept].pressure;
        this.event = null;
      }
    } else if (this.rng.chance(0.04)) {
      const c = this.rng.pick(CONCEPTS);
      this.event = { concept: c.id, years: 4 + this.rng.int(6) };
      this.relevance[c.id] = c.pressure * 3.2;
      const phrase = {
        predator: '捕食者の群れが現れた', food: '実りの季節がきた', water: '旱（ひでり）が続く',
        come: '群れが散り散りになった', mate: '繁殖の季節だ', kin: 'よそ者が増えた',
        good: '穏やかな日々', bad: '災いの年',
      }[c.id] || '何かが起きた';
      this.chronicle.add(this.year, EV.WORLDEVENT,
        `${phrase} — 「${c.label}」を伝える必要が高まる`, { conceptId: c.id });
    }
  }

  /* ----- 発話の一場面 ----- */
  _episode(d) {
    // どの概念を伝えるか（世界的必要度で重みづけ）
    const weights = CONCEPT_IDS.map(id => this.relevance[id]);
    const cid = CONCEPT_IDS[this.rng.weighted(weights)];
    const lex = d.lexicon;

    let entry = lex.chooseForm(cid, this.rng);
    d.comStat.attempts++;

    if (!entry) {
      // 言葉がない → その場で新語を発明する（言語の発生の瞬間）
      const form = coinWord(d.profile, this.rng);
      entry = lex.coin(cid, form, this.year);
      if (entry) {
        lex.reinforce(entry, 0.6, this.year);
        this.chronicle.add(this.year, EV.BIRTH,
          `${d.name}で「${wordToKana(form)}」が生まれた — ${conceptById[cid].label}を意味する`,
          { demeId: d.id, conceptId: cid, form, x: d.x, y: d.y });
      }
      return;
    }

    entry.uses++;
    // 通じる確率は語の定着度で決まる
    const p = entry.strength / (entry.strength + 0.9);
    if (this.rng.chance(p)) {
      // 通じた → 強化（言葉が約束として固まっていく）
      lex.reinforce(entry, 0.34, this.year);
      entry.success++;
      d.comStat.success++;
    } else {
      // 通じない → 三つの道
      const roll = this.rng.float();
      if (roll < 0.4) {
        // 新たな言い方を発明（同義語の競合が始まる）= ネオロジズムの誕生
        const form = coinWord(d.profile, this.rng);
        const ne = lex.coin(cid, form, this.year);
        if (ne) {
          lex.reinforce(ne, 0.5, this.year);
          const rival = entry.form;
          this.chronicle.add(this.year, EV.BIRTH,
            `${d.name}で${conceptById[cid].label}に新しい言い方「${wordToKana(form)}」が現れた（旧「${wordToKana(rival)}」と競う）`,
            { demeId: d.id, conceptId: cid, form, x: d.x, y: d.y });
        }
      } else if (roll < 0.7) {
        // 意味の取り違え → 近い概念へ流用され、語義がずれていく
        const neigh = NEIGHBORS[cid];
        if (neigh && neigh.length) {
          const ncid = this.rng.pick(neigh);
          const drifted = lex.coin(ncid, entry.form, this.year, entry.wid);
          if (drifted) {
            lex.reinforce(drifted, 0.4, this.year);
            this.chronicle.add(this.year, EV.SHIFT,
              `${d.name}で「${wordToKana(entry.form)}」が${conceptById[cid].label}から${conceptById[ncid].label}の意味へ滲み出した`,
              { demeId: d.id, conceptId: ncid, form: entry.form, x: d.x, y: d.y });
          }
        }
      } else {
        // 言い直しの中で音が訛る（音変化の芽）
        const nf = mutateForm(entry.form, this.rng, d.driftStrength);
        if (formDistance(nf, entry.form) > 0) {
          const ve = lex.coin(cid, nf, this.year, entry.wid);
          if (ve) lex.reinforce(ve, 0.45, this.year);
        }
      }
    }
  }

  _population(d) {
    const rate = d.comStat.attempts
      ? d.comStat.success / d.comStat.attempts : 0;
    // 通じ合う群は増え、言葉の通じない群は緩やかに縮む
    const cap = 360;
    let r = 0.04 * (rate - 0.45) + 0.012 * (1 - d.pop / cap);
    r += this.rng.gauss(0, 0.01);
    d.pop = Math.max(0, d.pop * (1 + r));
  }

  /* 群どうしが出会い、言葉を貸し借りする */
  _contacts() {
    const alive = this.aliveDemes();
    for (let i = 0; i < alive.length; i++) {
      for (let j = i + 1; j < alive.length; j++) {
        const A = alive[i], B = alive[j];
        const dx = A.x - B.x, dy = A.y - B.y;
        if (dx * dx + dy * dy > LIMITS.CONTACT_RANGE * LIMITS.CONTACT_RANGE) continue;
        if (!this.rng.chance(0.5)) continue;
        this._borrow(A, B);
        this._borrow(B, A);
      }
    }
  }

  /* A が B の優勢語をひとつ借りる（収束・借用） */
  _borrow(A, B) {
    const cid = this.rng.pick(CONCEPT_IDS);
    const bDom = B.lexicon.dominant(cid);
    if (!bDom) return;
    const aList = A.lexicon.entries(cid);
    // 既に持っていれば、その語を少し強めるだけ（収束）
    const have = aList.find(e => formDistance(e.form, bDom.form) === 0);
    if (have) { A.lexicon.reinforce(have, 0.2, this.year); return; }
    // A の語が弱いときだけ借りる（強い母語は守られる）
    const aDom = A.lexicon.dominant(cid);
    if (aDom && aDom.strength > 3.5) return;
    if (this.rng.chance(0.3)) {
      const loan = A.lexicon.coin(cid, bDom.form.slice(), this.year, bDom.wid);
      if (loan) {
        A.lexicon.reinforce(loan, 0.6, this.year);
        if (bDom.uses > 8) {
          this.chronicle.add(this.year, EV.BORROW,
            `${A.name}が${B.name}から「${wordToKana(bDom.form)}」（${conceptById[cid].label}）を借りた`,
            { demeId: A.id, conceptId: cid, form: bDom.form, x: A.x, y: A.y });
        }
      }
    }
  }

  _splitAndDie() {
    // 消滅（言語の死）
    for (const d of this.aliveDemes()) {
      if (d.pop < LIMITS.MIN_POP) {
        d.diedAt = this.year;
        const words = d.lexicon.size();
        this.chronicle.add(this.year, EV.DEMEDEATH,
          `${d.name}が絶え、${words}語の言葉とともに失われた`,
          { demeId: d.id, x: d.x, y: d.y });
      }
    }
    // 分裂（方言の誕生）
    const alive = this.aliveDemes();
    if (alive.length >= LIMITS.MAX_DEMES) return;
    for (const d of alive) {
      if (d.pop > LIMITS.SPLIT_POP && this.rng.chance(0.5)) {
        const ang = this.rng.float(0, Math.PI * 2);
        const dist = 18 + this.rng.float(0, 16);
        const x = Math.max(0, Math.min(200, d.x + Math.cos(ang) * dist));
        const y = Math.max(0, Math.min(200, d.y + Math.sin(ang) * dist));
        // 子は親の音素プロファイルを少し変えて受け継ぐ（訛りの素地）
        const profile = this._driftProfile(d.profile);
        const child = this._makeDeme(profile, x, y, d);
        child.pop = d.pop * 0.42;
        d.pop *= 0.58;
        child.driftStrength = 1.4;   // 分かれたては変化が速い
        this.chronicle.add(this.year, EV.SPLIT,
          `${d.name}から${child.name}が分かれた — やがて方言に育つ`,
          { demeId: child.id, x, y });
        break;
      }
    }
  }

  _driftProfile(profile) {
    const cw = profile.cw.slice(), vw = profile.vw.slice();
    for (let k = 0; k < 3; k++) {
      cw[this.rng.int(cw.length)] *= this.rng.float(0.4, 1.8);
      vw[this.rng.int(vw.length)] *= this.rng.float(0.6, 1.6);
    }
    return { cw, vw };
  }

  _sample() {
    const alive = this.aliveDemes();
    let words = 0, pop = 0, success = 0, attempts = 0;
    for (const d of alive) {
      words += d.lexicon.size();
      pop += d.pop;
      success += d.comStat.success;
      attempts += d.comStat.attempts;
    }
    this.history.push({
      year: this.year,
      demes: alive.length,
      words,
      pop: Math.round(pop),
      comprehension: attempts ? success / attempts : 0,
    });
    if (this.history.length > 1200) this.history.splice(0, this.history.length - 1200);
  }

  /* 二群の相互理解度（系統樹・方言判定に使う） */
  intelligibility(a, b) {
    return mutualIntelligibility(a.lexicon, b.lexicon);
  }

  /* ----- 保存と復元 ----- */
  serialize() {
    return {
      version: 1,
      seed: this.seed,
      year: this.year,
      nextDemeId: this.nextDemeId,
      demeCounter: this.demeCounter,
      relevance: this.relevance,
      event: this.event,
      demes: this.demes.map(d => ({
        id: d.id, name: d.name, profile: d.profile,
        x: d.x, y: d.y, hue: d.hue, pop: d.pop, born: d.born,
        parent: d.parent, diedAt: d.diedAt, driftStrength: d.driftStrength,
        lex: this._serializeLex(d.lexicon),
      })),
      chronicle: this.chronicle.entries.slice(-2500),
      history: this.history.slice(-800),
    };
  }

  _serializeLex(lex) {
    const out = {};
    for (const [cid, list] of lex.byConcept) {
      out[cid] = list.map(e => ({
        wid: e.wid, form: e.form, strength: e.strength, born: e.born,
        lastUsed: e.lastUsed, uses: e.uses, success: e.success, etymon: e.etymon,
      }));
    }
    return out;
  }

  static deserialize(data) {
    const w = Object.create(World.prototype);
    w.seed = data.seed;
    w.rng = new RNG((data.seed ^ (data.year * 2654435761)) >>> 0);
    w.year = data.year;
    w.nextDemeId = data.nextDemeId;
    w.demeCounter = data.demeCounter;
    w.relevance = data.relevance;
    w.event = data.event;
    w.demes = [];
    w.demeById = new Map();
    for (const dd of data.demes) {
      const lex = new Lexicon();
      for (const cid of CONCEPT_IDS) {
        lex.byConcept.set(cid, (dd.lex[cid] || []).map(e => ({ ...e, form: e.form.slice() })));
      }
      const d = {
        id: dd.id, name: dd.name, profile: dd.profile,
        x: dd.x, y: dd.y, hue: dd.hue, pop: dd.pop, born: dd.born,
        parent: dd.parent, diedAt: dd.diedAt, driftStrength: dd.driftStrength,
        lexicon: lex, comStat: { success: 0, attempts: 0 },
      };
      w.demes.push(d);
      w.demeById.set(d.id, d);
    }
    w.chronicle = new Chronicle();
    w.chronicle.entries = data.chronicle || [];
    w.history = data.history || [];
    return w;
  }
}
