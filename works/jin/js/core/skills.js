/* ============================================================
   陣 — 技（スキル）。常時はたらく「素質」と、確率で発動する「閃き」。
   戦闘で効くものは combat.js が読む。指令系（盗む・開錠）は actions が読む。
   rate(unit) は発動率(%)を返す（多くは技%）。
   ============================================================ */

import { effectiveStats } from './unit.js';

export const SKILLS = {};
function sk(o) { SKILLS[o.id] = o; return o; }

const sklRate = u => (effectiveStats(u).skl | 0);
const halfSkl = u => Math.floor((effectiveStats(u).skl | 0) / 2);

/* ---- 戦闘で発動する閃き（攻撃時） ---- */
sk({ id: 'sol', name: '太陽', kind: 'battle', trigger: 'attack', rate: halfSkl,
  effect: 'drain', desc: '与えた傷の半分、己を癒す（技/2 %）。' });
sk({ id: 'luna', name: '月光', kind: 'battle', trigger: 'attack', rate: halfSkl,
  effect: 'sunder', desc: '相手の守り／魔防を半分に（技/2 %）。' });
sk({ id: 'astra', name: '流星', kind: 'battle', trigger: 'attack', rate: u => Math.floor(sklRate(u) / 2),
  effect: 'astra', hits: 5, mult: 0.5, desc: '五連撃、各半分の威力（技/2 %）。' });
sk({ id: 'pierce', name: '貫通', kind: 'battle', trigger: 'attack', rate: halfSkl,
  effect: 'pierce', desc: '守りを無視して貫く（技/2 %）。' });
sk({ id: 'colossus', name: '剛撃', kind: 'battle', trigger: 'attack', rate: halfSkl,
  effect: 'mult', mult: 1.5, desc: '威力 1.5 倍（技/2 %）。' });
sk({ id: 'lethality', name: '瞬殺', kind: 'battle', trigger: 'attack', rate: u => Math.floor(sklRate(u) / 4),
  effect: 'lethal', desc: 'まれに相手を即座に倒す（技/4 %）。' });
sk({ id: 'deadeye', name: '射抜き', kind: 'battle', trigger: 'attack', rate: halfSkl,
  effect: 'sleep', desc: '命中時、相手を眠らせることがある（技/2 %）。' });
sk({ id: 'aether', name: '天空', kind: 'battle', trigger: 'attack', rate: halfSkl,
  effect: 'aether', desc: '月光ののち太陽——守りを割り、傷を吸う（技/2 %）。' });

/* ---- 戦闘で発動する守り（被攻撃時） ---- */
sk({ id: 'aegis', name: '盾防', kind: 'battle', trigger: 'defend', rate: halfSkl,
  effect: 'halveRanged', desc: '遠隔の傷を半分に（技/2 %）。' });
sk({ id: 'pavise', name: '大盾', kind: 'battle', trigger: 'defend', rate: halfSkl,
  effect: 'halveMelee', desc: '近接の傷を半分に（技/2 %）。' });
sk({ id: 'miracle', name: '祈り', kind: 'battle', trigger: 'defend', rate: u => (effectiveStats(u).lck | 0),
  effect: 'survive', desc: '致命の一撃を HP1 で耐える（運 %）。' });

/* ---- さらなる攻撃の閃き ---- */
sk({ id: 'ignis', name: 'イグニス', kind: 'battle', trigger: 'attack', rate: halfSkl,
  effect: 'ignis', desc: '魔か力の半分を、追加の傷として上乗せ（技/2 %）。' });
sk({ id: 'adept', name: '連撃', kind: 'battle', trigger: 'attack', rate: u => (effectiveStats(u).spd | 0),
  effect: 'adept', desc: 'もう一撃、続けて打つ（速さ %）。' });

/* ---- 常時の素質 ---- */
sk({ id: 'quickblade', name: '速駆け', kind: 'passive', effect: 'easyDouble', desc: '追撃に必要な速さ差が緩む（−1）。' });
sk({ id: 'wrath', name: '憤怒', kind: 'passive', effect: 'wrath', desc: 'HPが半分を切ると、会心が大きく上がる。' });
sk({ id: 'vantage', name: '先制', kind: 'passive', effect: 'vantage', desc: 'HPが半分以下なら、攻められても先に反撃する。' });
sk({ id: 'lifetaker', name: '命奪', kind: 'passive', effect: 'lifetaker', desc: '敵を倒すと、最大HPの半分が癒える。' });
sk({ id: 'bond', name: '絆', kind: 'passive', effect: 'bond', desc: '隣に味方がいるほど、命中・会心・回避が上がる（全員つねに）。' });
sk({ id: 'wary', name: '待ち伏せ', kind: 'passive', effect: 'noEnemyDouble', desc: '相手に追撃されない。' });
sk({ id: 'nihil', name: '無効化', kind: 'passive', effect: 'nihil', desc: '相手の閃き（技）を打ち消す。' });
sk({ id: 'wing', name: '翼', kind: 'passive', effect: 'flyTerrain', desc: '地形を越えて飛ぶ（移動コスト1）。' });
sk({ id: 'focus', name: '集中', kind: 'passive', effect: 'loneCrit', desc: '周りに味方が少ないほど会心が上がる。' });
sk({ id: 'rally', name: '鼓舞', kind: 'command', effect: 'rally', range: 2, desc: '周囲の味方の力・速さ・守を一時的に上げる。' });

/* ---- 指令（行動メニュー） ---- */
sk({ id: 'steal', name: '盗む', kind: 'command', effect: 'steal', desc: '速さが上なら、相手の持ち物（武器以外）を盗む。' });
sk({ id: 'pickpocket', name: '強奪', kind: 'command', effect: 'steal2', desc: '武器すら奪う盗みの達人。' });
sk({ id: 'lockpick', name: '開錠', kind: 'command', effect: 'lockpick', desc: '鍵なしで扉・宝箱を開ける。' });
sk({ id: 'mend_skill', name: '治療', kind: 'command', effect: 'heal', desc: '杖で味方を癒す。' });

export const SKILL_LIST = Object.values(SKILLS);
export function skill(id) { return SKILLS[id]; }
export function rateOf(id, unit) {
  const s = SKILLS[id];
  if (!s || typeof s.rate !== 'function') return 0;
  return Math.max(0, Math.min(100, s.rate(unit) | 0));
}
