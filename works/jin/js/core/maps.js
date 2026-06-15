/* ============================================================
   陣 — 名局（セットピース）。手描きのASCIIで、戦場を起こす。
   一文字が一マス。文字はLEGENDで地形idへ翻訳される。
   P=出撃（自軍配置）, E=湧き（敵出現）, B=将（敵の長）。
   これらは特別な印で、踏める下地（野なら平地、廃都なら石床）の上に乗る。
   橋は水と溶岩を渡す唯一の道。門は砦と城の咽喉。玉座は奪う的。
   盤面はすべて手で組んだ。隘路・橋頭・側面・退路 — 戦術がそこに在る。
   ============================================================ */

import { Board } from './board.js';

/* 描画文字 → 地形id。P/E/B は印（下地の上に置く）。 */
export const LEGEND = {
  '.': 'plain',
  '=': 'road',
  '"': 'grass',
  'f': 'forest',
  'F': 'thicket',
  '^': 'hill',
  'M': 'mountain',
  'A': 'peak',
  '~': 'water',
  '-': 'shallow',
  's': 'sand',
  '%': 'swamp',
  'r': 'ruins',
  '+': 'fort',
  'g': 'gate',
  '#': 'wall',
  '_': 'floor',
  'T': 'throne',
  '*': 'snow',
  'i': 'ice',
  'L': 'lava',
  'b': 'bridge',
  'P': '(deploy)',
  'E': '(spawn)',
  'B': '(boss)',
};

/* 印（P/E/B）が踏む下地。野外は平地、屋内系は石床。 */
const BIOME_BASE = {
  fort: 'plain',
  forest: 'plain',
  river: 'plain',
  desert: 'sand',
  ruins: 'floor',
  snow: 'snow',
  volcano: 'floor',
  throne: 'floor',
};

const MARKERS = new Set(['P', 'E', 'B']);

/* ============================================================
   8章の名局。各図は ~14-19 幅 × ~11-14 高。
   行はマップ内で必ず等幅（parseで検証）。
   ============================================================ */
export const SETPIECES = [

  /* ── 第一章 砦攻め ───────────────────────────────────────
     左から攻め寄せ、堀（浅瀬）と門を抜けて砦へ。
     門は一マスの咽喉、両脇の砦は守り手を癒す。将は本丸に座す。 */
  {
    id: 'ch1_fort_assault',
    name: '砦攻め',
    biome: 'fort',
    rows: [
      '...=====----g+++++',
      'P..="""-..--g+B++.',
      'P..="""-..--g+++.E',
      'P.."""-..--.g+++..',
      'P..=.fff..--.....E',
      'P..=.fff..##g....E',
      'P..=.fff..##g+++.E',
      'P..=""""-..-.g+++.',
      'P..=""""-..-.g+++E',
      'P..="""----..g++..',
      '...=====----g+++++',
    ],
  },

  /* ── 第二章 森の隘路 ─────────────────────────────────────
     中央を深い森が裂く。細い道だけが速い。
     伏兵は森から湧き、将は奥の丘の砦に潜む。 */
  {
    id: 'ch2_forest_pass',
    name: '森の隘路',
    biome: 'forest',
    rows: [
      'P..fFFff"".fFFff..E',
      'P.."ff"".==.."ffF.E',
      'P...ff".=..=."ffFf.',
      'P..fFf..=ff=..fFf.E',
      'P.""fF".=ff=.""fF.E',
      'P...ff..=..=..fff.E',
      'P..fFf".==.="ffFf.E',
      'P.."ff"".==..ff^+.B',
      'P..fFFff"".fFf^++.E',
      'P...ff""...."fF^+.E',
      'P..fFFff"".fFFff..E',
    ],
  },

  /* ── 第三章 川と橋 ───────────────────────────────────────
     深い川が盤を断つ。橋は二本だけ。浅瀬は遅い迂回。
     橋頭を制した者が川を制す。将は対岸の砦に。 */
  {
    id: 'ch3_river_bridge',
    name: '川と橋',
    biome: 'river',
    rows: [
      'P..="""~~~-...=...E',
      'P..="".~~~-..".=..E',
      'P.."".b~~~-...=...E',
      'P..=..b~~~b..=....E',
      'P..="".~~~b...="".E',
      'P..=...~~~-..=....E',
      'P.".".-~~~-.."=...E',
      'P..=..-~~~b..=+++.E',
      'P..="".~~~b..=+B+.E',
      'P..="""~~~-...=++.E',
      'P..="""~~~-...=...E',
    ],
  },

  /* ── 第四章 砂漠の隊商路 ─────────────────────────────────
     砂は足を取る。隊商路（道）だけが速い。
     沼地のオアシスは罠、丘の物見が要。将は隊商路の終端を扼す。 */
  {
    id: 'ch4_desert_road',
    name: '砂漠の隊商路',
    biome: 'desert',
    rows: [
      'Psss=====sssss^^ssE',
      'Pss=sss%%ssss^rr^.E',
      'Pss=ss%%%%sss^rr^.E',
      'Ps==sss%%ssss^^s..E',
      'Psss=sssssss====+.E',
      'Psss=ssss^^ss=ss+B.',
      'Psss=ssss^rs=sss+.E',
      'Pss==sss^^s==ssss.E',
      'Pss=ssss%%%sssss^^E',
      'Pss=ss%%%%%ss^^^rrE',
      'Psss==sssssss^^ssE.',
    ],
  },

  /* ── 第五章 廃都 ─────────────────────────────────────────
     倒れた都。壁が視線を切り、廃墟が身を守る。
     瓦礫の路地は迷路、開けた広場は危うい。将は崩れた本殿に。 */
  {
    id: 'ch5_ruined_city',
    name: '廃都',
    biome: 'ruins',
    rows: [
      'P_r#__r#___#r__#r_E',
      'P__#_r_#_rr_#__r#_E',
      'P_r#___#__r_#_r__.E',
      'P___#g#_##_#g#____E',
      'P_r__r__rr__r__r_.E',
      'P__#_##_#g#_##_#__E',
      'P_r___r_r__r__B__.E',
      'P___#g#_##_#g#____E',
      'P_r#__r#_rr_#r__#_E',
      'P__#_r_#g_g#_r__#rE',
      'P_r#___r#__#r___#_E',
    ],
  },

  /* ── 第六章 雪の関 ───────────────────────────────────────
     吹雪の峠。氷は滑り、雪は重い。山が両翼を閉ざす。
     関所（門と砦）が中央を扼す。将は関の奥に陣取る。 */
  {
    id: 'ch6_snow_pass',
    name: '雪の関',
    biome: 'snow',
    rows: [
      'PMMM***ii***MMM..E',
      'P*MM**iiii**MM*.*E',
      'P**M**i**i**M**.*E',
      'P***g+++++g***..*E',
      'P***+*****+***.**E',
      'P**i+**B**+i**.*.E',
      'P***+*****+***.**E',
      'P***g+++++g***..*E',
      'P**M**i**i**M**.*E',
      'P*MM**iiii**MM*.*E',
      'PMMM***ii***MMM..E',
    ],
  },

  /* ── 第七章 火口の城 ─────────────────────────────────────
     溶岩の海に浮かぶ城。橋だけが渡れる。落ちれば焼かれる。
     門を破れば内庭、将は溶岩を背に最後の橋を守る。 */
  {
    id: 'ch7_caldera_castle',
    name: '火口の城',
    biome: 'volcano',
    rows: [
      'P..LLLLbLLLLLL..._E',
      'P...LLLbLLLLL._##_E',
      'P"".LLLbLLLg#_____E',
      'P...LLLbLLLg#_+B+_E',
      'P"".LLLbLLLg#_+++_E',
      'P...Lbbbbbbb__+++_E',
      'P"".LLLbLLLg#_____E',
      'P...LLLbLLLg#_##__E',
      'P"".LLLbLLLLL._##_E',
      'P...LLLbLLLLLL...._',
      'P..LLLLbLLLLLL..._E',
    ],
  },

  /* ── 第八章 王座の間 ─────────────────────────────────────
     最後の広間。柱（壁）の列、衛士の門、玉座は最奥。
     玉座を奪えば終わり（seize）。将は玉座の前に立ちはだかる。 */
  {
    id: 'ch8_throne_hall',
    name: '王座の間',
    biome: 'throne',
    rows: [
      'P____#___#___#____',
      'P_E__#_E_#_E_#__E_',
      'P____g___g___g____',
      'P_##___________##_',
      'P_#_____+++_____#_',
      'P_______+B+______T',
      'P_#_____+++_____#_',
      'P_##___________##_',
      'P____g___g___g____',
      'P_E__#_E_#_E_#__E_',
      'P____#___#___#____',
    ],
  },

];

