/* ============================================================
   陣 — 地形。盤のマスは、ただの床ではない。
   森は身をかわし、山は固く、水は阻み、砦は癒す。地形は戦術そのもの。
   move: 進入コスト（Infinity は通れない）。avo: 回避ボーナス（%）。
   def: 防御ボーナス。heal: 毎ターン回復（最大HP割合×100の整数%）。
   fly: 飛行は進入コストを 1 とみなす（高所・水を越える）。
   ============================================================ */

export const TERRAIN = {
  plain:  { id: 'plain',  name: '平地',   ch: '.', move: 1, avo: 0,  def: 0, heal: 0, color: '#5c7a4a', flyOnly: false },
  road:   { id: 'road',   name: '道',     ch: '=', move: 1, avo: 0,  def: 0, heal: 0, color: '#8a7b5c' },
  grass:  { id: 'grass',  name: '草原',   ch: ',', move: 1, avo: 5,  def: 0, heal: 0, color: '#6b9050' },
  forest: { id: 'forest', name: '森',     ch: '♣', move: 2, avo: 20, def: 1, heal: 0, color: '#33623a' },
  thicket:{ id: 'thicket',name: '深い森', ch: '♠', move: 3, avo: 30, def: 2, heal: 0, color: '#234a2b' },
  hill:   { id: 'hill',   name: '丘',     ch: '∩', move: 2, avo: 10, def: 1, heal: 0, color: '#7d8a4a' },
  mountain:{ id: 'mountain',name: '山',   ch: '▲', move: 4, avo: 30, def: 3, heal: 0, color: '#7a6f5a' },
  peak:   { id: 'peak',   name: '峰',     ch: '⛰', move: Infinity, avo: 40, def: 4, heal: 0, color: '#9a8f7a' },
  water:  { id: 'water',  name: '水',     ch: '~', move: Infinity, avo: 10, def: 0, heal: 0, color: '#3a6ea5', flyOnly: true },
  shallow:{ id: 'shallow',name: '浅瀬',   ch: '≈', move: 3, avo: 0,  def: 0, heal: 0, color: '#4f86b8' },
  sand:   { id: 'sand',   name: '砂',     ch: '·', move: 2, avo: 5,  def: 0, heal: 0, color: '#c2b070' },
  swamp:  { id: 'swamp',  name: '沼',     ch: '%', move: 3, avo: 0,  def: 0, heal: 0, color: '#5a6b4a' },
  ruins:  { id: 'ruins',  name: '廃墟',   ch: '⌂', move: 2, avo: 15, def: 2, heal: 0, color: '#6b6660' },
  fort:   { id: 'fort',   name: '砦',     ch: '✚', move: 2, avo: 20, def: 2, heal: 10, color: '#8a8278' },
  gate:   { id: 'gate',   name: '門',     ch: '⊓', move: 1, avo: 0,  def: 1, heal: 0, color: '#9a8a6a' },
  wall:   { id: 'wall',   name: '壁',     ch: '█', move: Infinity, avo: 0, def: 0, heal: 0, color: '#3a3632', blocksSight: true },
  floor:  { id: 'floor',  name: '石床',   ch: '_', move: 1, avo: 0,  def: 0, heal: 0, color: '#6b6660' },
  throne: { id: 'throne', name: '玉座',   ch: '♛', move: 2, avo: 20, def: 3, heal: 10, color: '#a08a4a', seize: true },
  snow:   { id: 'snow',   name: '雪',     ch: '*', move: 2, avo: 5,  def: 0, heal: 0, color: '#d8e4ec' },
  ice:    { id: 'ice',    name: '氷',     ch: '◇', move: 2, avo: 0,  def: 0, heal: 0, color: '#acd0e4' },
  lava:   { id: 'lava',   name: '溶岩',   ch: '✦', move: Infinity, avo: 0, def: 0, heal: 0, color: '#b3431f', flyOnly: true, burns: 5 },
  bridge: { id: 'bridge', name: '橋',     ch: '╪', move: 1, avo: 0,  def: 0, heal: 0, color: '#9a7b4c' },
};

export const TERRAIN_LIST = Object.values(TERRAIN);

export function terrainOf(id) {
  return TERRAIN[id] || TERRAIN.plain;
}

/* 進入コスト（移動方式を考慮） */
export function moveCost(terrainId, mode = 'foot') {
  const t = terrainOf(terrainId);
  if (mode === 'fly') return t.move === Infinity && t.flyOnly === false && t.id !== 'peak' ? Infinity : 1;
  if (mode === 'fly2') return 1;            // 完全飛行（壁以外）
  return t.move;
}
