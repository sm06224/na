/* ============================================================
   窟 — 特殊部屋（vault）。手で描いた小部屋を、ひとりでに掘れた迷宮へ
   そっと埋め込む。牢・宝物庫・祠・書庫・墓室……稀に出会う「作為」。

   記号でタイルと「湧き」を表し、深さに合う一つを盤に押し当てる。
   ============================================================ */

import { T } from '../tile.js';
import { Rect } from '../util.js';

/* 記号 → タイル（spawn は別表で拾う） */
const SYM = {
  '#': T.WALL, 'x': T.WALL, '.': T.FLOOR, ',': T.GRASS, '+': T.DOOR_CLOSED, "'": T.DOOR_OPEN,
  '~': T.WATER, '≈': T.DEEP_WATER, 'L': T.LAVA, 'T': T.TRAP, '&': T.STATUE, '_': T.ALTAR,
  'F': T.FOUNTAIN, '|': T.BARS, '=': T.BRIDGE, '%': T.RUBBLE, '<': T.STAIRS_UP, '"': T.CHASM,
};
/* 記号 → 湧き（タイルは床にしてから上に乗せる） */
const SPAWN = {
  '$': { type: 'gold' }, '*': { type: 'item' }, '!': { type: 'item', cat: 'potion' },
  '?': { type: 'item', cat: 'scroll' }, '/': { type: 'item', cat: 'wand' }, '○': { type: 'item', cat: 'ring' },
  'm': { type: 'monster', tier: 'weak' }, 'M': { type: 'monster', tier: 'tough' }, 'B': { type: 'monster', tier: 'boss' },
  'K': { type: 'keeper' }, 'S': { type: 'shopitem' },
};

