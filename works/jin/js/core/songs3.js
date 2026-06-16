/* ============================================================
   陣 — 幕間の曲。SONGS へ Object.assign で合流する（songs.js が取り込む）。
   camp：拠点のテーマ。戦いの合間の安らぎ。ハ長調、穏やかで気高く、希望を綴る。
   arena：闘技場のテーマ。弾むベースと小気味よい裏打ち、軽やかな高揚。
   notation.js の作法に従う（1小節=16ステップ）。DOM 非依存・副作用なし。
   ============================================================ */

/* 拠点：静かな鼓動。控えめなキック、葉擦れのようなハイハット。 */
const REST_BEAT = 'x:4 h:2 h:2 o:4 h:2 h:2';
const REST_HAT  = 'h:2 h:2 x:2 h:2 o:4 h:2 h:2';
/* 闘技場：跳ねる裏打ちのバックビート。 */
const BOUNCE = 'x:2 h:1 h:1 o:2 h:2 x:1 x:1 h:2 o:2 h:2';
const FILL   = 'x:2 o:2 x:2 o:2 o:1 o:1 o:1 o:1 c:4';

export const EXTRA_SONGS3 = {

  /* 拠点のテーマ。ハ長調、安らぎと再起。AメロとBメロを持つ。 */
  camp: {
    name: '憩 — 拠点',
    bpm: 102,
    loopSteps: 128,
    tracks: [
      // 旋律 square：A（問い）→ A'（答え）→ B（高まり）→ 終止
      { inst: 'square', vol: 0.3, data:
        // A — C  G/B  Am  F
        'e4:4 g4:4 c5:4 b4:2 a4:2 ' +
        'g4:4 e4:2 g4:2 a4:4 g4:4 ' +
        // A' — Am  G  F  C
        'e4:4 a4:4 c5:2 b4:2 a4:4 ' +
        'g4:4 e4:4 g4:2 e4:2 c4:4 ' +
        // B — F  G  C  Am
        'a4:4 c5:4 d5:2 c5:2 b4:4 ' +
        'd5:4 b4:4 c5:8 ' +
        // 終止 — F  G  C
        'a4:2 b4:2 c5:4 d5:4 b4:4 ' +
        'g4:4 e4:4 c4:8 '
      },
      // 和声 triangle：コードの芯を支える
      { inst: 'triangle', vol: 0.16, data:
        'c4:8 b3:8 ' +
        'c4:8 e4:8 ' +
        'c4:8 b3:8 ' +
        'e4:8 g3:8 ' +
        'f3:8 d4:8 ' +
        'g3:8 e4:8 ' +
        'f3:8 g3:8 ' +
        'g3:8 c4:8 '
      },
      // ベース：穏やかな歩み（駆け足ではない）
      { inst: 'bass', vol: 0.44, data:
        'c2:4 g2:4 g2:4 b2:4 ' +
        'a2:4 e2:4 f2:4 c3:4 ' +
        'a2:4 e2:4 g2:4 d2:4 ' +
        'f2:4 c2:4 c2:4 g2:4 ' +
        'f2:4 c3:4 g2:4 d3:4 ' +
        'c2:4 g2:4 a2:4 e2:4 ' +
        'f2:4 a2:4 g2:4 b2:4 ' +
        'c2:4 g2:4 c2:8 '
      },
      // ドラム：疎らで柔らかなグルーヴ
      { inst: 'drum', vol: 0.46, data:
        REST_BEAT + ' ' + REST_HAT + ' ' +
        REST_BEAT + ' ' + REST_HAT + ' ' +
        REST_BEAT + ' ' + REST_HAT + ' ' +
        REST_BEAT + ' ' + 'x:4 h:2 h:2 o:4 c:4'
      },
    ],
  },

  /* 闘技場のテーマ。ト長調、弾む活気。キャッチーな反復の妙。 */
  arena: {
    name: '闘 — 闘技場',
    bpm: 138,
    loopSteps: 128,
    tracks: [
      // 旋律 square：跳ねるフック。問いと答え。
      { inst: 'square', vol: 0.3, data:
        // フック A — G  D
        'd5:2 g5:2 g5:2 a5:2 b5:4 g5:4 ' +
        'a5:2 d5:2 d5:2 e5:2 f#5:4 a5:4 ' +
        // フック A' — Em  C
        'b5:2 g5:2 g5:2 e5:2 b5:4 g5:4 ' +
        'c5:2 e5:2 g5:2 c6:2 b5:4 g5:4 ' +
        // B — C  D  G
        'e5:2 f#5:2 g5:2 a5:2 b5:4 d6:4 ' +
        'c6:2 b5:2 a5:2 g5:2 a5:4 f#5:4 ' +
        // 締め — D  G
        'd5:2 e5:2 f#5:2 g5:2 a5:4 b5:4 ' +
        'a5:2 f#5:2 g5:8 r:4 '
      },
      // 和声 square2：軽い相の手
      { inst: 'square2', vol: 0.15, data:
        'b4:4 r:4 a4:4 r:4 ' +
        'a4:4 r:4 g4:4 r:4 ' +
        'g4:4 r:4 e4:4 r:4 ' +
        'g4:4 r:4 g4:4 r:4 ' +
        'g4:4 r:4 a4:4 r:4 ' +
        'a4:4 r:4 c5:4 r:4 ' +
        'f#4:4 r:4 b4:4 r:4 ' +
        'a4:4 r:4 b4:4 r:4 '
      },
      // ベース：弾むウォーキング
      { inst: 'bass', vol: 0.48, data:
        'g2:2 g2:2 d3:2 g2:2 d2:2 d2:2 a2:2 d2:2 ' +
        'e2:2 e2:2 b2:2 e2:2 c2:2 c2:2 g2:2 c2:2 ' +
        'c2:2 c2:2 g2:2 c2:2 d2:2 d2:2 a2:2 d2:2 ' +
        'g2:2 g2:2 d3:2 g2:2 g2:2 b2:2 d3:2 g2:2 ' +
        'c2:2 c2:2 g2:2 c2:2 d2:2 d2:2 a2:2 d2:2 ' +
        'e2:2 e2:2 b2:2 e2:2 c2:2 c2:2 g2:2 c2:2 ' +
        'g2:2 g2:2 d3:2 g2:2 d2:2 d2:2 a2:2 d2:2 ' +
        'g2:2 d3:2 g2:2 d3:2 g2:2 g2:2 g2:2 g2:2 '
      },
      // ドラム：跳ねるバックビート、最後にフィル
      { inst: 'drum', vol: 0.5, data:
        BOUNCE + ' ' + BOUNCE + ' ' + BOUNCE + ' ' + FILL + ' ' +
        BOUNCE + ' ' + BOUNCE + ' ' + BOUNCE + ' ' + FILL
      },
    ],
  },
};
