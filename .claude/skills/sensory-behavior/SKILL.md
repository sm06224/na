---
name: sensory-behavior
description: >
  視聴覚 + 官能の動的動作テスト — マウス・クリック・スクロール・キーボードを
  人間のように動かしてページに触り、目(スクショ画素差分・elementFromPoint)と
  耳(AudioContext タップで録音 → dBFS・クリッピング・音階解析)で「よくない動き」
  (dead click / dead scroll / dead input / dead mute / 覆われた要素 / 音の破綻 /
  裏の例外 / 画面の嘘)を見つけて潰し、仕上げに官能検品(Claude の目 + user の耳)
  まで回すワークフロー。「視覚テストして」「音のテスト」「官能テスト」「実機で触って
  確かめて」「このUIちゃんと動く?」「音鳴ってる?」という文脈で必ず使う。
  ハーネスは Claude の実行環境(プリインストール Chromium + Node 22)でそのまま動き、
  スキルディレクトリごとコピーすれば他リポジトリでも使える。
---

# 視聴覚動作テスト — 人間のように触り、画面と音で確かめる

マウスは曲線を描いて動き、クリックには間があり、キーには緩急がある。
そうやって**人間のようにページに触り**、結果を**目と耳の両方**で確かめる:

- **目**: 操作前後のスクリーンショット画素差分(absdiff)+ 画面の観測点の値
- **耳**: ページが作る `AudioContext` に盗聴タップを仕込み、実際に鳴った音を
  PCM で捕獲 → 音量(dBFS)・クリッピング・卓越周波数と音名・音階の協和を解析
- **官能**: 機械で測れる指標は機械で、測れない「心地よさ」は Claude の目
  (画像検品)と user の耳(.wav)に渡す — 三者で分担する官能検査

