/* ============================================================
   陣 — 戦記を綴じる。種・章・所持・軍の育ちを、一片の符号に畳む。
   localStorage にも、共有リンク（#g=…）にも収まる。コアは DOM 非依存。
   ============================================================ */

import { Game } from './game.js';
import { STAT_KEYS } from './stats.js';

export const SAVE_VERSION = 2;

function serUnit(u) {
  const o = {
    name: u.name, classId: u.classId, level: u.level, exp: u.exp,
    statsBase: {}, growths: {}, maxHp: u.maxHp, hp: u.hp, mov: u.mov, mode: u.mode,
    items: u.items.map(it => ({ id: it.id, uses: it.uses, forge: it.forge | 0 })), equipped: u.equipped,
    skills: u.skills.slice(), accessory: u.accessory || null,
    wexp: u.wexp ? { ...u.wexp } : {}, faith: u.faith ?? 5,
    isLord: !!u.isLord, side: u.side, bio: u.bio || '', deathQuote: u.deathQuote || null,
    dead: !!u.dead || u.hp <= 0,
  };
  for (const k of STAT_KEYS) { o.statsBase[k] = u.statsBase[k] | 0; o.growths[k] = u.growths[k] | 0; }
  return o;
}
function deserUnit(o, uid) {
  return {
    uid, name: o.name, classId: o.classId, level: o.level | 0, exp: o.exp | 0,
    statsBase: { ...o.statsBase }, growths: { ...o.growths },
    maxHp: o.maxHp | 0, hp: o.dead ? 0 : (o.hp | 0), mov: o.mov | 0, mode: o.mode,
    items: (o.items || []).map(it => ({ id: it.id, uses: it.uses, forge: it.forge | 0 })), equipped: o.equipped ?? -1,
    skills: (o.skills || []).slice(), status: [], buffs: {}, accessory: o.accessory || null,
    wexp: o.wexp ? { ...o.wexp } : {}, faith: o.faith ?? 5, facing: 1,
    pos: null, hasMoved: false, hasActed: false, boss: false, dead: !!o.dead,
    aiKind: 'charge', isLord: !!o.isLord, side: o.side || 'player', bio: o.bio || '', deathQuote: o.deathQuote || null,
  };
}

export function serialize(game) {
  return {
    v: SAVE_VERSION, seed: game.seed, chapterIndex: game.chapterIndex,
    gold: game.gold, useSetpiece: !!game.useSetpiece, initiative: !!game.initiative,
    hired: (game.hired || []).slice(),
    tradeGoods: (game.tradeGoods || []).slice(),
    supports: { ...(game.supports || {}) },
    convoy: game.convoy.slice(),
    party: game.party.map(serUnit),
  };
}

export function deserialize(data) {
  if (!data || !data.party) throw new Error('壊れた記録');
  const g = new Game(data.seed >>> 0, { setpiece: !!data.useSetpiece, initiative: !!data.initiative });
  g.chapterIndex = data.chapterIndex | 0;
  g.gold = data.gold | 0;
  g.hired = (data.hired || []).slice();
  g.tradeGoods = (data.tradeGoods || []).slice();
  g.supports = { ...(data.supports || {}) };
  g.convoy = (data.convoy || []).slice();
  let uid = 1;
  g.party = data.party.map(o => deserUnit(o, uid++));
  return g;
}

/* base64url（リンク・テキスト用） */
export function encodeSave(game) {
  const json = JSON.stringify(serialize(game));
  const b64 = (typeof btoa === 'function') ? btoa(unescape(encodeURIComponent(json)))
    : Buffer.from(json, 'utf8').toString('base64');
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
export function decodeSave(code) {
  const b64 = String(code || '').trim().replace(/-/g, '+').replace(/_/g, '/');
  const json = (typeof atob === 'function') ? decodeURIComponent(escape(atob(b64)))
    : Buffer.from(b64, 'base64').toString('utf8');
  return deserialize(JSON.parse(json));
}
