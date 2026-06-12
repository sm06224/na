import { RNG } from './rng.js';
import { SpatialHash } from './spatialhash.js';
import { wrapDelta, wrapPos, wrapAngle, clamp } from './util.js';
import { BRAIN, randomGenome, mutate, geneticDistance, speciesName } from './genome.js';
import { Brain } from './brain.js';

/* ============================================================
   世界 — このファイルが宇宙の物理法則。
   DOM に依存しない。ブラウザでも Node でも同じ歴史が流れる。
   ============================================================ */

export const CFG = {
  WORLD: 4000,            // 一辺（トーラス）
  CELL: 100,              // 空間ハッシュのセル
  PLANT_CAP: 3000,        // 植物の上限
  PLANT_ENERGY: 42,       // 植物 1 株のエネルギー
  PLANT_GROWTH: 7,        // 1 ステップあたりの発芽試行回数
  INIT_PLANTS: 2200,
  INIT_CREATURES: 170,
  MAX_ENERGY: 320,
  START_ENERGY: 130,
  REPRO_ENERGY: 215,      // これを超えると分裂する
  REPRO_COST: 100,        // 親が失う量
  CHILD_ENERGY: 85,       // 子が受け取る量（差は出産の代謝損失）
  REPRO_COOLDOWN: 140,
  EAT_RADIUS: 11,
  ATTACK_REACH: 13,
  SPECIES_THRESHOLD: 0.62,// 遺伝距離がこれを超えたら新種
  RESCUE_POP: 12,         // これを割ると恵みの雨（新個体の放流）
  SAMPLE_EVERY: 24,       // 統計の記録間隔
};

let _nextId = 1;

export class Creature {
  constructor(genome, x, y, angle, energy, generation, speciesId) {
    this.id = _nextId++;
    this.genome = genome;
    this.brain = new Brain(genome.weights);
    this.x = x; this.y = y; this.angle = angle;
    this.energy = energy;
    this.age = 0;
    this.generation = generation;
    this.speciesId = speciesId;
    this.cooldown = 0;
    this.speedNow = 0;
    this.maxAge = 2300 + genome.size * 900;
    this.alive = true;
  }
}

export class World {
  constructor(seed = 1) {
    this.seed = seed >>> 0;
    this.rng = new RNG(this.seed);
    this.step_ = 0;
    this.plants = [];          // {x, y}
    this.creatures = [];
    this.species = new Map();  // id -> {name, founder, hue, emergedAt, extinctAt, parent}
    this.nextSpeciesId = 1;
    this.events = [];          // {step, text, kind}
    this.history = [];         // 統計サンプル
    this.maxGeneration = 1;
    this.plantGrowth = CFG.PLANT_GROWTH;

    this.creatureHash = new SpatialHash(CFG.WORLD, CFG.CELL);
    this.plantHash = new SpatialHash(CFG.WORLD, CFG.CELL);
    this._buf = [];

    this._makeFertility();
    this._genesis();
  }

