/* ============================================================
   陣 — 戦記そのもの。種ひとつから、軍と、章と、戦場が決まる。
   仲間は章をまたいで育ち、倒れれば二度と戻らない。
   ============================================================ */

import { RNG } from './rng.js';
import { createUnit, resetUid, isAlive } from './unit.js';
import { generateMap } from './mapgen.js';
import { generateEnemies, placeBoss } from './enemies.js';
import { Battle } from './battle.js';
import { SETPIECES, parseMap } from './maps.js';
import './expansion.js';            // 追加の職・素質を登録簿へ
import './items_extra.js';          // 追加の得物を登録簿へ

/* ---- 旗下の者たち（種で初期能力が決まる） ---- */
export const ROSTER = [
  { id: 'lin', name: 'リン', classId: 'lord', level: 1, isLord: true, items: ['iron_sword', 'vulnerary'],
    growths: { spd: 5, lck: 5 }, bio: '辺境の若き主。民のために剣を執る。',
    deathQuote: 'ここで……潰えるわけには……みんな、すまない……' },
  { id: 'gareth', name: 'ガレス', classId: 'knight', level: 2, items: ['iron_lance', 'vulnerary'],
    growths: { def: 10 }, bio: '槍の重騎。鉄壁の盾役。', deathQuote: '盾は……砕けた、か……' },
  { id: 'sera', name: 'セラ', classId: 'cleric', level: 1, items: ['heal'],
    growths: { mag: 5, res: 10 }, bio: '癒しの杖を持つ神官。', deathQuote: 'まだ……癒したい人が……' },
  { id: 'rowen', name: 'ロウェン', classId: 'archer', level: 2, items: ['iron_bow', 'vulnerary'],
    growths: { skl: 10 }, bio: '森育ちの射手。空の敵を射落とす。', deathQuote: 'まだ、的が……残ってるのに……' },
  { id: 'mira', name: 'ミラ', classId: 'mage', level: 1, items: ['fire', 'vulnerary'],
    growths: { mag: 10, spd: 5 }, bio: '炎を操る魔道士。', deathQuote: '火が……消える……' },
  { id: 'kai', name: 'カイ', classId: 'mercenary', level: 3, items: ['iron_sword', 'vulnerary'],
    growths: { spd: 10, skl: 5 }, bio: '剣ひとつの流れ者。速さに長ける。', deathQuote: 'へっ……油断したな、おれ……' },
  { id: 'fio', name: 'フィオ', classId: 'pegasus', level: 2, items: ['iron_lance', 'javelin'],
    growths: { spd: 5, res: 5 }, bio: '天馬を駆る乙女。空翔ける槍。', deathQuote: '空に……還ります……' },
  { id: 'doran', name: 'ドラン', classId: 'cavalier', level: 3, items: ['iron_lance', 'iron_sword'],
    growths: { def: 5, hp: 10 }, bio: '騎兵。広く駆けて要を突く。', deathQuote: '殿……お先に……' },
];

