/* ============================================================
   窟 — タイル。迷宮を組む煉瓦の種類と、その性質。

   コアが知るのは「歩けるか・透けるか・掘れるか・液体か・扉か」。
   見た目（字と色）はデータとして持つが、描くのは UI の仕事。
   ============================================================ */

export const T = {
  VOID: 0,        // 圏外・無
  WALL: 1,
  FLOOR: 2,
  CORRIDOR: 3,
  DOOR_CLOSED: 4,
  DOOR_OPEN: 5,
  DOOR_SECRET: 6, // 見つかるまで壁のふり
  STAIRS_DOWN: 7,
  STAIRS_UP: 8,
  WATER: 9,       // 浅瀬（歩ける）
  DEEP_WATER: 10, // 深み（泳ぐ）
  LAVA: 11,
  CHASM: 12,      // 奈落（落ちる）
  RUBBLE: 13,     // 瓦礫（歩けるが遅い）
  GRASS: 14,
  TREE: 15,
  STATUE: 16,
  ALTAR: 17,
  FOUNTAIN: 18,
  TRAP: 19,       // 罠（見つかるまで床のふり）
  BARS: 20,       // 鉄格子（透けるが通れない）
  BRIDGE: 21,     // 橋（奈落・水の上）
  SAND: 22,
  ICE: 23,        // 氷（滑る）
  WEB: 24,        // 蜘蛛の巣（足止め）
  MOSS: 25,       // 苔（床の変種）
  PORTAL: 26,     // 門（特殊な階へ）
};

/* 性質表。ch/color は UI 用のデータ。 */
const P = {};
function def(code, o) { P[code] = o; }

def(T.VOID, { name: '虚', ch: ' ', color: '#000', walk: false, clear: false });
def(T.WALL, { name: '壁', ch: '#', color: '#6b6151', walk: false, clear: false, dig: true });
def(T.FLOOR, { name: '床', ch: '·', color: '#5a5346', walk: true, clear: true });
def(T.CORRIDOR, { name: '通路', ch: '·', color: '#4e4940', walk: true, clear: true });
def(T.DOOR_CLOSED, { name: '閉じた扉', ch: '+', color: '#b08040', walk: true, clear: false, door: true });
def(T.DOOR_OPEN, { name: '開いた扉', ch: '/', color: '#c79456', walk: true, clear: true, door: true });
def(T.DOOR_SECRET, { name: '壁', ch: '#', color: '#6b6151', walk: false, clear: false, dig: true, secret: true });
def(T.STAIRS_DOWN, { name: '下り階段', ch: '>', color: '#e8e2d0', walk: true, clear: true, stairs: 1 });
def(T.STAIRS_UP, { name: '上り階段', ch: '<', color: '#e8e2d0', walk: true, clear: true, stairs: -1 });
def(T.WATER, { name: '浅瀬', ch: '~', color: '#3f7fb0', walk: true, clear: true, liquid: 'water', shallow: true });
def(T.DEEP_WATER, { name: '深み', ch: '≈', color: '#2a5f96', walk: true, clear: true, liquid: 'water', deep: true });
def(T.LAVA, { name: '溶岩', ch: '~', color: '#d3532a', walk: true, clear: true, liquid: 'lava', deadly: true });
def(T.CHASM, { name: '奈落', ch: '"', color: '#1a1722', walk: true, clear: true, chasm: true });
def(T.RUBBLE, { name: '瓦礫', ch: '∴', color: '#7a6f5c', walk: true, clear: true, slow: 1 });
def(T.GRASS, { name: '草', ch: '"', color: '#5b7a44', walk: true, clear: true });
def(T.TREE, { name: '木', ch: '♣', color: '#3f6b35', walk: false, clear: false, dig: true });
def(T.STATUE, { name: '像', ch: '&', color: '#9a9486', walk: false, clear: false });
def(T.ALTAR, { name: '祭壇', ch: '_', color: '#cfc8b4', walk: true, clear: true, altar: true });
def(T.FOUNTAIN, { name: '泉', ch: '{', color: '#5fa0c8', walk: false, clear: true, feature: 'fountain' });
def(T.TRAP, { name: '床', ch: '·', color: '#5a5346', walk: true, clear: true, trap: true });
def(T.BARS, { name: '鉄格子', ch: '╫', color: '#8a8475', walk: false, clear: true });
def(T.BRIDGE, { name: '橋', ch: '=', color: '#7a5c3a', walk: true, clear: true, bridge: true });
def(T.SAND, { name: '砂', ch: '·', color: '#9a8a5e', walk: true, clear: true });
def(T.ICE, { name: '氷', ch: '·', color: '#a9d3e0', walk: true, clear: true, slip: true });
def(T.WEB, { name: '蜘蛛の巣', ch: '*', color: '#cfcabb', walk: true, clear: true, web: true });
def(T.MOSS, { name: '苔床', ch: '·', color: '#4e6b40', walk: true, clear: true });
def(T.PORTAL, { name: '門', ch: 'Ω', color: '#b988e0', walk: true, clear: true, portal: true });

export const TILES = P;
export function tileProp(code) { return P[code] || P[T.VOID]; }
export function tileName(code) { return tileProp(code).name; }

/* 性質の問い合わせ（コアが使う述語） */
export const isWalkable = code => !!tileProp(code).walk;
export const isClear = code => !!tileProp(code).clear;     // 視線が透ける
export const isDiggable = code => !!tileProp(code).dig;
export const isDoor = code => !!tileProp(code).door;
export const isLiquid = code => !!tileProp(code).liquid;
export const isDeadly = code => !!tileProp(code).deadly;
export const isStairs = code => tileProp(code).stairs !== undefined;
export const isSecret = code => !!tileProp(code).secret;