/* ---- テンプレート群 ---- */
export const VAULTS = [
  {
    id: 'treasure', rarity: 5, depth: [2, 13], tags: ['loot'],
    rows: [
      '#########',
      '#.......#',
      '#.$*?!..#',
      '#..&M&..#',
      '#.!?*$..#',
      '#.......#',
      '####+####',
    ],
  },
  {
    id: 'prison', rarity: 4, depth: [3, 12], tags: ['monsters'],
    rows: [
      '###########',
      '#+#+#+#+#+#',
      '#m#m#M#m#m#',
      '#.#.#.#.#.#',
      '#.........#',
      '####+######',
    ],
  },
  {
    id: 'shrine', rarity: 4, depth: [2, 14], tags: ['altar'],
    rows: [
      '#######',
      '#..&..#',
      '#.._..#',
      '#.&_&.#',
      '#..*..#',
      '###+###',
    ],
  },
  {
    id: 'library', rarity: 3, depth: [3, 13], tags: ['scrolls'],
    rows: [
      '###########',
      '#?.?.?.?.?#',
      '#.#.#.#.#.#',
      '#.?.M.?.*.#',
      '#.#.#.#.#.#',
      '#?.?.?.?.?#',
      '#####+#####',
    ],
  },
  {
    id: 'crypt', rarity: 3, depth: [5, 15], tags: ['undead'],
    rows: [
      '#########',
      '#&.&.&.&#',
      '#.......#',
      '#.MmBmM.#',
      '#.......#',
      '#&.$*$.&#',
      '####+####',
    ],
  },
  {
    id: 'pool', rarity: 3, depth: [2, 12], tags: ['water'],
    rows: [
      '#########',
      '#..~~~..#',
      '#.~≈≈≈~.#',
      '#.~≈*≈~.#',
      '#.~≈≈≈~.#',
      '#..~~~..#',
      '###+#+###',
    ],
  },
  {
    id: 'pillars', rarity: 4, depth: [4, 15], tags: ['hall'],
    rows: [
      '#############',
      '#.&.&.&.&.&.#',
      '#...........#',
      '#.&.&M&.&.&.#',
      '#.....$.....#',
      '#.&.&.&.&.&.#',
      '#...........#',
      '##+#######+##',
    ],
  },
  {
    id: 'guard', rarity: 3, depth: [6, 15], tags: ['boss', 'loot'],
    rows: [
      '###########',
      '#....+....#',
      '#.TT...TT.#',
      '#.T.*/*.T.#',
      '#.T.$B$.T.#',
      '#.T.*?*.T.#',
      '#.TT...TT.#',
      '####+######',
    ],
  },
  {
    id: 'oubliette', rarity: 2, depth: [4, 14], tags: ['trap'],
    rows: [
      '#########',
      '#TTTTTTT#',
      '#T*?!/$T#',
      '#TTTTTTT#',
      '###+#####',
    ],
  },
  {
    id: 'reliquary', rarity: 2, depth: [6, 15], tags: ['altar', 'loot'],
    rows: [
      '###########',
      '#_.&...&._#',
      '#.._.M._..#',
      '#&._/$/_.&#',
      '#.._.M._..#',
      '#_.&...&._#',
      '#####+#####',
    ],
  },
  {
    id: 'beasts', rarity: 3, depth: [5, 13], tags: ['monsters'],
    rows: [
      '#############',
      '#m.m.m.m.m.m#',
      '#...........#',
      '#.M.|$|.M...#',
      '#...........#',
      '#m.m.M.m.m.m#',
      '####+####+###',
    ],
  },
  {
    id: 'flooded', rarity: 2, depth: [3, 12], tags: ['water'],
    rows: [
      '#############',
      '#~~≈≈≈≈≈~~~~#',
      '#~M≈*≈?≈$≈M~#',
      '#~~≈≈≈≈≈~~~~#',
      '##+#######+##',
    ],
  },
  {
    id: 'forge', rarity: 2, depth: [7, 15], tags: ['lava', 'loot'],
    rows: [
      '###########',
      '#LL.....LL#',
      '#L.&/*&.L.#',
      '#..$.M.$..#',
      '#L.&*?&.L.#',
      '#LL.....LL#',
      '#####+#####',
    ],
  },
  {
    id: 'gallery', rarity: 3, depth: [4, 13], tags: ['hall'],
    rows: [
      '###############',
      '#&.&.&.&.&.&.&#',
      "#.'.........'.#",
      '#&.&.M$M.&.&.&#',
      "#.'.........'.#",
      '#&.&.&.&.&.&.&#',
      '###+#######+###',
    ],
  },
  {
    id: 'nest', rarity: 3, depth: [3, 11], tags: ['monsters'],
    rows: [
      '#########',
      '#mm,,,mm#',
      '#m,,B,,m#',
      '#mm,$,mm#',
      '###+#####',
    ],
  },
  {
    id: 'shop', rarity: 3, depth: [2, 14], tags: ['shop'],
    rows: [
      '###########',
      '#SSSSSSSSS#',
      '#.........#',
      '#....K....#',
      '#.........#',
      '#####+#####',
    ],
  },
  {
    id: 'cross', rarity: 3, depth: [2, 12], tags: ['hall'],
    rows: [
      '####+####',
      '###...###',
      '+..$*?..+',
      '###.M.###',
      '###...###',
      '####+####',
    ],
  },
  {
    id: 'arena', rarity: 2, depth: [6, 15], tags: ['boss', 'monsters'],
    rows: [
      '#############',
      '#m.m.m.m.m.m#',
      '#...........#',
      '#..&.B.&....#',
      '#...........#',
      '#m.m.$*.m.m.#',
      '####+###+####',
    ],
  },
  {
    id: 'grove', rarity: 3, depth: [2, 9], tags: ['water'],
    rows: [
      '###########',
      '#,,,~~~,,,#',
      '#,M,~≈~,m,#',
      '#,,,~*~,,,#',
      '#,,,,_,,,,#',
      '#####+#####',
    ],
  },
  {
    id: 'tomb2', rarity: 2, depth: [8, 15], tags: ['undead', 'loot'],
    rows: [
      '#############',
      '#&_&.&_&.&_&#',
      '#...........#',
      '#.M.$/$.M...#',
      '#.....*.....#',
      '#&_&.&_&.&_&#',
      '######+######',
    ],
  },
  {
    id: 'spiral', rarity: 3, depth: [3, 13], tags: ['maze'],
    rows: [
      '#########',
      '#.......#',
      '#.#####.#',
      '#.#$*?#.#',
      '#.#.###.#',
      '#.#M..#.#',
      '#.#####.#',
      '#......+#',
    ],
  },
  {
    id: 'twin', rarity: 3, depth: [4, 13], tags: ['monsters', 'loot'],
    rows: [
      '#############',
      '#M.$.#.$.M.##',
      '#...#.#...#.#',
      '#.#.#.#.#.#.#',
      '#...#*#...#.#',
      '##+###+###+##',
    ],
  },
  {
    id: 'chapel', rarity: 2, depth: [4, 14], tags: ['altar'],
    rows: [
      '###########',
      '#...._....#',
      '#.&.&.&.&.#',
      '#....M....#',
      '#.&.&_&.&.#',
      '#....*....#',
      '#####+#####',
    ],
  },
  {
    id: 'warren', rarity: 3, depth: [2, 10], tags: ['monsters'],
    rows: [
      '#############',
      '#m,m,#,m,#,m#',
      '#,#,#,#,#,#,#',
      '#m,M,$,M,m,.#',
      '#,#,#,#,#,#,#',
      '#m,m,#,m,#+m#',
      '######+######',
    ],
  },
  {
    id: 'hoard', rarity: 1, depth: [7, 15], tags: ['loot', 'boss'],
    rows: [
      '###########',
      '#$$$$$$$$$#',
      '#$*?/=!*?$#',
      '#$$$.B.$$$#',
      '#$*?!=/*?$#',
      '#$$$$$$$$$#',
      '#####+#####',
    ],
  },
  {
    id: 'altars', rarity: 2, depth: [3, 14], tags: ['altar'],
    rows: [
      '#########',
      '#_.._.._#',
      '#.&.M.&.#',
      '#_.._.._#',
      '###+#+###',
    ],
  },
  {
    id: 'caged', rarity: 3, depth: [4, 12], tags: ['monsters', 'loot'],
    rows: [
      '###########',
      '#|M|.+.|M|#',
      '#|$|...|*|#',
      '#|m|.+.|m|#',
      '#####+#####',
    ],
  },
  {
    id: 'foyer', rarity: 3, depth: [2, 11], tags: ['hall'],
    rows: [
      '#####+#####',
      '#.........#',
      '+...&$&...+',
      '#....*....#',
      '#.........#',
      '#####+#####',
    ],
  },
  {
    id: 'sanctum', rarity: 2, depth: [6, 15], tags: ['altar', 'monsters'],
    rows: [
      '###########',
      '#M.&._.&.M#',
      '#.........#',
      '#&.._/_..&#',
      '#.........#',
      '#M.&.$.&.M#',
      '#####+#####',
    ],
  },
  {
    id: 'kennels', rarity: 3, depth: [3, 10], tags: ['monsters'],
    rows: [
      '#############',
      '#m#m#m#m#m#m#',
      "#'.'.'.'.'.'#",
      '#....$*....##',
      '######+######',
    ],
  },
  {
    id: 'pit2', rarity: 2, depth: [5, 14], tags: ['trap', 'loot'],
    rows: [
      '#########',
      '#T.T.T.T#',
      '#.*?/$..#',
      '#T.T.T.T#',
      '#...M...#',
      '###+#####',
    ],
  },
  {
    id: 'rookery', rarity: 3, depth: [4, 12], tags: ['water', 'monsters'],
    rows: [
      '###########',
      '#~,m,~~,M~#',
      '#~,,,,,,,~#',
      '#~M,$*?,m~#',
      '#~~,,,,,~~#',
      '#####+#####',
    ],
  },
  {
    id: 'crossfire', rarity: 2, depth: [7, 15], tags: ['lava', 'monsters'],
    rows: [
      '###########',
      '#L.M...M.L#',
      '#.LL.$.LL.#',
      '#..L.*.L..#',
      '#.LL.?.LL.#',
      '#L.M...M.L#',
      '#####+#####',
    ],
  },
  {
    id: 'cells', rarity: 3, depth: [3, 11], tags: ['monsters'],
    rows: [
      '#############',
      '#+#+#+#+#+#+#',
      '#m#m#m#M#m#m#',
      '#...........#',
      '#..$..*..?..#',
      '######+######',
    ],
  },
  {
    id: 'fane', rarity: 2, depth: [5, 15], tags: ['altar', 'loot'],
    rows: [
      '###########',
      '#&.._.._.&#',
      '#.._/=/_..#',
      '#&.._.._.&#',
      '#....M....#',
      '#####+#####',
    ],
  },
  {
    id: 'bridge', rarity: 2, depth: [6, 15], tags: ['hall'],
    rows: [
      '#############',
      '#"""""""""""#',
      '+...=====...+',
      '#"""$*?"""""#',
      '#############',
    ],
  },
  {
    id: 'apse', rarity: 3, depth: [3, 12], tags: ['hall'],
    rows: [
      '###+###',
      '#.....#',
      '#.&$&.#',
      '#..*..#',
      '#.&?&.#',
      '#.....#',
      '###+###',
    ],
  },
  {
    id: 'larder', rarity: 3, depth: [2, 9], tags: ['loot'],
    rows: [
      '#########',
      '#%%.*.%%#',
      '#%.....%#',
      '#..$m$..#',
      '#%.....%#',
      '#%%.?.%%#',
      '####+####',
    ],
  },
  {
    id: 'menagerie', rarity: 2, depth: [6, 14], tags: ['monsters', 'boss'],
    rows: [
      '#############',
      '#m|M|m|M|m|.#',
      "#.'.'.'.'.'.#",
      '#.....B.....#',
      '#.$.*.?./.=.#',
      '######+######',
    ],
  },
  {
    id: 'barracks', rarity: 3, depth: [4, 12], tags: ['monsters'],
    rows: [
      '#############',
      '#M...M...M..#',
      '#.#.#.#.#.#.#',
      '#...$...*...#',
      '#.#.#.#.#.#.#',
      '#m...m...m..#',
      '######+######',
    ],
  },
  {
    id: 'grotto', rarity: 3, depth: [2, 10], tags: ['water'],
    rows: [
      '###########',
      '#,,~≈≈≈~,,#',
      '#,M~≈*≈~m,#',
      '#,,~≈?≈~,,#',
      '#,,,~$~,,,#',
      '#####+#####',
    ],
  },
  {
    id: 'solar', rarity: 2, depth: [5, 14], tags: ['altar', 'loot'],
    rows: [
      '#############',
      '#_.&.&.&.&._#',
      '#...........#',
      '#&.._/$/_..&#',
      '#...........#',
      '#_.&.&M&.&._#',
      '######+######',
    ],
  },
  {
    id: 'oratory', rarity: 3, depth: [3, 12], tags: ['altar'],
    rows: [
      '###+###',
      '#.._..#',
      '#.&.&.#',
      '+..*..+',
      '#.&.&.#',
      '#.._..#',
      '###+###',
    ],
  },
  {
    id: 'keep', rarity: 2, depth: [7, 15], tags: ['monsters', 'loot'],
    rows: [
      '#############',
      '#M#.$.#.$.#M#',
      '#.#.#.#.#.#.#',
      "#'.'.'B'.'.'#",
      '#.#.#.#.#.#.#',
      '#m#.?./.*.#m#',
      '######+######',
    ],
  },
  {
    id: 'well', rarity: 3, depth: [2, 11], tags: ['water'],
    rows: [
      '#########',
      '#.......#',
      '#.≈≈≈.M.#',
      '#.≈$≈.*.#',
      '#.≈≈≈.?.#',
      '#.......#',
      '####+####',
    ],
  },
  {
    id: 'armory', rarity: 2, depth: [4, 13], tags: ['loot'],
    rows: [
      '###########',
      '#*.*.*#*.*#',
      '#.....#...#',
      '#..$M$..*.#',
      '#.....#...#',
      '#*.*.*#*.*#',
      '#####+#####',
    ],
  },
  {
    id: 'den', rarity: 3, depth: [3, 11], tags: ['monsters'],
    rows: [
      '#########',
      '#m,,,,,m#',
      '#,m,B,m,#',
      '#,,$*?,,#',
      '#m,,,,,m#',
      '####+####',
    ],
  },
  {
    id: 'shrine2', rarity: 2, depth: [5, 15], tags: ['altar', 'loot'],
    rows: [
      '#########',
      '#&_&.&_&#',
      '#.......#',
      '#._/$/_.#',
      '#.......#',
      '#&_&M&_&#',
      '####+####',
    ],
  },
  {
    id: 'maze2', rarity: 3, depth: [4, 14], tags: ['maze', 'loot'],
    rows: [
      '###########',
      '#.#.#.#.#.#',
      '#...#$#...#',
      '#.#.#?#.#.#',
      '#M..#*#..M#',
      '#.#.#.#.#.#',
      '#....+....#',
    ],
  },
];

