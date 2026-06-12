import { RNG } from './rng.js';
import { generateTerrain, WATER, SIZE } from './terrain.js';
import { findPath } from './pathfind.js';
import { Chronicle, KIND } from './chronicle.js';
import { Settlement } from './settlement.js';
import { Nation } from './nation.js';
import { placeName, rulerName, nationName, wonderName } from './names.js';
import { techGain, eraForTech, maxEra, ERAS } from './tech.js';
import { rebuildTrade, tradeDiplomacy } from './trade.js';
import { stepDiplomacy, relationKey, checkFallen } from './war.js';
import { stepDisasters } from './disaster.js';

/* ============================================================
   世界 — 1 step = 1 か月。文明は勝手に興り、勝手に滅びる。
   このファイルも DOM を知らない。歴史は Node の中でも流れる。
   ============================================================ */

export const LIMITS = {
  MAX_SETTLEMENTS: 220,
  SETTLER_MIN_POP: 600,
  SETTLER_CAP_FRAC: 0.55,
  NATION_POP: 900,
  MIN_SETTLE_DIST: 7,
};

export class World {
  constructor(seed = 1) {
    this.seed = seed >>> 0;
    this.rng = new RNG(this.seed ^ 0x5151);
    this.terrain = generateTerrain(this.seed);

    const total = SIZE * SIZE;
    this.road = new Uint8Array(total);
    this.owner = new Int16Array(total);      // 0 = 無主
    this.claimDist = new Float32Array(total);

    this.year = 1;
    this.month = 0;
    this.totalMonths = 0;
    this.climate = 1;
    this.famineLogged = false;

    this.settlements = [];
    this.settlementById = new Map();
    this.nations = new Map();
    this.relations = new Map();
    this.tradePairs = [];
    this.chronicle = new Chronicle();
    this.history = [];

    this.nextSettlementId = 1;
    this.nextNationId = 1;
    this.nationCount = 0;
    this.plagueCooldownUntil = 0;
    this.territoryDirty = true;
    this.roadsDirty = true;
    this.lastFrictions = new Map();

    this._genesis();
  }

  /* ---------- 創世：最初の民が良い土地を探す ---------- */
  _genesis() {
    const sites = [];
    for (let tries = 0; tries < 1200 && sites.length < 200; tries++) {
      const i = this.rng.int(SIZE * SIZE);
      const sc = this._siteScore(i);
      if (sc > 8) sites.push({ i, sc });
    }
    sites.sort((a, b) => b.sc - a.sc);
    const chosen = [];
    for (const s of sites) {
      if (chosen.length >= 6) break;
      const x = s.i % SIZE, y = (s.i / SIZE) | 0;
      if (chosen.every(c => (c.x - x) ** 2 + (c.y - y) ** 2 > 22 * 22)) {
        chosen.push({ x, y });
      }
    }
    this.chronicle.add(1, KIND.GENESIS,
      `${chosen.length}つの民が、水辺を目指して歩きはじめた`);
    for (const c of chosen) this._found(c.x, c.y, null);
  }

