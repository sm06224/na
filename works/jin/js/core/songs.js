/* ============================================================
   陣 — 曲の蔵。波形で鳴らすための、ただのデータ。
   音は ui/music.js（発振器）が組み立てる。ここは DOM 非依存・副作用なし。

   トラック文字列は notation.js の字句に従う：
     音符  = 音名＋オクターブ（＋":長さ"）  例 c4  f#5  eb3:8
     休符  = r（＋":長さ"）
     打    = x(バスドラ) o(スネア) h(ハイハット) c(クラッシュ)
     "_"   = 直前の音を伸ばす（タイ）
   長さは十六分音符の数。既定 4（四分音符）。8=二分、16=全音符、2=八分、1=十六分。
   臨時記号は "#" か "b" を一つだけ：f#5, eb3（fs5 や cs5 は不可）。

   時間の作法（全曲共通）：
     1小節 = 16ステップ（十六分×16）= 四分音符4つ。
     旋律・伴奏・ベースは「四分音符の並び（既定長4）」を基本に、
     1行 = 4ステップ×4 = 16ステップ = 1小節 に揃える。
     ドラムは十六分の刻みなので明示的に長さを書く（h:1 等）。
     loopSteps は最長＝全トラックの総長（みな一致させてある）。

   楽器 inst: 'square' | 'square2' | 'triangle' | 'pulse' | 'saw' | 'bass' | 'drum'
   ============================================================ */

import { validateSong } from './notation.js';   // テスト時のみ使う想定（ここでは呼ばない）

/* ドラムの1小節パターン部品（各 16 ステップ）。読みやすさのための定数。 */
const D = {
  rock:   'x:2 h:2 o:2 h:2 x:2 h:2 o:2 h:2',           // 基本のロック
  rockf:  'x:2 h:2 o:2 h:2 x:2 o:2 x:1 x:1 o:2',       // 締めのフィル
  march:  'x:2 x:2 o:2 h:2 x:2 x:2 o:2 h:2',           // 行進
  gallop: 'x:1 h:1 h:2 o:2 x:2 x:1 h:1 h:2 o:2 x:2',   // 駆け足
  half:   'x:4 r:2 o:2 x:2 r:2 o:4',                   // ゆるい半拍
  beat4:  'x:2 h:2 o:2 h:2 x:2 o:2 x:2 o:2',           // 四つ打ち寄り
  quiet:  'x:4 r:4 o:4 r:4',                           // 静かな刻み
  spar:   'x:4 r:4 o:4 r:2 x:2',                       // まばら
  crash:  'c:8 x:2 o:2 x:2 o:2',                        // クラッシュ入り締め
};

