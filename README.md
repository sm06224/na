<div align="center">

# `na`

### 無から、生まれる庭 — *a generative ambient garden, born from nothing*

触れると流れ、待てば咲く。<br>
依存パッケージはゼロ。ひとつの HTML ファイルだけで動く、瞑想的なインタラクティブ作品です。

[![gitleaks](https://github.com/sm06224/na/actions/workflows/gitleaks.yml/badge.svg)](https://github.com/sm06224/na/actions/workflows/gitleaks.yml)
[![license: MIT](https://img.shields.io/badge/license-MIT-9af5e0.svg)](./LICENSE)

</div>

---

## これは何

`na` は、空っぽのキャンバスに **流れ場（flow field）** を描き、その流れに沿って
無数の光の粒を走らせる生成的アートです。マウスやタッチに反応して流れが渦を巻き、
クリック（または長押し）で **花が咲き**、放っておいても庭はひとりでに花をつけます。
季節がめぐると、色と環境音がゆっくり移ろっていきます。

> もともと「gitleaks スキャンだけしてくれれば、あとは自由に」という依頼から生まれました。
> 空のリポジトリ（`README.md` に「na」とだけ）を出発点に、*無から庭をつくる* という
> テーマで一本の作品に仕立てています。

## 遊び方

| 操作 | はたらき |
| --- | --- |
| 画面に**触れる / マウスを動かす** | 流れが乱れ、粒が渦を巻く |
| **クリック / タップ** | その場所に花が咲く |
| **長押し / ドラッグ** | 花が連続して咲く |
| `♪` ボタン（または `S` キー） | 環境音（ペンタトニックのドローン＋チャイム）の on/off |
| `❀` ボタン（または `Space` キー） | 季節をめぐらせる（spring → summer → autumn → winter） |
| `~` ボタン（または `C` キー） | 霧で画面を流してリセット |
| `⤓` ボタン | いまの一枚を PNG として保存 |

## 動かす

クローンして `index.html` をブラウザで開くだけです。ビルドもサーバも不要。

```bash
git clone https://github.com/sm06224/na.git
cd na
open index.html        # macOS（Linux なら xdg-open、Windows なら start）
```

GitHub Pages にも対応しています。リポジトリの **Settings → Pages → Source** を
`GitHub Actions` にすると、`main` への push ごとに自動公開されます
（`.github/workflows/pages.yml`）。

## 技術メモ

- **ゼロ依存・1ファイル** — `index.html` に HTML / CSS / JS をすべて内包
- **流れ場** — 自前実装の 2D 勾配ノイズ（決定的シード）から角度を生成
- **描画** — Canvas 2D。`globalCompositeOperation = 'lighter'` で光を加算合成し、
  毎フレーム薄い闇で覆うことで残像（トレイル）を表現
- **音** — Web Audio API。3 音のドローン＋花が咲くたびのトライアングル・チャイム。
  メジャーペンタトニックなので不協和にならない
- **配慮** — `prefers-reduced-motion` を尊重、HiDPI 対応、タッチ対応

## このリポジトリの番人

作品だけでなく、**これから先も秘密が混入しないための仕組み** を一緒に入れてあります。

- `.github/workflows/gitleaks.yml` — push / PR / 毎週の定期巡回で
  [gitleaks](https://github.com/gitleaks/gitleaks) が git 履歴と作業ツリーを走査
- `.gitleaks.toml` — デフォルトルールを継承しつつ、この作品ファイル向けの除外を定義

初回スキャン結果は **クリーン（漏洩ゼロ）** でした。

---

<div align="center">
<sub>無一物中無尽蔵 — 何も無いところに、尽きせぬものが宿る。</sub>
</div>