/* ---- 章（チャプター） ---- */
export const CHAPTERS = [
  { title: '第一章・辺境の砦', biome: 'green', w: 15, h: 11, objective: 'rout', level: 3, count: 5,
    boss: { classId: 'brigand', name: '山賊頭ゴラ', level: 6 },
    intro: '辺境の村を山賊が襲う。リンは剣を執った。', outro: '村は救われた。だが、これは長い戦の始まりにすぎない。' },
  { title: '第二章・森の追撃', biome: 'green', w: 16, h: 12, objective: 'rout', level: 5, count: 6,
    boss: { classId: 'fighter', name: '荒くれバルク', level: 8 },
    intro: '逃げた残党を森へ追う。', outro: '木々の間に、賊の旗が落ちた。' },
  { title: '第三章・川辺の砦', biome: 'green', w: 17, h: 12, objective: 'seize', level: 7, count: 7,
    boss: { classId: 'soldier', name: '守将ハイン', level: 10 },
    intro: '川を渡る砦を奪え。玉座を取れば勝ちだ。', outro: '砦は落ちた。橋の向こうは、敵地。' },
  { title: '第四章・砂の隊商路', biome: 'desert', w: 18, h: 12, objective: 'rout', level: 9, count: 8,
    boss: { classId: 'mercenary', name: '傭兵頭ザイル', level: 12 },
    intro: '砂の道で、雇われ刃が待ち構える。', outro: '熱砂に、また血が染みた。' },
  { title: '第五章・廃都の影', biome: 'ruins', w: 18, h: 13, objective: 'defeat_boss', level: 11, count: 8, monster: true,
    boss: { classId: 'sorcerer', name: '屍術師ヴェル', level: 14, items: ['nosferatu'] },
    intro: '廃都に屍が蠢く。術師を断て。', outro: '闇の主は崩れ、都に朝が射した。' },
  { title: '第六章・雪嶺の関', biome: 'snow', w: 18, h: 13, objective: 'seize', level: 13, count: 9,
    boss: { classId: 'general', name: '将軍グナエ', level: 16 },
    intro: '雪の関を抜けねば、先はない。玉座を取れ。', outro: '凍てつく関に、軍旗が立った。' },
  { title: '第七章・火口の城', biome: 'volcano', w: 19, h: 13, objective: 'defeat_boss', level: 15, count: 10,
    boss: { classId: 'wyvernlord', name: '竜将ガルム', level: 18 },
    intro: '火口の城に、竜の将が待つ。', outro: '竜は墜ちた。王都は、すぐそこ。' },
  { title: '第八章・王座の間', biome: 'ruins', w: 19, h: 14, objective: 'seize', level: 17, count: 11,
    boss: { classId: 'commander', name: '簒奪王デズモンド', level: 20, statBoost: { hp: 16, def: 4, str: 4, spd: 2 } },
    intro: 'すべては、この王座のために。', outro: '簒奪の王は倒れた。——だが彼は、最期に妙な言葉を遺した。「塔が……目覚める」と。' },

  /* ── 第二幕：王を操っていた、より古い影 ── */
  { title: '第九章・凱旋の途', biome: 'green', w: 18, h: 12, objective: 'rout', level: 19, count: 10,
    recruits: ['oren'],
    boss: { classId: 'hero', name: '残党将ボルド', level: 22 },
    intro: '帰る道に、王に従わぬ残党が立ち塞がる。', outro: '勝ったはずの戦が、まだ終わらない。' },
  { title: '第十章・理の塔', biome: 'ruins', w: 18, h: 14, objective: 'defeat_boss', level: 21, count: 11, monster: true,
    recruits: ['liza'],
    boss: { classId: 'archmage_foe', name: '塔守クレシス', level: 24, items: ['bolting'] },
    intro: '禁じられた理を蓄える塔。その主を断て。', outro: '塔の頂で、古い扉が開いていた。誰かが——先にいた。' },
  { title: '第十一章・竜牙の谷', biome: 'volcano', w: 19, h: 13, objective: 'rout', level: 23, count: 12, monster: true,
    recruits: ['gunnar'],
    boss: { classId: 'wyvernlord', name: '竜牙のヴァロ', level: 26 },
    intro: '竜牙族の谷。翼の影が、空を覆う。', outro: '谷を抜けた。鱗の匂いが、まだ鼻に残る。' },
  { title: '第十二章・水没都市', biome: 'green', w: 19, h: 14, objective: 'seize', level: 25, count: 12,
    recruits: ['noelle'],
    boss: { classId: 'general', name: '沈黙の衛士', level: 28 },
    intro: '水に沈んだ都の、ただ一つ残る玉座を取れ。', outro: '水面が、空をうつして静まった。' },
  { title: '第十三章・屍の野', biome: 'ruins', w: 19, h: 14, objective: 'defeat_boss', level: 27, count: 13, monster: true,
    boss: { classId: 'necromancer', name: '屍呼びオルガ', level: 30, items: ['nosferatu'] },
    intro: '野は屍で埋まり、なお起き上がる。呼ぶ者を断て。', outro: '屍は土へ還った。だが、もっと大きな気配が近い。' },
  { title: '第十四章・天空の社', biome: 'snow', w: 19, h: 14, objective: 'seize', level: 29, count: 13,
    boss: { classId: 'falcon', name: '社守ティアナ', level: 32 },
    intro: '雲の上の社。古き約束が、ここで結ばれた。', outro: '風が、最後の頁の在り処を告げた。' },
  { title: '第十五章・禁書の間', biome: 'ruins', w: 20, h: 14, objective: 'defeat_boss', level: 31, count: 14, monster: true,
    boss: { classId: 'sorcerer', name: '禁書の声', level: 34, items: ['nosferatu'], statBoost: { hp: 12, mag: 4, res: 4 } },
    intro: '頁をめくる声がする。それは、王を操っていた声だった。', outro: '声は途切れた。けれど、頁の奥から、巨きな影が立ち上がる。' },
  { title: '終章・古き竜', biome: 'volcano', w: 20, h: 15, objective: 'defeat_boss', level: 33, count: 14, monster: true,
    boss: { classId: 'firedrake', name: '古竜アズヴァルド', level: 38, statBoost: { hp: 28, def: 6, str: 6, res: 4, spd: 2 } },
    intro: '禁書が呼んだのは、世界より古い竜。これが、ほんとうの最後の戦。', outro: '古竜は崩れ、灰は風に溶けた。長い長い戦が、いま本当に終わる。' },
];