export const SONGS = {

  /* 気高く、希望に満ちた主題。Cメジャー、堂々とした行進の歩幅。 */
  title: {
    name: '陣 — 主題',
    bpm: 96,
    loopSteps: 256,
    tracks: [
      { inst: 'square', vol: 0.32, data:
        // A：呼びかけ（各行=1小節=16ステップ）
        'g4 c5 e5 g5 ' +
        'e5 c5 d5:8 ' +
        'f4 a4 c5 e5 ' +
        'c5 a4 g4:8 ' +
        'e4 g4 c5 e5 ' +
        'g5 e5 f5:8 ' +
        'a4 g4 e5 d5 ' +
        'c5 d5 c5:8 ' +
        // B：高みへ
        'e5 f5 g5 a5 ' +
        'g5 f5 e5:8 ' +
        'd5 e5 f5 g5 ' +
        'f5 e5 d5:8 ' +
        'c5 d5 e5 g5 ' +
        'c6 b5 a5:8 ' +
        'g5 f5 e5 d5 ' +
        'c5:8 r:8 '
      },
      { inst: 'square2', vol: 0.18, data:
        'e4 g4 c5 e5 ' +
        'c5 g4 b4:8 ' +
        'c4 f4 a4 c5 ' +
        'a4 f4 e4:8 ' +
        'c4 e4 g4 c5 ' +
        'e5 c5 c5:8 ' +
        'f4 e4 c5 b4 ' +
        'a4 b4 g4:8 ' +
        'c5 c5 e5 f5 ' +
        'e5 c5 c5:8 ' +
        'b4 c5 d5 e5 ' +
        'd5 c5 b4:8 ' +
        'g4 b4 c5 e5 ' +
        'g5 g5 f5:8 ' +
        'e5 d5 c5 b4 ' +
        'g4:8 r:8 '
      },
      { inst: 'bass', vol: 0.4, data:
        'c3 g2 c3 g2 ' +
        'f2 c3 g2 g2 ' +
        'c3 c3 e2 e2 ' +
        'a2 a2 g2 g2 ' +
        'c3 c3 g2 g2 ' +
        'c3 c3 f2 f2 ' +
        'a2 g2 c3 g2 ' +
        'c3 g2 c3 c3 ' +
        'c3 c3 g2 g2 ' +
        'c3 g2 c3 c3 ' +
        'g2 g2 d3 d3 ' +
        'g2 g2 d3 d3 ' +
        'c3 c3 e3 e3 ' +
        'g2 g2 a2 g2 ' +
        'g2 g2 g2 g2 ' +
        'c3:8 c3:8 '
      },
      { inst: 'drum', vol: 0.5, data:
        D.march + ' ' + D.march + ' ' + D.march + ' ' + D.rockf + ' ' +
        D.march + ' ' + D.march + ' ' + D.march + ' ' + D.rockf + ' ' +
        D.march + ' ' + D.march + ' ' + D.march + ' ' + D.rockf + ' ' +
        D.march + ' ' + D.march + ' ' + D.march + ' ' + D.crash
      }
    ]
  },

  /* 静かで物思わしい。マップ・導入の音。Aナチュラルマイナー、ゆったり。 */
  prologue: {
    name: '序章',
    bpm: 72,
    loopSteps: 128,
    tracks: [
      { inst: 'triangle', vol: 0.3, data:
        'a4:8 c5 e5 ' +
        'd5:8 c5:8 ' +
        'b4:8 g4 b4 ' +
        'a4:8 r:8 ' +
        'e5:8 d5 c5 ' +
        'b4:8 a4:8 ' +
        'c5:8 b4 a4 ' +
        'a4:16 '
      },
      { inst: 'pulse', vol: 0.14, data:
        'r:8 e4 g4 ' +
        'r:8 d4 e4 ' +
        'r:8 g4 a4 ' +
        'e4:8 r:8 ' +
        'r:8 c4 e4 ' +
        'r:8 a4 g4 ' +
        'r:8 c4 e4 ' +
        'a4:16 '
      },
      { inst: 'bass', vol: 0.36, data:
        'a2:16 ' +
        'e2:16 ' +
        'c3:16 ' +
        'a2:8 e2:8 ' +
        'c3:16 ' +
        'd3:8 g2:8 ' +
        'f2:8 e2:8 ' +
        'a2:16 '
      }
    ]
  },

  /* 英雄的な行進。緑野の戦い。Gメジャー、勇ましく弾む。 */
  battle_green: {
    name: '戦 — 緑野',
    bpm: 132,
    loopSteps: 256,
    tracks: [
      { inst: 'square', vol: 0.3, data:
        'g4:2 g4:2 d5:2 g4:2 b4:4 d5:4 ' +
        'g5:8 g5:4 f#5:4 ' +
        'e5:2 d5:2 e5:2 d5:2 b4:8 ' +
        'c5:2 c5:2 e5:2 c5:2 a4:4 c5:4 ' +
        'd5:2 c5:2 b4:2 a4:2 g4:4 a4:4 ' +
        'b4:8 g4:4 b4:4 ' +
        'd5:2 g5:2 f#5:2 e5:2 d5:4 e5:4 ' +
        'f#5:8 g5:8 ' +
        'g4:2 g4:2 d5:2 g4:2 b4:4 d5:4 ' +
        'g5:8 g5:4 f#5:4 ' +
        'e5:2 d5:2 e5:2 f#5:2 g5:8 ' +
        'a5:2 g5:2 f#5:2 e5:2 d5:4 e5:4 ' +
        'f#5:8 d5:8 ' +
        'g5:2 d5:2 b4:2 g4:2 a4:4 b4:4 ' +
        'd5:4 g5:4 g4:4 b4:4 ' +
        'g4:16 '
      },
      { inst: 'square2', vol: 0.17, data:
        'd4:2 d4:2 b4:2 d4:2 g4:4 b4:4 ' +
        'd5:8 b4:8 ' +
        'c5:2 a4:2 c5:2 a4:2 g4:8 ' +
        'e4:2 e4:2 c5:2 e4:2 f#4:4 a4:4 ' +
        'b4:2 a4:2 g4:2 f#4:2 e4:4 f#4:4 ' +
        'g4:8 d4:8 ' +
        'b4:2 b4:2 a4:2 g4:2 f#4:4 g4:4 ' +
        'a4:8 b4:8 ' +
        'd4:2 d4:2 b4:2 d4:2 g4:4 b4:4 ' +
        'd5:8 b4:8 ' +
        'c5:2 a4:2 c5:2 d5:2 b4:8 ' +
        'c5:2 b4:2 a4:2 g4:2 f#4:4 g4:4 ' +
        'a4:8 b3:8 ' +
        'b4:2 g4:2 d4:2 b3:2 c4:4 d4:4 ' +
        'b3:4 d4:4 d4:4 g4:4 ' +
        'g3:16 '
      },
      { inst: 'bass', vol: 0.46, data:
        // 八分の刻みで突き進むベース（戦の駆動）
        'g2:2 g2:2 g2:2 g2:2 d3:2 d3:2 g2:2 g2:2 ' +
        'g2:2 g2:2 g2:2 g2:2 d3:2 d3:2 d3:2 d3:2 ' +
        'g2:2 g2:2 g2:2 g2:2 d3:2 d3:2 d3:2 d3:2 ' +
        'c3:2 c3:2 c3:2 c3:2 a2:2 a2:2 a2:2 a2:2 ' +
        'g2:2 g2:2 g2:2 g2:2 d3:2 d3:2 d3:2 d3:2 ' +
        'g2:2 g2:2 g2:2 g2:2 d3:2 d3:2 d3:2 d3:2 ' +
        'd3:2 d3:2 d3:2 d3:2 b2:2 b2:2 b2:2 b2:2 ' +
        'd3:2 d3:2 d3:2 d3:2 g2:2 g2:2 g2:2 g2:2 ' +
        'g2:2 g2:2 g2:2 g2:2 d3:2 d3:2 g2:2 g2:2 ' +
        'g2:2 g2:2 g2:2 g2:2 d3:2 d3:2 d3:2 d3:2 ' +
        'c3:2 c3:2 c3:2 c3:2 g2:2 g2:2 g2:2 g2:2 ' +
        'a2:2 a2:2 a2:2 a2:2 e3:2 e3:2 e3:2 e3:2 ' +
        'd3:2 d3:2 d3:2 d3:2 a2:2 a2:2 a2:2 a2:2 ' +
        'g2:2 g2:2 d3:2 d3:2 b2:2 b2:2 g2:2 g2:2 ' +
        'd3:2 d3:2 d3:2 d3:2 g2:2 g2:2 g2:2 g2:2 ' +
        'g2:2 g2:2 g2:2 g2:2 g2:2 g2:2 g2:2 g2:2 '
      },
      { inst: 'drum', vol: 0.52, data:
        D.rock + ' ' + D.gallop + ' ' + D.rock + ' ' + D.rockf + ' ' +
        D.rock + ' ' + D.gallop + ' ' + D.rock + ' ' + D.crash + ' ' +
        D.rock + ' ' + D.gallop + ' ' + D.rock + ' ' + D.rockf + ' ' +
        D.gallop + ' ' + D.rock + ' ' + D.gallop + ' ' + D.crash
      }
    ]
  },

  /* 駆ける、異国情緒の戦い。砂漠。Dハーモニックマイナー（増二度）。 */
  battle_desert: {
    name: '戦 — 砂漠',
    bpm: 140,
    loopSteps: 128,
    tracks: [
      { inst: 'square', vol: 0.3, data:
        'd5:2 e5:2 f5:2 g5:2 a5:2 bb5:2 c#5:2 d5:2 ' +
        'a5:2 g5:2 f5:2 e5:2 d5:2 c#5:2 d5:4 ' +
        'd5:2 f5:2 e5:2 d5:2 c#5:2 d5:2 e5:2 f5:2 ' +
        'g5:2 f5:2 e5:2 c#5:2 d5:8 ' +
        'a5:2 a5:2 g5:2 f5:2 e5:2 f5:2 g5:2 e5:2 ' +
        'f5:2 e5:2 d5:2 c#5:2 d5:4 e5:4 ' +
        'bb5:2 a5:2 g5:2 f5:2 e5:2 d5:2 c#5:2 e5:2 ' +
        'd5:2 c#5:2 d5:2 e5:2 d5:8'
      },
      { inst: 'pulse', vol: 0.18, data:
        'd4:8 a4:8 ' +
        'a4:8 d4:8 ' +
        'd4:8 a4:8 ' +
        'g4:8 d4:8 ' +
        'f4:8 c#5:8 ' +
        'd5:8 a4:8 ' +
        'g4:8 a4:8 ' +
        'd4:8 a4:8 '
      },
      { inst: 'bass', vol: 0.44, data:
        'd2:2 d2:2 d3:2 d2:2 a2:2 a2:2 d2:2 d2:2 ' +
        'a2:2 a2:2 a2:2 a2:2 d2:2 d2:2 d2:2 d2:2 ' +
        'd2:2 d2:2 d3:2 d2:2 a2:2 a2:2 d2:2 d2:2 ' +
        'g2:2 g2:2 g2:2 g2:2 d2:2 d2:2 a2:2 a2:2 ' +
        'd2:2 d2:2 a2:2 a2:2 d3:2 d3:2 a2:2 a2:2 ' +
        'd2:2 d2:2 a2:2 a2:2 d2:2 d2:2 a2:2 a2:2 ' +
        'g2:2 g2:2 a2:2 a2:2 d2:2 d2:2 a2:2 a2:2 ' +
        'd2:2 d2:2 a2:2 a2:2 d2:8 '
      },
      { inst: 'drum', vol: 0.5, data:
        D.gallop + ' ' + D.gallop + ' ' + D.gallop + ' ' + D.rockf + ' ' +
        D.gallop + ' ' + D.gallop + ' ' + D.rockf + ' ' + D.crash
      }
    ]
  },

  /* 冷たく、張りつめた。雪の戦い。Eナチュラルマイナー、刺すような高音。 */
  battle_snow: {
    name: '戦 — 雪',
    bpm: 134,
    loopSteps: 128,
    tracks: [
      { inst: 'square', vol: 0.28, data:
        'e5:2 r:2 e5:2 r:2 g5:2 f#5:2 e5:4 ' +
        'b4:2 r:2 b4:2 r:2 d5:2 c5:2 b4:4 ' +
        'e5:2 r:2 f#5:2 r:2 g5:2 a5:2 b5:4 ' +
        'a5:2 g5:2 f#5:2 e5:2 d5:2 e5:2 f#5:4 ' +
        'g5:2 r:2 g5:2 r:2 b5:2 a5:2 g5:4 ' +
        'f#5:2 r:2 e5:2 r:2 d5:2 c5:2 b4:4 ' +
        'c5:2 b4:2 a4:2 g4:2 f#4:2 g4:2 a4:4 ' +
        'b4:2 c5:2 d5:2 e5:2 b4:8 '
      },
      { inst: 'pulse', vol: 0.15, data:
        'e4:8 b3:8 ' +
        'g3:8 b3:8 ' +
        'e4:8 c4:8 ' +
        'd4:8 b3:8 ' +
        'e4:8 b3:8 ' +
        'd4:8 g3:8 ' +
        'a3:8 f#3:8 ' +
        'g3:4 f#3:4 e3:8 '
      },
      { inst: 'bass', vol: 0.44, data:
        'e2:2 e2:2 e2:2 e2:2 e2:2 e2:2 b2:2 b2:2 ' +
        'g2:2 g2:2 g2:2 g2:2 b2:2 b2:2 b2:2 b2:2 ' +
        'e2:2 e2:2 e2:2 e2:2 c3:2 c3:2 c3:2 c3:2 ' +
        'd3:2 d3:2 d3:2 d3:2 b2:2 b2:2 b2:2 b2:2 ' +
        'e2:2 e2:2 e2:2 e2:2 e2:2 e2:2 b2:2 b2:2 ' +
        'd3:2 d3:2 d3:2 d3:2 g2:2 g2:2 g2:2 g2:2 ' +
        'a2:2 a2:2 a2:2 a2:2 f#2:2 f#2:2 f#2:2 f#2:2 ' +
        'b2:2 b2:2 b2:2 b2:2 e2:2 e2:2 e2:2 e2:2 '
      },
      { inst: 'drum', vol: 0.48, data:
        D.rock + ' ' + D.gallop + ' ' + D.rock + ' ' + D.rockf + ' ' +
        D.gallop + ' ' + D.rock + ' ' + D.gallop + ' ' + D.crash
      }
    ]
  },

  /* 暗く、不気味な。遺跡の戦い。Cマイナー、半音のためらい。 */
  battle_ruins: {
    name: '戦 — 遺跡',
    bpm: 128,
    loopSteps: 256,
    tracks: [
      { inst: 'square', vol: 0.27, data:
        'c5:4 eb5:2 c5:2 g4:4 ab4:4 ' +
        'g4:8 r:4 f#4:2 g4:2 ' +
        'c5:4 d5:2 eb5:2 d5:4 c5:4 ' +
        'b4:8 r:4 c5:2 d5:2 ' +
        'eb5:4 f5:2 eb5:2 d5:4 c5:4 ' +
        'g4:8 ab4:4 g4:4 ' +
        'f5:4 eb5:2 d5:2 c5:4 b4:4 ' +
        'c5:8 r:8 ' +
        'g5:4 ab5:2 g5:2 eb5:4 c5:4 ' +
        'd5:8 r:4 b4:2 c5:2 ' +
        'eb5:4 d5:2 c5:2 b4:4 ab4:4 ' +
        'g4:8 r:8 ' +
        'c5:4 eb5:2 g5:2 ab5:4 g5:4 ' +
        'f5:4 eb5:2 d5:2 c5:4 b4:4 ' +
        'd5:4 c5:2 b4:2 c5:4 g4:4 ' +
        'c5:16 '
      },
      { inst: 'pulse', vol: 0.14, data:
        'c4:8 g4:8 ' +
        'eb4:8 d4:8 ' +
        'c4:8 ab4:8 ' +
        'g4:8 g4:8 ' +
        'c4:8 ab4:8 ' +
        'eb4:8 d4:8 ' +
        'f4:8 g4:8 ' +
        'c4:16 ' +
        'eb4:8 c5:8 ' +
        'g4:8 b4:8 ' +
        'g4:8 ab4:8 ' +
        'g4:16 ' +
        'c4:8 g4:8 ' +
        'f4:8 g4:8 ' +
        'g4:8 g4:8 ' +
        'c4:16 '
      },
      { inst: 'bass', vol: 0.46, data:
        'c2:2 c2:2 c2:2 c2:2 g2:2 g2:2 c2:2 c2:2 ' +
        'g2:2 g2:2 g2:2 g2:2 c2:2 c2:2 c2:2 c2:2 ' +
        'c2:2 c2:2 c2:2 c2:2 ab2:2 ab2:2 ab2:2 ab2:2 ' +
        'g2:2 g2:2 g2:2 g2:2 g2:2 g2:2 g2:2 g2:2 ' +
        'c2:2 c2:2 c2:2 c2:2 ab2:2 ab2:2 ab2:2 ab2:2 ' +
        'g2:2 g2:2 g2:2 g2:2 c2:2 c2:2 c2:2 c2:2 ' +
        'f2:2 f2:2 f2:2 f2:2 g2:2 g2:2 g2:2 g2:2 ' +
        'c2:2 c2:2 c2:2 c2:2 c2:2 c2:2 c2:2 c2:2 ' +
        'c3:2 c3:2 c3:2 c3:2 g2:2 g2:2 g2:2 g2:2 ' +
        'g2:2 g2:2 g2:2 g2:2 g2:2 g2:2 g2:2 g2:2 ' +
        'eb2:2 eb2:2 eb2:2 eb2:2 ab2:2 ab2:2 ab2:2 ab2:2 ' +
        'g2:2 g2:2 g2:2 g2:2 g2:2 g2:2 g2:2 g2:2 ' +
        'c2:2 c2:2 c2:2 c2:2 ab2:2 ab2:2 ab2:2 ab2:2 ' +
        'f2:2 f2:2 f2:2 f2:2 g2:2 g2:2 g2:2 g2:2 ' +
        'g2:2 g2:2 g2:2 g2:2 g2:2 g2:2 g2:2 g2:2 ' +
        'c2:2 c2:2 c2:2 c2:2 c2:2 c2:2 c2:2 c2:2 '
      },
      { inst: 'drum', vol: 0.48, data:
        D.rock + ' ' + D.rock + ' ' + D.gallop + ' ' + D.rockf + ' ' +
        D.rock + ' ' + D.gallop + ' ' + D.rock + ' ' + D.crash + ' ' +
        D.rock + ' ' + D.rock + ' ' + D.gallop + ' ' + D.rockf + ' ' +
        D.gallop + ' ' + D.rock + ' ' + D.gallop + ' ' + D.crash
      }
    ]
  },

  /* 激しく、速い。火山の戦い。Eマイナー、突進する十六分。 */
  battle_volcano: {
    name: '戦 — 火山',
    bpm: 168,
    loopSteps: 128,
    tracks: [
      { inst: 'saw', vol: 0.26, data:
        'e5:1 e5:1 f5:1 e5:1 d5:1 e5:1 c5:1 e5:1 b4:1 e5:1 c5:1 e5:1 d5:1 c5:1 b4:1 a4:1 ' +
        'e5:1 e5:1 f5:1 e5:1 d5:1 e5:1 c5:1 e5:1 g5:2 f5:2 e5:2 d5:2 ' +
        'a5:1 g5:1 f5:1 e5:1 d5:1 c5:1 b4:1 c5:1 d5:1 e5:1 f5:1 g5:1 a5:2 g5:2 ' +
        'f5:1 e5:1 d5:1 c5:1 b4:1 a4:1 g4:1 a4:1 b4:1 c5:1 d5:1 e5:1 e5:4 ' +
        'e5:1 e5:1 f5:1 e5:1 d5:1 e5:1 c5:1 e5:1 b4:1 e5:1 c5:1 e5:1 d5:1 c5:1 b4:1 a4:1 ' +
        'g5:1 g5:1 a5:1 g5:1 f5:1 g5:1 e5:1 g5:1 d5:1 g5:1 e5:1 g5:1 f5:1 e5:1 d5:1 c5:1 ' +
        'b4:1 c5:1 d5:1 e5:1 f5:1 g5:1 a5:1 g5:1 f5:1 e5:1 d5:1 c5:1 b4:1 a4:1 g4:1 f4:1 ' +
        'e4:2 g4:2 b4:2 e5:2 g5:2 b5:2 e5:4'
      },
      { inst: 'square', vol: 0.2, data:
        'e4:4 e4:4 c4:4 a3:4 ' +
        'e4:4 c4:4 g4:8 ' +
        'a4:4 f4:4 e4:4 c4:4 ' +
        'd4:4 b3:4 e4:8 ' +
        'e4:4 e4:4 c4:4 a3:4 ' +
        'g4:4 e4:4 c4:4 g4:4 ' +
        'a4:4 f4:4 d4:4 b3:4 ' +
        'e4:4 g4:4 e4:8 '
      },
      { inst: 'bass', vol: 0.46, data:
        'e2:2 e2:2 e2:2 e2:2 e2:2 e2:2 c2:2 c2:2 ' +
        'e2:2 e2:2 e2:2 e2:2 g2:2 g2:2 g2:2 g2:2 ' +
        'a2:2 a2:2 a2:2 a2:2 c3:2 c3:2 c3:2 c3:2 ' +
        'd3:2 d3:2 d3:2 d3:2 b2:2 b2:2 b2:2 b2:2 ' +
        'e2:2 e2:2 e2:2 e2:2 e2:2 e2:2 c2:2 c2:2 ' +
        'g2:2 g2:2 g2:2 g2:2 c3:2 c3:2 c3:2 c3:2 ' +
        'a2:2 a2:2 a2:2 a2:2 b2:2 b2:2 b2:2 b2:2 ' +
        'e2:2 e2:2 e2:2 e2:2 e2:8 '
      },
      { inst: 'drum', vol: 0.52, data:
        D.beat4 + ' ' + D.beat4 + ' ' + D.beat4 + ' ' + D.rockf + ' ' +
        D.beat4 + ' ' + D.beat4 + ' ' + D.beat4 + ' ' + D.crash
      }
    ]
  },

  /* 威圧的で壮大。ボス戦。Dマイナー、重い四つ打ちと不協のきらめき。 */
  boss: {
    name: '将 — ボス',
    bpm: 144,
    loopSteps: 256,
    tracks: [
      { inst: 'square', vol: 0.28, data:
        'd5:2 a4:2 d5:2 f5:2 e5:4 d5:4 ' +
        'c#5:2 a4:2 c#5:2 e5:2 d5:4 a4:4 ' +
        'bb4:2 d5:2 f5:2 a5:2 g5:4 f5:4 ' +
        'e5:2 c#5:2 a4:2 e5:2 d5:8 ' +
        'f5:2 e5:2 d5:2 c#5:2 d5:2 e5:2 f5:4 ' +
        'g5:2 f5:2 e5:2 d5:2 c#5:2 d5:2 e5:4 ' +
        'a5:2 g5:2 f5:2 e5:2 d5:2 c#5:2 d5:4 ' +
        'a5:2 a4:2 d5:4 d5:8 ' +
        'd5:2 a4:2 d5:2 f5:2 e5:4 d5:4 ' +
        'c#5:2 a4:2 c#5:2 e5:2 d5:4 a4:4 ' +
        'bb4:2 g5:2 f5:2 e5:2 f5:4 g5:4 ' +
        'a5:2 g5:2 f5:2 e5:2 d5:8 ' +
        'd6:4 a5:4 f5:4 d5:4 ' +
        'e5:2 f5:2 g5:2 a5:2 bb5:4 a5:4 ' +
        'g5:2 f5:2 e5:2 d5:2 c#5:2 d5:2 e5:4 ' +
        'd5:8 a4:8 '
      },
      { inst: 'square2', vol: 0.18, data:
        'f4:2 e4:2 f4:2 a4:2 g4:4 f4:4 ' +
        'e4:2 c#4:2 e4:2 g4:2 f4:4 e4:4 ' +
        'd4:2 f4:2 a4:2 d5:2 bb4:4 a4:4 ' +
        'g4:2 e4:2 c#4:2 g4:2 f4:8 ' +
        'd4:2 c#4:2 d4:2 e4:2 f4:2 g4:2 a4:4 ' +
        'bb4:2 a4:2 g4:2 f4:2 e4:2 d4:2 c#4:4 ' +
        'f4:2 e4:2 d4:2 c#4:2 d4:2 a3:2 a3:4 ' +
        'd4:2 a4:2 f4:4 d4:8 ' +
        'f4:2 e4:2 f4:2 a4:2 g4:4 f4:4 ' +
        'e4:2 c#4:2 e4:2 g4:2 f4:4 e4:4 ' +
        'd4:2 bb4:2 a4:2 g4:2 a4:4 bb4:4 ' +
        'c#5:2 bb4:2 a4:2 g4:2 f4:8 ' +
        'f4:4 d4:4 a3:4 f4:4 ' +
        'g4:2 a4:2 bb4:2 c#5:2 d5:4 c#5:4 ' +
        'bb4:2 a4:2 g4:2 f4:2 e4:2 f4:2 g4:4 ' +
        'f4:8 a3:8 '
      },
      { inst: 'bass', vol: 0.48, data:
        'd2:2 d2:2 a2:2 d2:2 d2:2 d2:2 a2:2 a2:2 ' +
        'a2:2 a2:2 e2:2 a2:2 a2:2 a2:2 e2:2 e2:2 ' +
        'bb1:2 bb1:2 f2:2 bb1:2 d2:2 d2:2 a2:2 a2:2 ' +
        'a2:2 a2:2 e2:2 e2:2 d2:2 d2:2 d2:2 d2:2 ' +
        'd2:2 d2:2 a2:2 d2:2 d2:2 d2:2 a2:2 a2:2 ' +
        'a2:2 a2:2 e2:2 e2:2 a2:2 a2:2 e2:2 e2:2 ' +
        'd2:2 d2:2 a2:2 a2:2 a2:2 a2:2 a2:2 a2:2 ' +
        'd2:2 d2:2 a2:2 a2:2 d2:8 ' +
        'd2:2 d2:2 a2:2 d2:2 d2:2 d2:2 a2:2 a2:2 ' +
        'a2:2 a2:2 e2:2 a2:2 a2:2 a2:2 e2:2 e2:2 ' +
        'bb1:2 bb1:2 f2:2 f2:2 a2:2 a2:2 a2:2 a2:2 ' +
        'a2:2 a2:2 e2:2 e2:2 d2:2 d2:2 d2:2 d2:2 ' +
        'd2:2 d2:2 d2:2 d2:2 d2:2 d2:2 d2:2 d2:2 ' +
        'g2:2 g2:2 bb2:2 bb2:2 a2:2 a2:2 a2:2 a2:2 ' +
        'd2:2 d2:2 a2:2 a2:2 a2:2 a2:2 a2:2 a2:2 ' +
        'd2:2 d2:2 a2:2 a2:2 d2:8 '
      },
      { inst: 'drum', vol: 0.54, data:
        D.beat4 + ' ' + D.beat4 + ' ' + D.beat4 + ' ' + D.rockf + ' ' +
        D.beat4 + ' ' + D.beat4 + ' ' + D.beat4 + ' ' + D.rockf + ' ' +
        D.beat4 + ' ' + D.beat4 + ' ' + D.beat4 + ' ' + D.rockf + ' ' +
        D.beat4 + ' ' + D.beat4 + ' ' + D.beat4 + ' ' + D.crash
      }
    ]
  },

  /* 短い凱歌。勝利のファンファーレ。Cメジャー、輝かしく。 */
  victory: {
    name: '勝鬨',
    bpm: 132,
    loopSteps: 64,
    tracks: [
      { inst: 'square', vol: 0.34, data:
        'g4:2 g4:2 g4:2 g4:2 c5:6 e5:2 ' +
        'g5:6 e5:2 c6:4 g5:4 ' +
        'a5:2 g5:2 f5:2 e5:2 d5:4 e5:4 ' +
        'c5:8 c5:8 '
      },
      { inst: 'square2', vol: 0.2, data:
        'e4:2 e4:2 e4:2 e4:2 e4:6 g4:2 ' +
        'c5:6 g4:2 e5:4 c5:4 ' +
        'f5:2 e5:2 d5:2 c5:2 b4:4 c5:4 ' +
        'g4:8 e4:8 '
      },
      { inst: 'bass', vol: 0.44, data:
        'c3:4 c3:4 c3:4 c3:4 ' +
        'c3:4 e3:4 c3:4 g2:4 ' +
        'f2:4 g2:4 g2:4 g2:4 ' +
        'c3:8 c3:8 '
      },
      { inst: 'drum', vol: 0.5, data:
        D.beat4 + ' ' + D.rockf + ' ' + D.beat4 + ' ' + D.crash
      }
    ]
  },

  /* 沈痛で、遅い。敗北。Aマイナー、うなだれる下降。 */
  defeat: {
    name: '敗',
    bpm: 60,
    loopSteps: 128,
    tracks: [
      { inst: 'triangle', vol: 0.3, data:
        'a4:8 g4 f4 ' +
        'e4:8 d4:8 ' +
        'c4:8 d4 e4 ' +
        'a3:16 ' +
        'e4:8 d4 c4 ' +
        'b3:8 a3:8 ' +
        'g3:8 a3 b3 ' +
        'a3:16 '
      },
      { inst: 'pulse', vol: 0.14, data:
        'c4:16 ' +
        'e4:8 a3:8 ' +
        'g3:8 e4:8 ' +
        'a3:16 ' +
        'c4:16 ' +
        'g3:8 e4:8 ' +
        'd4:8 c4:8 ' +
        'a3:16 '
      },
      { inst: 'bass', vol: 0.38, data:
        'a2:16 ' +
        'f2:8 e2:8 ' +
        'a2:8 g2:8 ' +
        'a2:16 ' +
        'a2:16 ' +
        'e2:8 e2:8 ' +
        'd2:8 e2:8 ' +
        'a2:16 '
      }
    ]
  },

  /* 温かく、結ぶように。エンディング。Fメジャー、満ち足りた終止。 */
  ending: {
    name: '結 — 終章',
    bpm: 84,
    loopSteps: 256,
    tracks: [
      { inst: 'triangle', vol: 0.32, data:
        'f4:4 g4:4 a4:6 c5:2 ' +
        'd5:4 c5:4 a4:8 ' +
        'g4:4 a4:4 bb4:6 a4:2 ' +
        'g4:8 f4:8 ' +
        'a4:4 c5:4 f5:6 e5:2 ' +
        'd5:4 c5:4 a4:8 ' +
        'bb4:4 a4:4 g4:6 c5:2 ' +
        'f4:16 ' +
        'c5:4 d5:4 e5:6 f5:2 ' +
        'e5:4 d5:4 c5:8 ' +
        'd5:4 c5:4 bb4:6 a4:2 ' +
        'g4:8 c5:8 ' +
        'a4:4 c5:4 f5:6 a5:2 ' +
        'g5:4 e5:4 c5:8 ' +
        'd5:4 c5:4 a4:6 g4:2 ' +
        'f4:16 '
      },
      { inst: 'square2', vol: 0.16, data:
        'a3:4 bb3:4 c4:6 e4:2 ' +
        'f4:4 e4:4 c4:8 ' +
        'bb3:4 c4:4 d4:6 c4:2 ' +
        'bb3:8 a3:8 ' +
        'c4:4 e4:4 a4:6 g4:2 ' +
        'f4:4 e4:4 c4:8 ' +
        'd4:4 c4:4 bb3:6 e4:2 ' +
        'f4:16 ' +
        'a3:4 bb3:4 c4:6 a4:2 ' +
        'g4:4 f4:4 e4:8 ' +
        'f4:4 e4:4 d4:6 c4:2 ' +
        'bb3:8 e4:8 ' +
        'c4:4 e4:4 a4:6 c5:2 ' +
        'bb4:4 g4:4 e4:8 ' +
        'f4:4 e4:4 c4:6 bb3:2 ' +
        'a3:16 '
      },
      { inst: 'bass', vol: 0.4, data:
        'f2:8 f2:8 ' +
        'bb2:8 f2:8 ' +
        'c3:8 c3:8 ' +
        'g2:8 c3:8 ' +
        'f2:8 a2:8 ' +
        'bb2:8 f2:8 ' +
        'g2:8 c3:8 ' +
        'f2:16 ' +
        'a2:8 a2:8 ' +
        'c3:8 c3:8 ' +
        'bb2:8 f2:8 ' +
        'g2:8 c3:8 ' +
        'f2:8 a2:8 ' +
        'bb2:8 c3:8 ' +
        'f2:8 c3:8 ' +
        'f2:16 '
      },
      { inst: 'drum', vol: 0.34, data:
        D.quiet + ' ' + D.quiet + ' ' + D.quiet + ' ' + D.half + ' ' +
        D.quiet + ' ' + D.quiet + ' ' + D.quiet + ' ' + D.half + ' ' +
        D.quiet + ' ' + D.quiet + ' ' + D.quiet + ' ' + D.half + ' ' +
        D.quiet + ' ' + D.quiet + ' ' + D.half + ' ' + D.crash
      }
    ]
  }

};

/* 第三幕の曲（天の戦・最終戦）を合流させる。 */
import { EXTRA_SONGS } from './songs2.js';
Object.assign(SONGS, EXTRA_SONGS);

/* 拠点・闘技場の曲を合流させる。 */
import { EXTRA_SONGS3 } from './songs3.js';
Object.assign(SONGS, EXTRA_SONGS3);

/* 凱歌・安らぎ・急襲の曲を合流させる。 */
import { EXTRA_SONGS4 } from './songs4.js';
Object.assign(SONGS, EXTRA_SONGS4);

export function song(id) { return SONGS[id] || null; }