export function vaultsForDepth(depth) {
  return VAULTS.filter(v => depth >= v.depth[0] && depth <= v.depth[1]);
}

/* テンプレートの寸法 */
function dims(v) { return { w: Math.max(...v.rows.map(r => r.length)), h: v.rows.length }; }

/* 盤に置けそうな左上座標を探す（中に床がある＝遊び場の中、縁から余白） */
function findSpot(level, rng, w, h, avoid = [], tries = 100) {
  for (let i = 0; i < tries; i++) {
    const x = rng.range(2, level.w - w - 2);
    const y = rng.range(2, level.h - h - 2);
    const rect = new Rect(x, y, w, h);
    let floor = 0, bad = false;
    rect.each((cx, cy) => {
      if (level.walkable(cx, cy)) floor++;
      const c = level.get(cx, cy);
      if (c === T.STAIRS_DOWN || c === T.STAIRS_UP) bad = true;
    });
    for (const a of avoid) if (a && rect.contains(a.x, a.y)) bad = true;
    if (bad) continue;
    // ある程度は既存の床に重なる場所に（孤立を避ける）
    if (floor >= Math.floor(w * h * 0.15)) return rect;
  }
  return null;
}

/* テンプレートを押し当て、湧きの要望リストを返す。置けなければ null。 */
export function stampVault(level, rng, v, opts = {}) {
  const { w, h } = dims(v);
  const rect = opts.rect || findSpot(level, rng, w, h, opts.avoid || []);
  if (!rect) return null;
  const spawns = [];
  for (let ry = 0; ry < v.rows.length; ry++) {
    const row = v.rows[ry];
    for (let rx = 0; rx < row.length; rx++) {
      const ch = row[rx];
      if (ch === ' ') continue;                 // 触れない
      const x = rect.x + rx, y = rect.y + ry;
      if (!level.inBounds(x, y)) continue;
      if (SYM[ch] !== undefined) { level.set(x, y, SYM[ch]); continue; }
      const sp = SPAWN[ch];
      if (sp) { level.set(x, y, T.FLOOR); spawns.push({ x, y, ...sp }); }
    }
  }
  level.meta.vault = v.id;
  return { rect, spawns, id: v.id };
}