/* ── 第二幕で加わる仲間（その章に着くと馳せ参じる） ── */
export const EXTRA_ROSTER = [
  { id: 'oren', name: 'オレン', classId: 'shaman', level: 14, joinAt: 8, items: ['flux', 'vulnerary'],
    growths: { mag: 5, def: 5 }, bio: '塔を追われた呪術師。闇の理に通じる。', deathQuote: '頁は……閉じる、か……' },
  { id: 'liza', name: 'リーザ', classId: 'monk', level: 16, joinAt: 9, items: ['lightning', 'vulnerary'],
    growths: { mag: 5, res: 10 }, bio: '塔に囚われていた光の徒。屍を祓う。', deathQuote: '光が……届きますように……' },
  { id: 'gunnar', name: 'グンナル', classId: 'fighter', level: 18, joinAt: 10, items: ['steel_axe', 'hand_axe'],
    growths: { hp: 10, str: 5 }, bio: '竜牙の谷で生き延びた斧使い。', deathQuote: 'はっ……ここまで、か……' },
  { id: 'noelle', name: 'ノエル', classId: 'thief', level: 18, joinAt: 11, items: ['iron_dagger', 'vulnerary'],
    growths: { spd: 5, lck: 10 }, bio: '水没都市の生き残り。影と鍵の名手。', deathQuote: 'しくじった……な……' },
];

export class Game {
  constructor(seed, opts = {}) {
    this.seed = (typeof seed === 'number' ? seed : (seed | 0)) >>> 0;
    this.rng = new RNG(this.seed);
    this.useSetpiece = !!opts.setpiece;     // 手作りの設置マップで戦うか
    this.chapterIndex = 0;
    this.gold = 5000;
    this.convoy = ['vulnerary', 'vulnerary', 'concoction', 'steel_sword', 'hand_axe'];
    this.party = [];
    this._buildParty();
  }
  _buildParty() {
    resetUid(1);
    const r = this.rng.derive('party');
    this.party = ROSTER.map((spec, i) => {
      const u = createUnit({ ...spec, side: 'player' }, r.derive(spec.id));
      u.isLord = !!spec.isLord;
      return u;
    });
  }
  get chapter() { return CHAPTERS[this.chapterIndex]; }
  get done() { return this.chapterIndex >= CHAPTERS.length; }
  livingParty() { return this.party.filter(isAlive); }

