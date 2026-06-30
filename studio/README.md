<div align="center">

# `studio`

### 簡単に書けて、グリグリ動かせる — 作図のための DSL ＋ レイアウトツール

ガントチャートと機能構成図に特化。**1 図 ＝ 自己完結の単一 HTML**。依存ゼロ・オフライン・どこでも開ける。

</div>

---

## これは何

`studio` は、**今後さまざまな AI と図を育てていくための土台**です。`works/`（無から生まれた作品集）とは別に切った、実用ツールのディレクトリ。

ねらいは三つ。

1. **簡単に書ける DSL** — 人も AI も、数行で図を書ける line-based の文法。
2. **グリグリ動かせる** — ブラウザでノードや棒をドラッグして整える。
3. **AI に優しい往復** — ドラッグの結果は **`@layout` トレイラだけ**に書き戻る。意味部（何があり、何に依存するか）は汚れないので、**次の AI が差分をきれいに読める**。

そして成果物は **1 図 1 枚の自己完結 HTML**。エンジンを同梱するので、その 1 枚を配ればどこでも開けて編集できる。「一つの巨大な HTML だと重くて管理が大変」を避ける設計です。

## DSL

意味部（人/AI が書く）と `@layout` トレイラ（エディタが書く）を分けるのが肝。

### ガントチャート

```studio
kind gantt
title 製品リリース計画
start 2026-07-01
today 2026-07-16

section 設計
  task req    "要件定義"   at 2026-07-01 for 5d done 100
  task design "基本設計"   after req for 7d done 60
section 実装
  task api    "API 実装"   after design for 10d
  milestone ship "出荷"    after api
```

- `at <日付>` 絶対開始、`after <id…>` 依存（先行の終了から）、`for <5d|2w>` 期間、`done <%>` 進捗
- `section "名前"` で帯に分ける。依存は薄い矢印で結ばれ、週末は薄帯、`today` 線が入る
- **横ドラッグ**で開始日を、**縦ドラッグ**で行の並びを変える → `@layout` の `at` / `order` に記録

### 機能構成図 / アーキ図

```studio
kind arch
title サービス構成

node web "Web フロント"
node gw  "API ゲートウェイ"
node db  "データベース"

edge web -> gw -> db
group "裏方" { gw db }
```

- `node <id> "ラベル"`、`edge a -> b`（`a -> b -> c` の連鎖可）、`group "名前" { id… }`
- 位置を書かなければ**依存の深さで自動段組み**（最長経路）。**ドラッグ**で自由配置 → `@layout` の `pos id x y` に記録

## 使い方

```bash
cd studio
node build.js examples/release.studio          # → dist/release.html（単一 HTML）
node build.js --all                            # examples/*.studio をすべてビルド
```

出来た HTML を開くと、左に図・右に DSL。**どちらを変えてももう一方が追いかける**。ドラッグして整えたら「DSL をコピー」か「.studio を保存」で書き出し、次の AI に渡せます。

同梱の例（ビルド済み）：
- [`dist/release.html`](./dist/release.html) — 製品リリース計画（ガント）
- [`dist/architecture.html`](./dist/architecture.html) — サービス機能構成図（アーキ）

## アーキテクチャ

```
studio/
├─ engine/                       純粋コア（DOM 非依存・テスト対象）
│  ├─ date.js                    日付の道具（UTC 固定・依存ゼロ）
│  ├─ parse.js                   DSL → モデル（意味部＋@layout を分離）
│  ├─ layout.js                  ガントの日程解決／アーキの自動段組み
│  └─ serialize.js               モデル → DSL（往復の戻り。意味部を汚さない）
├─ render/draw.js                モデル＋配置 → SVG 文字列（純粋）
├─ ui/interact.js                ドラッグと往復（DOM）
├─ build.js                      エンジンを畳んで 1 図 1 枚の HTML に
├─ examples/*.studio             図のソース
├─ dist/*.html                   ビルド済みの自己完結 HTML
└─ tests/                        parse・layout・roundtrip（node --test）
```

```bash
node --test tests/*.test.js      # 15 tests（パース・日程解決・自動段組み・往復・ビルド）
```

設計上の約束：**コア（engine/・render/draw.js）は DOM もネットワークも知らない**。同じ DSL からは寸分たがわず同じ図（決定的）。だから AI が書いても、結果は再現する。

---

<div align="center">

書けば図に、動かせば書き戻る。<br>
次の手が、きれいな差分から続けられるように。

</div>
