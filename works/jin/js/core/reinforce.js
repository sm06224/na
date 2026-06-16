/* ============================================================
   陣 — 増援。戦の半ばに、敵の新手が盤の縁から現れる。
   種と章から決定的に、いつ・どれだけ・どんな手勢が来るかが決まる。
   波は有限（章の決着は必ず着く）。早い章には来ない。
   ============================================================ */

const FOOT = ['soldier', 'fighter', 'mercenary', 'archer', 'knight', 'cavalier', 'brigand'];
const MONSTER = ['revenant', 'gargoyle', 'mogall'];

/* 章ごとの増援の波（純粋なデータ）。
   返り値：[{ turn, specs:[{classId, level, items}] }]（無ければ空）。 */
export function reinforcementSpecs(seed, chapterIndex, ch) {
  if (!ch || chapterIndex < 2) return [];      // 序盤は新手なし
  let h = ((seed >>> 0) ^ ((chapterIndex + 1) * 0x9e3779b1)) >>> 0;
  const next = () => { h ^= h << 13; h ^= h >>> 17; h ^= h << 5; h >>>= 0; return h / 0xffffffff; };

  const pool = ch.monster ? MONSTER.concat(FOOT.slice(0, 3)) : FOOT;
  const level = Math.max(1, (ch.level || 5) - 1);
  const waves = [];
  const waveCount = ch.boss || ch.monster ? 2 : 1;     // ボス・魔物の章は二波
  let turn = 3;
  for (let w = 0; w < waveCount; w++) {
    const count = 2 + (chapterIndex >= 9 ? 1 : 0);
    const specs = [];
    for (let i = 0; i < count; i++) {
      const cls = pool[(next() * pool.length) | 0];
      const items = cls === 'archer' ? ['iron_bow'] : cls === 'mage' ? ['fire'] : cls === 'fighter' ? ['iron_axe'] : ['iron_lance'];
      specs.push({ classId: cls, level, items });
    }
    waves.push({ turn, specs });
    turn += 3;
  }
  return waves;
}

/* 盤の縁の、進入できる空きマス（右列・上行＝敵の寄せ手）を集める。 */
export function edgeSpawnTiles(board) {
  const tiles = [];
  const ok = (x, y) => {
    const t = board.terrainAt(x, y);
    return t && t.move !== Infinity && !(board.occupied && board.occupied(x, y));
  };
  for (let y = 0; y < board.h; y++) if (ok(board.w - 1, y)) tiles.push({ x: board.w - 1, y });
  for (let x = 0; x < board.w; x++) if (ok(x, 0)) tiles.push({ x, y: 0 });
  return tiles;
}