[PKC2 の visual parity testing](https://github.com/sm06224/pkc2/blob/main/docs/development/visual-state-parity-testing.md)
(生成 ≠ 描画、programmatic click ≠ 実機 click)の系譜を、聴覚と官能まで広げたもの。

## 前提環境(Claude の実行環境で動くことが正)

- **Node ≥ 22**(内蔵 WebSocket で CDP を話す)
- **Chromium / Chrome がどこかにあること** — 探索順:
  `VISUAL_CHROME` → `/opt/pw-browsers/chromium`(Claude Code リモート環境の常備品)
  → `google-chrome`(GitHub Actions ランナー)→ `chromium` …。
  **バイナリのダウンロードはしない**(プロキシ 403 で死ぬ環境が多い)
- npm パッケージは現状不要だが、必要になったら使ってよい(依存ゼロは目的では
  なく結果。環境にある道具 — 例: Playwright 同梱の ffmpeg — も遠慮なく使う)

## 実行

```bash
node .claude/skills/sensory-behavior/run.js            # 全スペック
node .claude/skills/sensory-behavior/run.js han nami   # 名前で絞る
```

- **リポジトリのルートから実行**する(カレントディレクトリを静的サーバで配る)
- 結果: `test-results/visual/report.html`(画像埋め込みの自己完結 HTML)+
  スクショ PNG + **録音 .wav / 波形 PNG / スペクトログラム PNG**。
  1 本でも FAIL なら exit 1

## 実行後の検品規律(Claude の作法)

1. **スクショ・波形・スペクトログラムを Read で全部検品**してから結果を語る
2. **md5 重複検出**で空振りショットを探す:
   `md5sum test-results/visual/*.png | awk '{print $1}' | sort | uniq -d`
   — ただし**無音同士の波形は同じ絵になる**(正当な重複)。中身を見て判断
3. user に見せるときは diff や DOM ダンプでなく**画像とレポートで**。音は
   **.wav を SendUserFile で渡す**(最終官能は user の耳が行う)

## 三つの規律(スペックの背骨)

1. **到達可能性** — 押す前に `elementFromPoint` で「その座標に本当に最前面で
   見えているか」を確かめる(`t.human.click` に内蔵)。フェード中のオーバーレイに
   覆われた要素は人間には押せない。テストでも押せてはいけない
2. **実イベント** — `el.click()` ではなく CDP `Input.dispatch*Event` で OS 由来と
   同じイベント列。軌道はベジェ + ease-in-out、揺らぎは**スペック名 seed の
   決定的乱数**(人間らしく、再現可能)
3. **画面と音で確かめ、比較して潰す** — 結果は内部状態でなく**出力**(画素と
   PCM)で assert する

## 見つける「よくない動き」のカタログ

| よくない動き | 検出方法 |
|---|---|
| dead click(押しても何も起きない) | `t.act(…, { expect: 'change' })` の差分が閾値未満 |
| 勝手に動く(起きてはいけない変化) | `t.act(…, { expect: 'none' })` の差分が閾値超過 |
| dead scroll / dead input | 実ホイール→`scrollY`、実打鍵→出力領域と表示値 |
| 覆われて押せない要素 | `t.human.reach()` が別要素を返す |
| **音が鳴らない(dead sound)** | `t.listen.record()` の RMS が閾値未満 |
| **消音が効かない(dead mute)** | 消音操作後の録音が無音でない |
| **音の破綻** | クリッピング率 > 0.1% / 意図しない不協和(音階判定) |
| 画面の嘘(表示とデータの不一致) | 表示値と画面上の実体の突き合わせ |
| 裏の悲鳴 | ページ内例外・console.error・リソース読込失敗を常時収集 → FAIL |

## スペックの書き方

`specs/<nn>-<name>.visual.js`。既存 5 本がお手本(01 玄関 = scroll+遷移 /
02 計 = 打鍵 / 03 反 = クリックと不動 / 04 波 = canvas+水音+消音 /
05 庭 = 環境音の協和と消音)。

```js
export default {
  name: '作品名 — 何を確かめるか',
  async run(t) {
    await t.goto('/works/xxx/');
    await t.act('押すと一覧が増える', { expect: 'change', sel: '#list' }, async () => {
      await t.human.click('#add');
    });
    // 耳: 操作の間に鳴った音を録って解析
    const s = await t.listen.record('効果音', async () => {
      await t.human.click('#play');
      await t.page.settle(1500);
    });
    if (s) {
      t.expect(s.rmsDb > -50, `音が鳴る(${s.rmsDb.toFixed(1)} dBFS)`);
      t.expect(s.clipRatio < 0.001, '音が割れていない');
    }
  },
};
```

主要 API:

- **t**: `goto` / `shot(label, {sel?})` / `diff(label, a, b, {threshold?})` /
  `act(label, {expect, sel?, ratio?}, fn)` / `expect` `pass` `fail` `warn` `note` /
  `page.eval` / `page.waitFor` / `page.settle`
- **t.human**: `click` / `reach` / `bringIntoView` / `type`(非 ASCII は IME
  確定経路)/ `press` / `wheel` / `drag` / `moveTo` `clickAt` `buttonDown` `buttonUp`
- **t.listen**: `record(label, action | 待機ms, {ctx?, settle?})` →
  `{ rmsDb, peakDb, clipRatio, peaks[{freq,name,cents}], pitchClasses, pentaRoot, summary }`
  or `null`(AudioContext 不在)。.wav / 波形 / スペクトログラムを自動保存

## 官能検査の分担(視聴覚の「良し悪し」をどう判定するか)

| 層 | 誰が | 何を |
|---|---|---|
| 機械計測 | ハーネス | dBFS / クリッピング / 音階の協和(ペンタトニック判定)/ 画素差分 / 応答の有無 |
| 多感覚検品 | **Claude** | スクショの構図崩れ・にじみ・欠け、スペクトログラムの異常(意図しない常鳴り・ノイズ床・唐突な断絶)、波形の異常(DC オフセット・ぶつ切り) |
| 最終官能 | **user** | .wav を耳で聴く(心地よさ・作品意図との一致)。SendUserFile で必ず届ける |

Claude の官能検品ルーブリック(報告に一言ずつ入れる):
**見え** = 破綻(欠け・重なり・にじみ)は無いか / 意図した情景に見えるか。
**聴こえ** = 静寂は静寂か / 鳴るべき時に鳴るか / 音量感は節度あるか(-20〜-45
dBFS が目安、0 dBFS 近接は破綻)/ 調性は作品意図(例: 五音音階)どおりか。
**触り心地** = act の応答は一拍以内か / 操作が「吸われる」瞬間は無いか。

## 落とし穴(実際に踏んだもの)

- **フェード中のオーバーレイが pointer を吸う**: 波・庭の intro は 1.5s の fade で
  消えるが、その間 pointerdown を幕が吸い込む。`hidden` フラグの DOM 観測では
  「開いた」ように見える — 到達可能性の見張りだけが検出した。操作対象が出た後も
  **手が届くまで待つ**(`elementFromPoint` を `t.page.waitFor` で見張る)
- **常時アニメーション(canvas)は瞬間比較が効かない**: 先に「凪」(無操作時の
  自然な揺らぎ)を測り、操作後の変化がその数倍 + 絶対下限を上回ることを要求。
  画素閾値 `threshold` を上げて微細なゆらめきを無視(波は 40 で凪 0.00% vs 大波 13%)
- **波は減衰する**: 「リセットで画面が変わる」を試すなら**直前に大波を立て直す**。
  小波は 1 秒で閾値未満に薄れ、平らな水面のリセットは何も変えない(dead
  interaction の誤検出になる)
- **hover の残り香が差分を汚す**: `t.act` は判定前にマウスを隅へ park する
- **残響の尾**: 消音の検証は、消音操作のあと残響が減衰しきるのを待ってから録る
  (波は 1.2s 待ち)。gain ランプで消えるタイプ(庭は 0.8s)も同様
- **`--mute-audio` はデバイス出力を黙らせるだけ**: WebAudio グラフは動き続ける
  ので、タップからは全部聴こえる。作品側の消音(自前 gain)はタップにも無音が
  届く — だから「消音が本当に効くか」を検証できる
- **雨や自動イベントが基準を濡らす**: 作品の仕様まで読んで測る(波は「触って
  いる間は雨が降らない」ので指を置いたまま凪を測る)
- **favicon の 404 は既定で無視**。作品固有の無害な console 出力はスペックの
  `allow: [/…/]` で許す

## 他リポジトリへの展開

1. `.claude/skills/sensory-behavior/` を**ディレクトリごとコピー**(自己完結)
2. `specs/` を対象アプリ向けに書き直す(na の 5 本は消してよい)
3. ビルドが要るアプリは先にビルドし、配信ルート(cwd)に生成物がある状態で回す。
   アプリ独自の dev サーバがあるなら `run.js` の `serveStatic(ROOT)` を
   その origin に差し替える
4. CI に載せるなら「Node 22 + Chrome のある ubuntu ランナー」で
   `node .claude/skills/sensory-behavior/run.js` を叩き、`test-results/visual/`
   を artifact 保存するだけ(このリポジトリでは CI 非搭載 — スキルは Claude が
   手で回す道具、が現状の運用)

## 非ゴール

- pixel-perfect visual regression(golden 画像の維持はノイズが多い。「変わるべき
  時に変わる / 変わらないべき時に変わらない」という方向の検証に徹する)
- 音の完全な知覚モデル(ラウドネス規格や心理音響は追わない。dBFS・クリッピング・
  音階で「破綻していない・意図に沿う」を判定し、先は官能に渡す)
- 全網羅(網羅は unit/headless テストの仕事。1 機能につき少数・厚めのシナリオで
  「人間の触り心地」を守る)