  /* ---------- 土地の評価 ---------- */
  fertAround(x, y, r = 3) {
    const t = this.terrain;
    let sum = 0;
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= SIZE || ny >= SIZE) continue;
        sum += t.fert[ny * SIZE + nx];
      }
    }
    return sum;
  }

  _siteScore(i) {
    const t = this.terrain;
    if (t.water[i] !== WATER.LAND) return -Infinity;
    const x = i % SIZE, y = (i / SIZE) | 0;
    for (const s of this.settlements) {
      const d2 = (s.x - x) ** 2 + (s.y - y) ** 2;
      if (d2 < LIMITS.MIN_SETTLE_DIST ** 2) return -Infinity;
    }
    let sc = this.fertAround(x, y, 3);
    // 真水と海への近さは別格の価値を持つ
    let fresh = false, coast = false;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= SIZE || ny >= SIZE) continue;
      const j = ny * SIZE + nx;
      if (t.river[j] || t.water[j] === WATER.LAKE) fresh = true;
      if (t.water[j] === WATER.OCEAN) coast = true;
    }
    if (fresh) sc += 4;
    if (coast) sc += 2;
    return sc;
  }

  _found(x, y, mother) {
    const id = this.nextSettlementId++;
    const s = new Settlement(id, placeName(this.rng), x, y, this.year,
      this.fertAround(x, y, 3));
    if (mother) {
      s.nationId = mother.nationId;
      s.pop = 110;
      mother.pop -= 130;
      mother.lastSettler = this.year;
    }
    this.settlements.push(s);
    this.settlementById.set(id, s);

    const t = this.terrain;
    const i = y * SIZE + x;
    let where = `${s.name}の地に`;
    if (t.river[i] || this._nearRiver(x, y)) where = '川のほとりに';
    else if (this._nearCoast(x, y)) where = '海辺に';
    this.chronicle.add(this.year, KIND.FOUND,
      `${where}集落${s.name}が興る`, { cityId: id, x, y });

    // 母都市から道を引く
    if (mother) this._buildRoad(mother, s);
    this.territoryDirty = true;
    return s;
  }

  _nearRiver(x, y) {
    const t = this.terrain;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= SIZE || ny >= SIZE) continue;
      const j = ny * SIZE + nx;
      if (t.river[j] || t.water[j] === WATER.LAKE) return true;
    }
    return false;
  }
  _nearCoast(x, y) {
    const t = this.terrain;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= SIZE || ny >= SIZE) continue;
      if (t.water[ny * SIZE + nx] === WATER.OCEAN) return true;
    }
    return false;
  }

  _buildRoad(a, b) {
    const from = a.y * SIZE + a.x, to = b.y * SIZE + b.x;
    const path = findPath(this.terrain, this.road, from, to);
    if (path && path.length < 120) {
      for (const i of path) this.road[i] = 1;
      this.roadsDirty = true;
    }
  }

  aliveNations() {
    return [...this.nations.values()].filter(n => n.fallenAt === null);
  }

  adjustRelation(a, b, delta) {
    const key = relationKey(a, b);
    let rel = this.relations.get(key);
    if (!rel) { rel = { val: 0, war: false, score: 0, since: 0 }; this.relations.set(key, rel); }
    rel.val = Math.max(-100, Math.min(100, rel.val + delta));
  }

  worldEra() {
    let e = 0;
    for (const n of this.aliveNations()) e = Math.max(e, n.era);
    return e;
  }

  /* ============================================================
     1 step = 1 か月
     ============================================================ */
  step() {
    this.totalMonths++;
    this.month++;

    /* ---- 月次：人口と入植 ---- */
    for (const s of this.settlements) {
      const n = this.nations.get(s.nationId);
      const era = n ? n.era : 0;
      s.stepMonth(era, this.climate, s.plagueUntil > this.totalMonths);

      // 満ちた都市は入植隊を送り出す
      if (this.settlements.length < LIMITS.MAX_SETTLEMENTS &&
          s.pop > LIMITS.SETTLER_MIN_POP &&
          s.pop > s.cap(era, this.climate) * LIMITS.SETTLER_CAP_FRAC &&
          this.year - s.lastSettler > 6 &&
          this.rng.chance(0.05)) {
        this._sendSettlers(s);
      }
    }

    if (this.month >= 12) {
      this.month = 0;
      this.year++;
      this._yearEnd();
    }
  }

  _sendSettlers(mother) {
    let best = -1, bestScore = 6; // 最低限の良さは要求する
    for (let k = 0; k < 60; k++) {
      const ang = this.rng.float(0, Math.PI * 2);
      const dist = this.rng.float(9, 30);
      const x = Math.round(mother.x + Math.cos(ang) * dist);
      const y = Math.round(mother.y + Math.sin(ang) * dist);
      if (x < 1 || y < 1 || x >= SIZE - 1 || y >= SIZE - 1) continue;
      const i = y * SIZE + x;
      const sc = this._siteScore(i);
      if (sc > bestScore) { bestScore = sc; best = i; }
    }
    if (best >= 0) {
      this._found(best % SIZE, (best / SIZE) | 0, mother);
    } else {
      mother.lastSettler = this.year; // 良地なし。しばらく諦める
    }
  }

  /* ============================================================
     年次処理 — 外交、戦争、技術、王、災い
     ============================================================ */
  _yearEnd() {
    const rng = this.rng;

    /* ---- 気候のゆらぎ ---- */
    this.climate = Math.max(0.62, Math.min(1.3, 1 + rng.gauss(0, 0.13)));
    if (this.climate < 0.75 && !this.famineLogged) {
      this.chronicle.add(this.year, KIND.DISASTER, '大飢饉の年 — 諸国の倉が尽きる');
      this.famineLogged = true;
    }
    if (this.climate >= 0.75) this.famineLogged = false;

    /* ---- 捨てられる集落 ---- */
    for (let i = this.settlements.length - 1; i >= 0; i--) {
      const s = this.settlements[i];
      if (s.pop < 35) {
        this.settlements.splice(i, 1);
        this.settlementById.delete(s.id);
        this.chronicle.add(this.year, KIND.DISASTER,
          `${s.name}、捨てられる`, { x: s.x, y: s.y });
        const n = this.nations.get(s.nationId);
        if (n && n.capitalId === s.id) {
          const rest = n.cities(this);
          if (rest.length) {
            const next = rest.reduce((a, b) => (a.pop > b.pop ? a : b));
            n.capitalId = next.id; next.isCapital = true;
          }
        }
        if (n) checkFallen(this, n);
        this.territoryDirty = true;
      }
    }

    /* ---- 建国：独立集落が町に育つと、王が立つ ---- */
    for (const s of this.settlements) {
      if (s.nationId === 0 && s.pop >= LIMITS.NATION_POP) {
        const id = this.nextNationId++;
        const hue = (this.nationCount++ * 137.508) % 360;
        const n = new Nation(id, nationName(rng, s.name), hue, s.id,
          this.year, rulerName(rng));
        this.nations.set(id, n);
        s.nationId = id;
        s.isCapital = true;
        this.chronicle.add(this.year, KIND.NATION,
          `${s.name}の長、王を名乗る — ${n.name}おこる`,
          { cityId: s.id, nationId: id, x: s.x, y: s.y });
        this.territoryDirty = true;
      }
    }

    /* ---- 帰順：国境に接した独立集落は、大国に呑まれる ---- */
    for (const s of this.settlements) {
      if (s.nationId !== 0 || s.pop > 700) continue;
      const i = s.y * SIZE + s.x;
      const near = this._dominantOwnerAround(i, 4);
      if (near && rng.chance(0.13)) {
        s.nationId = near;
        const n = this.nations.get(near);
        this.chronicle.add(this.year, KIND.ANNEX,
          `${s.name}、${n.name}に帰順`, { cityId: s.id, nationId: near });
        this.territoryDirty = true;
      }
    }

    /* ---- 交易網（4 年ごとに組み直す） ---- */
    if (this.year % 4 === 0) rebuildTrade(this);
    const external = tradeDiplomacy(this);

    /* ---- 技術と時代 ---- */
    for (const n of this.aliveNations()) {
      const prevEra = n.era;
      n.tech += techGain(n.totalPop(this), external.get(n.id) || 0);
      if (eraForTech(n.tech) > prevEra && prevEra < maxEra()) {
        this.chronicle.add(this.year, KIND.ERA,
          `${n.name}、${ERAS[n.era]}の時代に入る`, { nationId: n.id });
      }
    }

    /* ---- 王の代替わり ---- */
    for (const n of this.aliveNations()) {
      n.stability = Math.min(1, n.stability + 0.015);
      if (rng.chance(1 / 28)) {
        const old = n.ruler;
        n.ruler = rulerName(rng);
        n.rulerSince = this.year;
        if (rng.chance(0.15)) {
          n.stability = Math.max(0.05, n.stability - 0.22);
          this.chronicle.add(this.year, KIND.RULER,
            `${n.name}の王${old}、世を去る。後継を巡り国は揺れ、${n.ruler}が立つ`,
            { nationId: n.id });
        } else {
          this.chronicle.add(this.year, KIND.RULER,
            `${n.name}の王${old}、世を去る。${n.ruler}が立つ`, { nationId: n.id });
        }
      }
    }

    /* ---- 反乱：不安定な国は割れる ---- */
    for (const n of this.aliveNations()) {
      const cities = n.cities(this);
      if (cities.length >= 3 && n.stability < 0.3 && rng.chance(0.25)) {
        this._rebellion(n, cities);
      }
    }

    /* ---- 大事業 ---- */
    for (const n of this.aliveNations()) {
      const cap = this.settlementById.get(n.capitalId);
      if (cap && cap.pop > 2500 && n.wonderBuiltEra < n.era && rng.chance(0.06)) {
        const w = wonderName(rng, cap.name);
        cap.wonders.push(w);
        n.wonderBuiltEra = n.era;
        n.stability = Math.min(1, n.stability + 0.12);
        this.chronicle.add(this.year, KIND.WONDER,
          `${cap.name}に${w}が成る`, { cityId: cap.id, nationId: n.id, x: cap.x, y: cap.y });
      }
    }

    /* ---- 領土の塗り直しと国境摩擦 ---- */
    if (this.territoryDirty || this.year % 2 === 0) {
      this.lastFrictions = this._recomputeTerritory();
    }

    /* ---- 外交と戦争 ---- */
    stepDiplomacy(this, this.lastFrictions);

    /* ---- 厄災 ---- */
    stepDisasters(this);

    /* ---- 年表サンプル ---- */
    let pop = 0;
    for (const s of this.settlements) pop += s.pop;
    this.history.push({
      year: this.year,
      pop: Math.round(pop),
      cities: this.settlements.length,
      nations: this.aliveNations().length,
      era: this.worldEra(),
    });
    if (this.history.length > 1600) this.history.splice(0, this.history.length - 1600);
  }

  _dominantOwnerAround(i, r) {
    const x = i % SIZE, y = (i / SIZE) | 0;
    const counts = new Map();
    for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= SIZE || ny >= SIZE) continue;
      const o = this.owner[ny * SIZE + nx];
      if (o > 0) counts.set(o, (counts.get(o) || 0) + 1);
    }
    let best = null, bestC = 2;
    for (const [id, c] of counts) if (c > bestC) { bestC = c; best = id; }
    return best;
  }

  _rebellion(nation, cities) {
    const cap = this.settlementById.get(nation.capitalId);
    if (!cap) return;
    // 都から最も遠い都市が反旗を翻す
    let seat = null, bestD = -1;
    for (const c of cities) {
      if (c.id === nation.capitalId) continue;
      const d = (c.x - cap.x) ** 2 + (c.y - cap.y) ** 2;
      if (d > bestD) { bestD = d; seat = c; }
    }
    if (!seat) return;
    const id = this.nextNationId++;
    const hue = (this.nationCount++ * 137.508) % 360;
    const rebel = new Nation(id, nationName(this.rng, seat.name), hue, seat.id,
      this.year, rulerName(this.rng));
    rebel.tech = nation.tech * 0.9;        // 技術は持ち出せる
    rebel.stability = 0.7;
    this.nations.set(id, rebel);
    seat.nationId = id;
    seat.isCapital = true;
    // 反乱の府に近い都市はなびく
    for (const c of cities) {
      if (c === seat || c.id === nation.capitalId) continue;
      const d = (c.x - seat.x) ** 2 + (c.y - seat.y) ** 2;
      if (d < 14 * 14) { c.nationId = id; c.isCapital = false; }
    }
    nation.stability = 0.55;
    const key = relationKey(nation.id, id);
    this.relations.set(key, { val: -65, war: true, score: 0, since: this.year });
    this.chronicle.add(this.year, KIND.REBEL,
      `${nation.name}で反乱 — ${rebel.name}、独立を宣す`,
      { cityId: seat.id, nationId: id, x: seat.x, y: seat.y });
    this.territoryDirty = true;
  }

  /* 多源 BFS で領土を塗る。ついでに国境の摩擦を数える。 */
  _recomputeTerritory() {
    this.owner.fill(0);
    this.claimDist.fill(1e9);
    const t = this.terrain;

    for (const s of this.settlements) {
      if (s.nationId === 0 || s.pop < 150) continue;
      const radius = Math.min(16, 4 + Math.log2(s.pop / 100) * 2.2);
      const start = s.y * SIZE + s.x;
      // BFS（距離制限つき）
      const queue = [[start, 0]];
      const seen = new Set([start]);
      while (queue.length) {
        const [i, d] = queue.shift();
        if (d < this.claimDist[i]) {
          this.claimDist[i] = d;
          this.owner[i] = s.nationId;
        }
        if (d >= radius) continue;
        const x = i % SIZE, y = (i / SIZE) | 0;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nx = x + dx, ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= SIZE || ny >= SIZE) continue;
          const j = ny * SIZE + nx;
          if (seen.has(j)) continue;
          if (t.water[j] !== WATER.LAND) continue;
          seen.add(j);
          queue.push([j, d + 1]);
        }
      }
    }

    // 国境のこすれを数える（戦争の火種）
    const frictions = new Map();
    for (let y = 0; y < SIZE; y++) {
      for (let x = 0; x < SIZE - 1; x++) {
        const a = this.owner[y * SIZE + x], b = this.owner[y * SIZE + x + 1];
        if (a > 0 && b > 0 && a !== b) {
          const key = relationKey(a, b);
          frictions.set(key, (frictions.get(key) || 0) + 1);
        }
        if (y < SIZE - 1) {
          const c = this.owner[(y + 1) * SIZE + x];
          if (a > 0 && c > 0 && a !== c) {
            const key = relationKey(a, c);
            frictions.set(key, (frictions.get(key) || 0) + 1);
          }
        }
      }
    }
    this.territoryDirty = false;
    this.politicalDirty = true;   // 描画側への再描画フラグ
    return frictions;
  }

  /* ============================================================
     保存と復元 — 地形は種から再生できるので、動く状態だけ畳む
     ============================================================ */
  serialize() {
    const roadTiles = [];
    for (let i = 0; i < this.road.length; i++) if (this.road[i]) roadTiles.push(i);
    return {
      version: 1,
      seed: this.seed,
      year: this.year, month: this.month, totalMonths: this.totalMonths,
      climate: this.climate,
      plagueCooldownUntil: this.plagueCooldownUntil,
      nextSettlementId: this.nextSettlementId,
      nextNationId: this.nextNationId,
      nationCount: this.nationCount,
      roadTiles,
      settlements: this.settlements.map(s => ({ ...s })),
      nations: [...this.nations.values()].map(n => ({ ...n })),
      relations: [...this.relations.entries()],
      tradePairs: this.tradePairs,
      chronicle: this.chronicle.entries.slice(-2500),
      history: this.history.slice(-1200),
    };
  }

  static deserialize(data) {
    const w = Object.create(World.prototype);
    w.seed = data.seed;
    w.rng = new RNG((data.seed ^ (data.totalMonths * 2654435761)) >>> 0);
    w.terrain = generateTerrain(data.seed);

    const total = SIZE * SIZE;
    w.road = new Uint8Array(total);
    for (const i of data.roadTiles) w.road[i] = 1;
    w.owner = new Int16Array(total);
    w.claimDist = new Float32Array(total);

    w.year = data.year; w.month = data.month; w.totalMonths = data.totalMonths;
    w.climate = data.climate;
    w.famineLogged = false;
    w.plagueCooldownUntil = data.plagueCooldownUntil;
    w.nextSettlementId = data.nextSettlementId;
    w.nextNationId = data.nextNationId;
    w.nationCount = data.nationCount;

    w.settlements = data.settlements.map(d => {
      const s = new Settlement(d.id, d.name, d.x, d.y, d.founded, d.fertScore);
      Object.assign(s, d);
      return s;
    });
    w.settlementById = new Map(w.settlements.map(s => [s.id, s]));
    w.nations = new Map(data.nations.map(d => {
      const n = new Nation(d.id, d.name, d.hue, d.capitalId, d.founded, d.ruler);
      Object.assign(n, d);
      return [d.id, n];
    }));
    w.relations = new Map(data.relations);
    w.tradePairs = data.tradePairs || [];
    w.chronicle = new Chronicle();
    w.chronicle.entries = data.chronicle || [];
    w.history = data.history || [];

    w.territoryDirty = true;
    w.roadsDirty = true;
    w.politicalDirty = true;
    w.lastFrictions = new Map();
    w.lastFrictions = w._recomputeTerritory();
    return w;
  }
}
