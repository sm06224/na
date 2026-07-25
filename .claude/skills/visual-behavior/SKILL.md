---
name: visual-behavior
description: >
  動的視覚動作テスト — マウス・クリック・スクロール・キーボードを人間のように
  動かしてブラウザ上のページに触り、「よくない動き」(dead click / dead scroll /
  dead input / 覆われて押せない要素 / 裏の例外 / 画面の嘘)を操作前後の画像比較と
  画面の観測点で見つけて潰すワークフロー。「視覚テストして」「動的視覚テスト」
  「実機で触って確かめて」「dead click を探して」「このUIちゃんと動く?」という
  文脈で必ず使う。ハーネス(依存パッケージゼロ・CDP 直叩き)はこのスキルに同梱
  されており、スキルディレクトリごとコピーすれば他リポジトリでもそのまま使える。
---

# 動的視覚動作テスト — 人間のように触り、画面で確かめる

マウスは曲線を描いて動き、クリックには間があり、ホイールは刻まれ、キーには
緩急がある。そうやって**人間のようにページに触り**、「よくない動き」を
**操作前後の画像比較と画面の観測点**で見つけて潰す。

[PKC2 の visual parity testing](https://github.com/sm06224/pkc2/blob/main/docs/development/visual-state-parity-testing.md)
で確立した規律 **「生成 ≠ 描画、programmatic click ≠ 実機 click」** の系譜。
Playwright を使わず、**依存パッケージゼロ**(Node 22 内蔵 WebSocket で
CDP 直叩き、PNG の decode/encode/absdiff も node:zlib で自前実装)なので、
`npm install` できない環境・プロキシ配下でもそのまま動く。

## 実行

```bash
node .claude/skills/visual-behavior/run.js            # 全スペック
node .claude/skills/visual-behavior/run.js han nami   # 名前で絞る
VISUAL_CHROME=/path/to/chrome node .claude/skills/visual-behavior/run.js
```

- カレントディレクトリ(= リポジトリのルート)を静的サーバで配る。
  スペックの `t.goto('/works/xxx/')` はそこからの相対
- ブラウザは探索順 `VISUAL_CHROME` → `/opt/pw-browsers/chromium`(Claude Code
  リモート環境)→ `google-chrome` → `chromium` …。**ダウンロードは絶対にしない**
- 結果: `test-results/visual/report.html`(画像埋め込みの自己完結 HTML)+
  証跡 PNG。1 本でも FAIL なら exit 1

## 実行後の規律(Claude の作法)

1. **スクショと report.html を Read で全部検品**してから結果を語る。
   崩れ・空・想定外は実装バグとして扱う
2. **md5 重複検出**で「空振りショット」(操作が効かず同じ画面を撮っただけ)を
   見つける: `md5sum test-results/visual/*.png | awk '{print $1}' | sort | uniq -d`
   — 出力があれば操作が届いていない
3. user に見せるときは diff や DOM ダンプでなく**画像とレポートで**見せる

## 三つの規律(スペックを書くときの背骨)

1. **到達可能性** — 押す前に `elementFromPoint(x, y)` で「その座標に本当に
   最前面で見えているか」を確かめる(`t.human.click` に内蔵)。DOM に在るだけ
   では足りない。overflow / z-index / フェード中のオーバーレイに覆われた要素は
   人間には押せない。テストでも押せてはいけない
2. **実イベント** — `el.click()` ではなく CDP の `Input.dispatchMouseEvent /
   dispatchKeyEvent` で OS 由来と同じイベント列を発火。軌道は ベジェ +
   ease-in-out、揺らぎは**スペック名 seed の決定的乱数**(人間らしく、再現可能)
3. **画面で確かめ、比較して潰す** — 結果は内部状態でなく**画面**で assert。
   表示された値そのもの + before/after の画素差分(absdiff)

## 見つける「よくない動き」のカタログ

| よくない動き | 検出方法 |
|---|---|
| dead click(押しても何も起きない) | `t.act(…, { expect: 'change' })` の差分が閾値未満 |
| 勝手に動く(起きてはいけない変化) | `t.act(…, { expect: 'none' })` の差分が閾値超過 |
| dead scroll | ホイール実発火 → `scrollY` の実移動を assert |
| dead input | 実打鍵 → 出力領域の差分 + 表示値そのものを assert |
| 覆われて押せない要素 | `t.human.reach()` = `elementFromPoint` が別要素を返す |
| 画面の嘘(表示とデータの不一致) | 表示値と画面上の実体の突き合わせ(例: スコア表示 vs 盤上の石の数) |
| 裏の悲鳴 | ページ内例外・console.error・リソース読込失敗を常時収集 → FAIL 化 |

## スペックの書き方

`specs/<nn>-<name>.visual.js` に置く。既存 4 本がお手本
(01 玄関 = scroll+遷移 / 02 計 = 打鍵 / 03 反 = クリックと不動の検証 /
04 波 = 常時アニメーション canvas)。

```js
export default {
  name: '作品名 — 何を確かめるか',
  // allow: [/咎めない console メッセージ/],   // 任意
  async run(t) {
    await t.goto('/works/xxx/');
    await t.act('ボタンを押すと一覧が増える', { expect: 'change', sel: '#list' }, async () => {
      await t.human.click('#add');          // 到達可能性チェック込みの実クリック
    });
    const n = await t.page.eval(`document.querySelectorAll('#list li').length`);
    t.expect(n === 1, `一覧に 1 件現れる(実際 ${n})`);
    await t.shot('追加後の一覧', { sel: '#list' });   // 証跡
  },
};
```

主要 API(詳細はソースの JSDoc):

- **t**: `goto` / `shot(label, {sel?})` / `diff(label, a, b, {threshold?})` /
  `act(label, {expect: 'change'|'none', sel?, ratio?}, fn)` /
  `expect` `pass` `fail` `warn` `note` / `page.eval` / `page.waitFor` / `page.settle`
- **t.human**: `click(sel)` / `reach(sel)` / `bringIntoView(sel)` /
  `type(text)`(非 ASCII は IME 確定経路)/ `press('Enter')` / `wheel(dy)` /
  `drag(x1,y1,x2,y2)` / `moveTo` `clickAt` `buttonDown` `buttonUp`

## 落とし穴(実際に踏んだもの)

- **フェード中のオーバーレイが pointer を吸う**: 波(nami)の intro は 1.5s の
  fade で消えるが、その間 `pointerdown` を幕が吸い込み、開幕直後のタッチは水に
  届かない。`hidden` フラグ等の DOM 観測では「開いた」ように見える —
  `elementFromPoint` の見張りだけが検出した。操作対象が出た「後」も、
  **手が届くまで待つ**: `t.page.waitFor('document.elementFromPoint(x, y)?.id === …')`
- **常時アニメーションする作品(canvas 等)は瞬間比較が効かない**: 先に
  「凪」(無操作時の自然な揺らぎ)を測り、操作後の変化がその数倍 + 絶対下限を
  上回ることを要求する。画素閾値 `threshold` を上げて微細なゆらめきを無視する
  (nami は 40 で凪 0.00% vs 大波 13%)。作品の仕様も読む — nami は「触って
  いる間は雨が降らない」ので、**指を置いたまま**凪を測ると基準が濡れない
- **hover の残り香が差分を汚す**: `t.act` は判定前にマウスを隅へ「置きにいく」
  (park)。自前で比較するときも hover 位置を揃えてから撮る
- **`expect: 'none'` の閾値**: hover 効果やカーソル位置で微小差分が出る UI では
  `ratio` を少し緩める(反の盤は 0.004)
- **favicon の 404 は既定で無視**(`GLOBAL_ALLOW`)。作品固有の無害な console
  出力はスペックの `allow: [/…/]` で個別に許す
- **cwd に注意**: runner は「カレントディレクトリ = 配信ルート」。リポジトリの
  ルートから実行する

## 他リポジトリへの展開

1. `.claude/skills/visual-behavior/` を**ディレクトリごとコピー**(自己完結)
2. `specs/` を対象アプリ向けに書き直す(na の 4 本は消してよい)
3. ビルドが要るアプリは先にビルドし、配信ルート(cwd)に生成物がある状態で回す。
   既にアプリ独自の dev サーバがあるなら `run.js` の `serveStatic(ROOT)` を
   その origin に差し替えるだけ

前提は 2 つ: **Node ≥ 22**(内蔵 WebSocket)と **Chromium/Chrome がどこかに
あること**(`VISUAL_CHROME` で明示可)。

## 非ゴール

- pixel-perfect visual regression(golden 画像の維持はノイズが多い。ここでは
  「変わるべき時に変わる / 変わらないべき時に変わらない」という方向の検証に徹する)
- 全網羅(網羅は unit/headless テストの仕事。ここは 1 機能につき少数・厚めの
  シナリオで「人間の触り心地」を守る)
