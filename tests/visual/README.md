# 動的視覚動作テスト — 人間のように触り、画面で確かめる

マウスは曲線を描いて動き、クリックには間があり、ホイールは刻まれ、キーには緩急がある。
そうやって**人間のように作品に触り**、「よくない動き」— 押しても効かないボタン、
回しても動かないページ、打っても現れない答え、裏で漏れる例外 — を
**操作前後の画像比較と画面の観測点**で見つけて潰す。

**依存パッケージはゼロ**。Node 22 内蔵の WebSocket で Chrome DevTools Protocol(CDP)を
直接話し、PNG の読み書き・差分も node:zlib で自前実装。`npm install` は不要で、
そこにあるブラウザ(Chromium / Chrome)だけで動く。

```bash
node tests/visual/run.js            # 全スペック
node tests/visual/run.js han nami   # 名前で絞る
VISUAL_CHROME=/path/to/chrome node tests/visual/run.js   # ブラウザ明示
```

結果は `test-results/visual/report.html`(画像埋め込みの自己完結 HTML、この 1 枚で
証跡が完結)と、個々の PNG。1 本でも FAIL なら exit 1。

## 系譜

[PKC2](https://github.com/sm06224/pkc2) の visual parity testing
(`docs/development/visual-state-parity-testing.md`)で確立した規律
**「生成 ≠ 描画、programmatic click ≠ 実機 click」** を継承し、
依存ゼロ・単体ファイル群として、どのリポジトリにも持ち出せる形に再実装した。

## 三つの規律

1. **到達可能性** — 押す前に `elementFromPoint(x, y)` で「その座標に本当に
   最前面で見えているか」を確かめる。DOM に在るだけでは足りない。
   `overflow` / `z-index` / フェード中のオーバーレイに覆われた要素は、人間には
   押せない。テストでも押せてはいけない。
2. **実イベント** — `el.click()` のような合成呼び出しではなく、CDP の
   `Input.dispatchMouseEvent / dispatchKeyEvent` で OS 由来と同じイベント列
   (pointerdown → mousedown → … → click)を発火する。カーソルは現在地から
   ベジェ曲線 + ease-in-out で運ばれ、押下と解放の間には人間の「間」がある。
3. **画面で確かめ、比較して潰す** — 結果は内部状態ではなく**画面**で assert する。
   表示された値そのもの、そして操作前後のスクリーンショットの画素差分
   (absdiff)。「操作したのに画面が変わらない」= dead interaction は
   この比較が機械的に検出する。

## 見つける「よくない動き」のカタログ

| よくない動き | 検出方法 |
|---|---|
| dead click(押しても何も起きない) | `act(…, { expect: 'change' })` の before/after 画素差分が閾値未満 |
| 勝手に動く(起きてはいけない変化) | `act(…, { expect: 'none' })` の差分が閾値超過 |
| dead scroll(回しても動かない) | ホイール実発火 → `scrollY` の実移動を assert |
| dead input(打っても現れない) | 実打鍵 → 出力領域の差分 + 表示値そのものを assert |
| 覆われて押せない要素 | `reach()` = `elementFromPoint` が別要素を返す |
| 画面の嘘(表示とデータの不一致) | 表示値と画面上の実体の突き合わせ(例: スコア表示 vs 盤上の石の数) |
| 裏の悲鳴 | ページ内例外・`console.error`・リソース読込失敗を常時収集、スペック終了時に FAIL 化 |
| 常時アニメーションの誤判定 | まず「凪」(無操作時の自然な揺らぎ)を測り、操作後の変化がそれを大きく上回ることを要求 |

## 構成

```
tests/visual/
  run.js              runner(スペック発見 → 実行 → 報告 → exit code)
  lib/
    cdp.js            CDP クライアント(内蔵 WebSocket、~100 行)
    browser.js        Chromium 探索と起動(ダウンロードは絶対にしない)
    server.js         リポジトリを配る静的サーバ(ES modules に正しい MIME)
    page.js           タブ操作面: goto / eval / settle / screenshot / 悲鳴の収集
    human.js          人間の手: 曲線マウス・緩急打鍵・刻みホイール・drag・到達可能性
    png.js            PNG decode/encode/absdiff(node:zlib のみ)
    report.js         自己完結 HTML レポート
    util.js           sleep / 決定的乱数(mulberry32)/ seed
  specs/
    *.visual.js       スペック(1 作品 1 ファイル)
```

「人間らしさ」の揺らぎ(軌道の膨らみ・打鍵間隔・クリック位置のずれ)は
**スペック名を seed にした決定的乱数**で生成する。人間らしく、しかし再現可能。

## スペックの書き方

```js
export default {
  name: '作品名 — 何を確かめるか',
  // allow: [/咎めない console メッセージ/],   // 任意
  async run(t) {
    await t.goto('/works/xxx/');

    // 操作 1 幕 = act。before/after を撮って差分で判定する
    await t.act('ボタンを押すと一覧が増える', { expect: 'change', sel: '#list' }, async () => {
      await t.human.click('#add');          // 到達可能性チェック込みの実クリック
    });

    // 画面の観測点を値で assert
    const n = await t.page.eval(`document.querySelectorAll('#list li').length`);
    t.expect(n === 1, `一覧に 1 件現れる(実際 ${n})`);

    await t.shot('追加後の一覧', { sel: '#list' });   // 証跡
  },
};
```

### t(コンテキスト)

| API | 役割 |
|---|---|
| `t.goto(route)` | サーバ相対 URL へ遷移(load + 描画静定待ち) |
| `t.shot(label, { sel? })` | スクショを撮って記録(sel でその要素の領域だけ) |
| `t.diff(label, a, b, { threshold? })` | 2 ショットの画素差分を記録し `{ ratio }` を返す |
| `t.act(label, opts, fn)` | fn の操作前後を比較。`expect: 'change' \| 'none'`、`sel` で領域、`ratio` で閾値 |
| `t.expect(cond, msg)` / `t.pass` / `t.fail` / `t.warn` / `t.note` | 判定と記録 |
| `t.page.eval(expr)` | ページ内評価(Promise は await) |
| `t.page.waitFor(expr, { timeout, label })` | 式が truthy になるまで待つ |
| `t.page.settle(ms)` | rAF 2 回 + ms の静定待ち |

### t.human(人間の手)

| API | 役割 |
|---|---|
| `click(sel)` | 到達可能性を確かめてから、中央付近(ど真ん中は避ける)を実クリック |
| `reach(sel)` | `elementFromPoint` による到達可能性の吟味(`{ ok, reason }`) |
| `bringIntoView(sel)` | 見えるまでホイールで探しにいく |
| `type(text)` / `press('Enter')` | 実打鍵。非 ASCII は IME 確定(insertText)で入る |
| `wheel(dy)` | 刻んで回すホイール |
| `drag(x1, y1, x2, y2)` | 押したまま運んで放す |
| `moveTo(x, y)` / `clickAt(x, y)` / `buttonDown()` / `buttonUp()` | 低水準の手 |

### act の判定

- `expect: 'change'` — 差分が閾値(既定 0.15%)**未満**なら **dead interaction** として FAIL
- `expect: 'none'` — 差分が閾値**超過**なら「変わらないはずの画面が変わった」として FAIL
- 判定前にマウスを隅へ「置きにいく」ので、hover の残り香で差分が汚れない

### 常時アニメーションする作品(canvas 等)

瞬間比較は使えない。**先に凪を測る**:無操作(または操作を封じた状態)で
2 ショットの差分 = 自然な揺らぎを基準にし、操作後の変化がその数倍 + 絶対下限を
上回ることを要求する。画素閾値(`threshold`)を上げて微細なゆらめきを
無視するのも有効。実例は `specs/04-nami.visual.js`(雨が降る仕様まで読んで、
指を置いたまま凪を測っている)。

## この手法が実際に見つけたもの

- **波**: 幕(intro)は 1.5 秒の fade で消えるが、その間 `pointerdown` を
  幕が吸い込み、開幕直後のタッチは水に届かない。DOM 上は
  `#bar.hidden = false` で「開いた」ように見える —
  到達可能性チェック(`elementFromPoint`)だけがこれを検出した。
  (PKC2 でも同型の「DOM は正しいが見えない/触れない」バグを
  demo スクショ検品が初検出している。手法の価値はここにある)

## 他リポジトリへの展開

1. `tests/visual/`(このディレクトリ)をそのままコピー(依存ゼロ・自己完結)
2. `specs/` を対象アプリ向けに書き直す
3. アプリの配信方法が違うなら `run.js` の `serveStatic(ROOT)` を差し替える
   (既にサーバがあるなら `origin` を向けるだけ)
4. CI は「Node 22 + ブラウザがある ubuntu ランナー」なら追加インストールなしで動く
   (`.github/workflows/test.yml` の `visual` job 参照)

前提は 2 つだけ: **Node ≥ 22**(内蔵 WebSocket)と **Chromium/Chrome が
どこかにある**こと(`VISUAL_CHROME` で明示可)。

## 非ゴール

- pixel-perfect な visual regression(golden 画像の維持はノイズが多い。
  ここでは「変わるべき時に変わる / 変わらないべき時に変わらない」という
  **方向の検証**に徹する)
- 全網羅(網羅は各作品の headless テストの仕事。ここは 1 作品につき
  少数・厚めのシナリオで「人間の触り心地」を守る)