  /* その章までに加わる仲間を、軍へ（重複なし・決定的） */
  recruitUpTo(index) {
    const r = this.rng.derive('recruit');
    for (const spec of EXTRA_ROSTER) {
      if (spec.joinAt <= index && !this.party.some(u => u.name === spec.name)) {
        this.party.push(createUnit({ ...spec, side: 'player' }, r.derive(spec.id)));
      }
    }
  }

  /* 章の戦場を組む。{ battle, deploy } を返す。 */
  startChapter(index = this.chapterIndex) {
    const ch = CHAPTERS[index];
    const cr = this.rng.derive('ch' + index);
    this.recruitUpTo(index);

    // 戦場：手作りの設置マップ、または種からの生成
    let board, deployTiles, spawns, objective, bossSeat = null;
    if (this.useSetpiece && SETPIECES[index]) {
      const parsed = parseMap(SETPIECES[index]);
      board = parsed.board; deployTiles = parsed.deploy.slice(); spawns = parsed.spawns.slice(0, ch.count);
      bossSeat = parsed.boss;
      if (ch.objective === 'seize') {
        let tx, ty, hasThrone = false;
        board.terrain.forEach((x, y, v) => { if (v === 'throne') { tx = x; ty = y; hasThrone = true; } });
        if (!hasThrone) { const p = bossSeat || spawns[spawns.length - 1] || { x: board.w - 2, y: (board.h / 2) | 0 }; board.setTerrain(p.x, p.y, 'throne'); tx = p.x; ty = p.y; }
        objective = { type: 'seize', x: tx, y: ty };
      } else {
        objective = { type: ch.objective === 'defeat_boss' ? 'rout' : ch.objective };
      }
    } else {
      const gen = generateMap(cr.derive('map'), { w: ch.w, h: ch.h, biome: ch.biome, objective: ch.objective, enemyCount: ch.count });
      board = gen.board; deployTiles = gen.deploy; spawns = gen.spawns; objective = gen.objective;
    }

    // 味方を布陣マスに置く（生存者のみ）
    const living = this.livingParty();
    const deploy = deployTiles.slice(0, Math.max(living.length, 1));
    living.forEach((u, i) => {
      const tile = deploy[i % deploy.length] || deployTiles[0];
      u.hp = u.maxHp; u.status = []; u.buffs = {};
      u.hasMoved = false; u.hasActed = false;
      board.add(u, tile.x, tile.y);
    });

    // 敵とボス
    generateEnemies(cr, board, spawns, { chapter: index + 1, level: ch.level, monster: ch.monster });
    if (ch.boss) {
      const bossPos = bossSeat || (objective.type === 'seize' ? { x: objective.x, y: objective.y }
        : spawns[spawns.length - 1] || { x: board.w - 2, y: (board.h / 2) | 0 });
      if (board.unitAt(bossPos.x, bossPos.y)) board.remove(board.unitAt(bossPos.x, bossPos.y));
      const boss = placeBoss(cr, board, { ...ch.boss, pos: bossPos });
      if (ch.objective === 'defeat_boss') objective = { type: 'defeat_boss', uid: boss.uid };
    }
    board.rebuildIndex();

    const battle = new Battle(board, {
      rng: cr.derive('fight'),
      objective,
      maxTurns: ch.objective === 'survive' ? (ch.turns || 10) : 0,
    });
    this.battle = battle;
    return { battle, deploy, chapter: ch };
  }

  /* 勝利時：金を得て次章へ */
  onVictory() {
    const ch = CHAPTERS[this.chapterIndex];
    const reward = 1500 + this.chapterIndex * 500;
    this.gold += reward;
    this.chapterIndex++;
    return { reward, gold: this.gold, done: this.done };
  }
}