  /* 土地の肥沃度マップ — 世界に「地理」を与える。
     肥沃な土地は楽園になり、不毛の地は回廊になる。 */
  _makeFertility() {
    const N = this.fertN = 28;
    const raw = [];
    for (let i = 0; i < N * N; i++) raw.push(this.rng.float());
    // 近傍平均で 2 回ならして、なだらかな大陸を作る
    let f = raw;
    for (let pass = 0; pass < 2; pass++) {
      const g = new Array(N * N);
      for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
        let s = 0;
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
          s += f[((y + dy + N) % N) * N + ((x + dx + N) % N)];
        }
        g[y * N + x] = s / 9;
      }
      f = g;
    }
    // コントラストを上げる（楽園と荒野の差をはっきりと）
    let lo = 1, hi = 0;
    for (const v of f) { if (v < lo) lo = v; if (v > hi) hi = v; }
    this.fertility = f.map(v => {
      const t = (v - lo) / (hi - lo + 1e-9);
      return 0.06 + 0.94 * t * t;
    });
  }

  fertAt(x, y) {
    const N = this.fertN;
    const gx = Math.floor(wrapPos(x, CFG.WORLD) / CFG.WORLD * N) % N;
    const gy = Math.floor(wrapPos(y, CFG.WORLD) / CFG.WORLD * N) % N;
    return this.fertility[gy * N + gx];
  }

  _genesis() {
    for (let i = 0; i < CFG.INIT_PLANTS; i++) this._trySpawnPlant(3);
    for (let i = 0; i < CFG.INIT_CREATURES; i++) {
      this._spawnRandomCreature();
    }
    this._log('創世 — 無から世界が立ち上がった', 'genesis');
  }

  _spawnRandomCreature() {
    const g = randomGenome(this.rng);
    const sp = this._foundSpecies(g, null);
    const c = new Creature(
      g,
      this.rng.float(0, CFG.WORLD), this.rng.float(0, CFG.WORLD),
      this.rng.float(-Math.PI, Math.PI),
      CFG.START_ENERGY, 1, sp);
    this.creatures.push(c);
    return c;
  }

  _foundSpecies(genome, parentSpeciesId) {
    const id = this.nextSpeciesId++;
    this.species.set(id, {
      id,
      name: speciesName(this.rng),
      founder: { ...genome, weights: genome.weights.slice() },
      hue: genome.hue,
      emergedAt: this.step_,
      extinctAt: null,
      parent: parentSpeciesId,
    });
    return id;
  }

  _trySpawnPlant(attempts = 1) {
    for (let i = 0; i < attempts; i++) {
      if (this.plants.length >= CFG.PLANT_CAP) return;
      const x = this.rng.float(0, CFG.WORLD);
      const y = this.rng.float(0, CFG.WORLD);
      if (this.rng.chance(this.fertAt(x, y))) {
        this.plants.push({ x, y });
        return;
      }
    }
  }

  _log(text, kind = 'info') {
    this.events.push({ step: this.step_, text, kind });
    if (this.events.length > 400) this.events.splice(0, this.events.length - 400);
  }

  /* ---------- 1 ステップ = この宇宙の 1 拍 ---------- */
  step() {
    this.step_++;
    const W = CFG.WORLD;

    // この拍が始まる時点で生きている種を記録（絶滅判定の基準）
    const before = new Set();
    for (const c of this.creatures) before.add(c.speciesId);

    // 植物の発芽
    this._trySpawnPlant(this.plantGrowth);

    // 空間ハッシュの再構築
    this.creatureHash.clear();
    for (const c of this.creatures) this.creatureHash.insert(c);
    this.plantHash.clear();
    for (const p of this.plants) this.plantHash.insert(p);

    const births = [];
    const buf = this._buf;

    for (const c of this.creatures) {
      if (!c.alive) continue;
      const g = c.genome;

      /* ---- 知覚 ---- */
      const inputs = this._sense(c, buf);

      /* ---- 思考 ---- */
      const out = c.brain.forward(inputs);

      /* ---- 行動 ---- */
      c.angle = wrapAngle(c.angle + out[0] * 0.22);
      const thrust = (out[1] + 1) * 0.5;            // 0..1
      const v = thrust * 2.4 * g.speed;
      c.speedNow = v;
      c.x = wrapPos(c.x + Math.cos(c.angle) * v, W);
      c.y = wrapPos(c.y + Math.sin(c.angle) * v, W);

      /* ---- 食べる：植物 ---- */
      const eatR = CFG.EAT_RADIUS * g.size;
      this.plantHash.query(c.x, c.y, eatR, buf);
      for (const p of buf) {
        if (p._eaten) continue;
        const dx = wrapDelta(c.x, p.x, W), dy = wrapDelta(c.y, p.y, W);
        if (dx * dx + dy * dy < eatR * eatR) {
          p._eaten = true;
          c.energy += CFG.PLANT_ENERGY * (1 - g.diet * 0.85);
          break; // 1 ステップに 1 株まで
        }
      }

      /* ---- 食べる：捕食（肉食寄りの個体のみ） ---- */
      if (g.diet > 0.25) {
        const reach = CFG.ATTACK_REACH * g.size;
        this.creatureHash.query(c.x, c.y, reach, buf);
        for (const o of buf) {
          if (o === c || !o.alive) continue;
          if (g.size < o.genome.size * 1.08) continue;     // 自分より明確に小さい相手だけ
          if (o.speciesId === c.speciesId) continue;       // 同種は襲わない
          const dx = wrapDelta(c.x, o.x, W), dy = wrapDelta(c.y, o.y, W);
          if (dx * dx + dy * dy < reach * reach) {
            const dmg = 14 * g.diet;
            o.energy -= dmg;
            c.energy += dmg * 0.85 * g.diet;
            break;
          }
        }
      }

      /* ---- 代謝（生きているだけでコストがかかる） ---- */
      c.energy -= 0.135 * g.size
        + thrust * thrust * 0.42 * g.size * g.speed
        + g.vision * 0.00055
        + 0.02;
      c.energy = Math.min(c.energy, CFG.MAX_ENERGY);
      c.age++;
      if (c.cooldown > 0) c.cooldown--;

      /* ---- 繁殖（分裂と写し間違い） ---- */
      if (c.energy > CFG.REPRO_ENERGY && c.cooldown === 0 && c.age > 100) {
        c.energy -= CFG.REPRO_COST;
        c.cooldown = CFG.REPRO_COOLDOWN;
        const childGenome = mutate(g, this.rng);
        let sp = c.speciesId;
        const founder = this.species.get(sp).founder;
        if (geneticDistance(childGenome, founder) > CFG.SPECIES_THRESHOLD) {
          sp = this._foundSpecies(childGenome, c.speciesId);
          const pName = this.species.get(c.speciesId).name;
          const nName = this.species.get(sp).name;
          this._log(`新種誕生 — ${nName}（${pName} から分かれた）`, 'emerge');
        }
        const child = new Creature(
          childGenome,
          wrapPos(c.x + this.rng.gauss(0, 14), W),
          wrapPos(c.y + this.rng.gauss(0, 14), W),
          this.rng.float(-Math.PI, Math.PI),
          CFG.CHILD_ENERGY, c.generation + 1, sp);
        if (child.generation > this.maxGeneration) this.maxGeneration = child.generation;
        births.push(child);
      }

      /* ---- 死 ---- */
      if (c.energy <= 0 || c.age > c.maxAge) {
        c.alive = false;
        // 屍は土に還る — 死んだ場所に植物が芽吹く（物質循環）
        const drop = c.age > c.maxAge ? 2 : 1;
        for (let i = 0; i < drop; i++) {
          if (this.plants.length < CFG.PLANT_CAP) {
            this.plants.push({
              x: wrapPos(c.x + this.rng.gauss(0, 20), W),
              y: wrapPos(c.y + this.rng.gauss(0, 20), W),
            });
          }
        }
      }
    }

    // 食べられた植物・死んだ個体を除去
    if (this.plants.some(p => p._eaten)) {
      this.plants = this.plants.filter(p => !p._eaten);
    }
    this.creatures = this.creatures.filter(c => c.alive);
    for (const b of births) this.creatures.push(b);

    // 絶滅の検出
    const after = new Set();
    for (const c of this.creatures) after.add(c.speciesId);
    for (const id of before) {
      if (!after.has(id)) {
        const sp = this.species.get(id);
        if (sp && sp.extinctAt === null) {
          sp.extinctAt = this.step_;
          const lived = this.step_ - sp.emergedAt;
          this._log(`絶滅 — ${sp.name}（${lived} 拍を生きた）`, 'extinct');
        }
      }
    }

    // 恵みの雨 — 世界が死に絶えそうなら、新しい生命を降らせる
    if (this.creatures.length < CFG.RESCUE_POP) {
      for (let i = 0; i < 42; i++) this._spawnRandomCreature();
      this._log('恵みの雨 — 新しい生命が降りそそいだ', 'rain');
    }

    // 統計
    if (this.step_ % CFG.SAMPLE_EVERY === 0) this._sample();
  }

  /* 知覚：視野を RAYS 本の扇に割り、レイごとに
     {植物 / 獲物 / 脅威} の最も近い気配を 0..1 で感じる */
  _sense(c, buf) {
    const g = c.genome;
    const W = CFG.WORLD;
    const R = BRAIN.RAYS;
    const inputs = new Array(BRAIN.INPUTS).fill(0);
    const range = g.vision;
    const half = g.fov / 2;

    this.plantHash.query(c.x, c.y, range, buf);
    for (const p of buf) {
      const dx = wrapDelta(c.x, p.x, W), dy = wrapDelta(c.y, p.y, W);
      const d2 = dx * dx + dy * dy;
      if (d2 > range * range || d2 === 0) continue;
      const rel = wrapAngle(Math.atan2(dy, dx) - c.angle);
      if (Math.abs(rel) > half) continue;
      const ray = Math.min(R - 1, Math.floor((rel + half) / g.fov * R));
      const sig = 1 - Math.sqrt(d2) / range;
      if (sig > inputs[ray]) inputs[ray] = sig;
    }

    this.creatureHash.query(c.x, c.y, range, buf);
    for (const o of buf) {
      if (o === c) continue;
      const dx = wrapDelta(c.x, o.x, W), dy = wrapDelta(c.y, o.y, W);
      const d2 = dx * dx + dy * dy;
      if (d2 > range * range || d2 === 0) continue;
      const rel = wrapAngle(Math.atan2(dy, dx) - c.angle);
      if (Math.abs(rel) > half) continue;
      const ray = Math.min(R - 1, Math.floor((rel + half) / g.fov * R));
      const sig = 1 - Math.sqrt(d2) / range;
      // 自分より小さければ「獲物」、大きく肉食寄りなら「脅威」
      if (o.genome.size * 1.08 < g.size) {
        if (sig > inputs[R + ray]) inputs[R + ray] = sig;
      } else if (o.genome.size > g.size * 1.08 && o.genome.diet > 0.25) {
        if (sig > inputs[R * 2 + ray]) inputs[R * 2 + ray] = sig;
      }
    }

    inputs[R * 3] = c.energy / CFG.MAX_ENERGY;
    inputs[R * 3 + 1] = c.speedNow / (2.4 * 1.7);
    return inputs;
  }

  _sample() {
    const counts = new Map();
    for (const c of this.creatures) {
      counts.set(c.speciesId, (counts.get(c.speciesId) || 0) + 1);
    }
    const top = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
    this.history.push({
      step: this.step_,
      pop: this.creatures.length,
      plants: this.plants.length,
      speciesAlive: counts.size,
      maxGen: this.maxGeneration,
      top,
    });
    if (this.history.length > 800) this.history.splice(0, this.history.length - 800);
  }

  /* ---------- 保存と復元（世界をひとつの JSON に畳む） ---------- */
  serialize() {
    return {
      version: 1,
      seed: this.seed,
      step: this.step_,
      nextSpeciesId: this.nextSpeciesId,
      maxGeneration: this.maxGeneration,
      plantGrowth: this.plantGrowth,
      fertility: this.fertility,
      fertN: this.fertN,
      plants: this.plants.map(p => [Math.round(p.x * 10) / 10, Math.round(p.y * 10) / 10]),
      creatures: this.creatures.map(c => ({
        g: c.genome, x: c.x, y: c.y, a: c.angle,
        e: c.energy, age: c.age, gen: c.generation, sp: c.speciesId, cd: c.cooldown,
      })),
      species: [...this.species.values()],
      events: this.events.slice(-100),
      history: this.history.slice(-300),
    };
  }

  static deserialize(data) {
    const w = Object.create(World.prototype);
    w.seed = data.seed;
    // 復元後の乱数列は保存時の続きではないが、ステップ数で撹拌して再現性を保つ
    w.rng = new RNG((data.seed ^ (data.step * 2654435761)) >>> 0);
    w.step_ = data.step;
    w.nextSpeciesId = data.nextSpeciesId;
    w.maxGeneration = data.maxGeneration;
    w.plantGrowth = data.plantGrowth ?? CFG.PLANT_GROWTH;
    w.fertility = data.fertility;
    w.fertN = data.fertN;
    w.plants = data.plants.map(([x, y]) => ({ x, y }));
    w.species = new Map(data.species.map(s => [s.id, s]));
    w.events = data.events || [];
    w.history = data.history || [];
    w.creatureHash = new SpatialHash(CFG.WORLD, CFG.CELL);
    w.plantHash = new SpatialHash(CFG.WORLD, CFG.CELL);
    w._buf = [];
    w.creatures = data.creatures.map(d => {
      const c = new Creature(d.g, d.x, d.y, d.a, d.e, d.gen, d.sp);
      c.age = d.age; c.cooldown = d.cd;
      return c;
    });
    return w;
  }
}