/* ============================================================
   解析。図を Board に起こし、印の座標を集める。
   ============================================================ */
export function parseMap(sp) {
  if (!sp || !Array.isArray(sp.rows) || sp.rows.length === 0) {
    throw new Error('parseMap: invalid setpiece');
  }
  const rows = sp.rows;
  const h = rows.length;
  const w = rows[0].length;

  // 等幅検証。
  for (let y = 0; y < h; y++) {
    if (rows[y].length !== w) {
      throw new Error(`parseMap: row ${y} of "${sp.id}" has width ${rows[y].length}, expected ${w}`);
    }
  }

  const legend = sp.legendOverrides ? { ...LEGEND, ...sp.legendOverrides } : LEGEND;
  const base = BIOME_BASE[sp.biome] || 'plain';

  const board = new Board(w, h);
  const deploy = [];
  const spawns = [];
  let boss = null;
  let hasThrone = false;

  for (let y = 0; y < h; y++) {
    const row = rows[y];
    for (let x = 0; x < w; x++) {
      const ch = row[x];

      if (MARKERS.has(ch)) {
        // 印は下地（biomeの基本地形）を踏む。
        board.setTerrain(x, y, base);
        if (ch === 'P') deploy.push({ x, y });
        else if (ch === 'E') spawns.push({ x, y });
        else if (ch === 'B') boss = { x, y };
        continue;
      }

      const id = legend[ch];
      if (id == null) {
        throw new Error(`parseMap: unknown char "${ch}" at (${x},${y}) in "${sp.id}"`);
      }
      // 印用のラベル文字列（'(deploy)'等）が紛れた場合は下地に。
      if (id[0] === '(') {
        board.setTerrain(x, y, base);
      } else {
        board.setTerrain(x, y, id);
        if (id === 'throne') hasThrone = true;
      }
    }
  }

  const objectiveHint = hasThrone ? 'seize' : 'rout';

  return { board, deploy, spawns, boss, objectiveHint };
}

/* idで名局を引く。無ければ null。 */
export function setpiece(id) {
  for (const sp of SETPIECES) {
    if (sp.id === id) return sp;
  }
  return null;
}
