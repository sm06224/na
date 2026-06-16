/* ============================================================
   陣 — 第三幕の曲。SONGS へ Object.assign で合流する（songs.js が取り込む）。
   battle_sky：天を翔ける戦い。Aマイナーの昂ぶり、八分で突き進むベースと駆け足のドラム。
   finalboss：星を綴る者との最終戦。Dマイナー、重く壮大。
   notation.js の作法に従う（1小節=16ステップ）。DOM 非依存・副作用なし。
   ============================================================ */

const ROCK = 'x:2 h:2 o:2 h:2 x:2 h:2 o:2 h:2';
const GALLOP = 'x:1 h:1 h:2 o:2 x:2 x:1 h:1 h:2 o:2 x:2';
const CRASH = 'c:4 x:2 o:2 x:2 o:2 h:2 h:2';
const BEAT4 = 'x:2 h:2 o:2 h:2 x:2 o:2 x:2 o:2';

export const EXTRA_SONGS = {

  /* 天を翔ける戦い。Aマイナー、昂ぶる旋律。第三幕の通常戦。 */
  battle_sky: {
    name: '戦 — 天',
    bpm: 150,
    loopSteps: 128,
    tracks: [
      { inst: 'square', vol: 0.3, data:
        'a4:2 e5:2 a5:4 g5:2 e5:2 a5:4 ' +
        'f5:4 e5:2 d5:2 e5:8 ' +
        'g4:2 d5:2 g5:4 f5:2 d5:2 g5:4 ' +
        'e5:4 d5:2 c5:2 d5:8 ' +
        'a5:4 g5:2 f5:2 e5:4 d5:4 ' +
        'c5:2 d5:2 e5:4 f5:4 e5:4 ' +
        'd5:2 e5:2 f5:2 g5:2 a5:8 ' +
        'e5:8 a4:8 '
      },
      { inst: 'square2', vol: 0.16, data:
        'c4:8 e4:8 ' +
        'a3:8 b3:8 ' +
        'b3:8 d4:8 ' +
        'c4:8 a3:8 ' +
        'f4:8 e4:8 ' +
        'a3:8 c4:8 ' +
        'd4:8 f4:8 ' +
        'e4:8 a3:8 '
      },
      { inst: 'bass', vol: 0.46, data:
        'a2:2 a2:2 a2:2 a2:2 e2:2 e2:2 e2:2 e2:2 ' +
        'f2:2 f2:2 f2:2 f2:2 e2:2 e2:2 e2:2 e2:2 ' +
        'g2:2 g2:2 g2:2 g2:2 d2:2 d2:2 d2:2 d2:2 ' +
        'c2:2 c2:2 c2:2 c2:2 a2:2 a2:2 a2:2 a2:2 ' +
        'f2:2 f2:2 f2:2 f2:2 e2:2 e2:2 e2:2 e2:2 ' +
        'a2:2 a2:2 a2:2 a2:2 c3:2 c3:2 c3:2 c3:2 ' +
        'd2:2 d2:2 d2:2 d2:2 g2:2 g2:2 g2:2 g2:2 ' +
        'e2:2 e2:2 e2:2 e2:2 a2:2 a2:2 a2:2 a2:2 '
      },
      { inst: 'drum', vol: 0.5, data:
        ROCK + ' ' + GALLOP + ' ' + ROCK + ' ' + GALLOP + ' ' +
        ROCK + ' ' + GALLOP + ' ' + ROCK + ' ' + CRASH
      },
    ],
  },

  /* 星を綴る者との最終戦。Dマイナー、重く壮大。終々章。 */
  finalboss: {
    name: '将 — 墜ちる星',
    bpm: 152,
    loopSteps: 128,
    tracks: [
      { inst: 'square', vol: 0.3, data:
        'd5:2 a4:2 d5:2 f5:2 e5:4 d5:4 ' +
        'a5:2 g5:2 f5:2 e5:2 d5:8 ' +
        'bb4:2 d5:2 f5:2 bb5:2 a5:4 g5:4 ' +
        'f5:2 e5:2 d5:2 c#5:2 d5:8 ' +
        'd6:4 a5:4 f5:4 d5:4 ' +
        'e5:2 f5:2 g5:2 a5:2 bb5:4 a5:4 ' +
        'g5:2 f5:2 e5:2 d5:2 c#5:2 d5:2 e5:4 ' +
        'd5:8 a4:8 '
      },
      { inst: 'square2', vol: 0.17, data:
        'f4:8 a4:8 ' +
        'd4:8 a3:8 ' +
        'd4:8 f4:8 ' +
        'a3:8 a3:8 ' +
        'f4:8 d4:8 ' +
        'g4:8 f4:8 ' +
        'a4:8 a3:8 ' +
        'f4:8 a3:8 '
      },
      { inst: 'bass', vol: 0.5, data:
        'd2:2 d2:2 a2:2 d2:2 d2:2 d2:2 a2:2 a2:2 ' +
        'a2:2 a2:2 e2:2 a2:2 a2:2 a2:2 e2:2 e2:2 ' +
        'bb1:2 bb1:2 f2:2 bb1:2 d2:2 d2:2 a2:2 a2:2 ' +
        'a2:2 a2:2 e2:2 e2:2 d2:2 d2:2 d2:2 d2:2 ' +
        'd2:2 d2:2 d2:2 d2:2 d2:2 d2:2 d2:2 d2:2 ' +
        'g2:2 g2:2 bb2:2 bb2:2 a2:2 a2:2 a2:2 a2:2 ' +
        'd2:2 d2:2 a2:2 a2:2 a2:2 a2:2 a2:2 a2:2 ' +
        'd2:2 d2:2 a2:2 a2:2 d2:2 d2:2 d2:2 d2:2 '
      },
      { inst: 'drum', vol: 0.54, data:
        BEAT4 + ' ' + BEAT4 + ' ' + BEAT4 + ' ' + CRASH + ' ' +
        BEAT4 + ' ' + BEAT4 + ' ' + GALLOP + ' ' + CRASH
      },
    ],
  },
};
