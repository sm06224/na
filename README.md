<div align="center">

# `na`

### 無から生まれた、小さな作品集 — *small works, born from nothing*

[![gitleaks](https://github.com/sm06224/na/actions/workflows/gitleaks.yml/badge.svg)](https://github.com/sm06224/na/actions/workflows/gitleaks.yml)
[![test](https://github.com/sm06224/na/actions/workflows/test.yml/badge.svg)](https://github.com/sm06224/na/actions/workflows/test.yml)
[![license: MIT](https://img.shields.io/badge/license-MIT-9af5e0.svg)](./LICENSE)

**無 → 庭 → 生**

</div>

---

`README.md` に「na」とだけ書かれた空のリポジトリから始まりました。
そこを出発点に、*無から何かを生み出す* というテーマで作品を増やしています。
すべて **依存パッケージはゼロ**。クローンしてブラウザで開けば動きます。

## 作品

### 🌸 [庭 `garden`](./works/garden/) — *a generative ambient garden*
触れると流れ、待てば咲く。自前のノイズで作る流れ場を光の粒が走る、瞑想的なジェネラティブアート。
Web Audio によるペンタトニックの環境音つき。**1 ファイル**で完結。

### 🌍 [生 `sei`](./works/genesis/) — *a world that evolves without you*
あなたの意思が介在しない人工生命の世界。**神経回路の脳**を持つ生き物たちが食べ、増え、
写し間違い（変異し）、**種に分かれ、滅びていく**。学習はせず、進化だけが賢さを選び取る。
個体をクリックすると遺伝子と**脳の発火がライブで**見え、世界は JSON に保存・復元できる。
シミュレーションコアは DOM 非依存で、**Node でヘッドレス・テスト**される（16 tests）。

```bash
git clone https://github.com/sm06224/na.git
cd na
open index.html                       # 作品集トップ（macOS / Linux: xdg-open / Win: start）
# 直接ひらくなら:
open works/garden/index.html
open works/genesis/index.html
```

## このリポジトリの作り

```
na/
├─ index.html               作品集のランディング
├─ works/
│  ├─ garden/index.html     🌸 庭（1 ファイル）
│  └─ genesis/              🌍 生（人工生命）
│     ├─ index.html · style.css
│     ├─ js/                rng · genome · brain · world · render · …
│     └─ tests/             Node 標準ランナーでのユニットテスト
├─ .github/workflows/
│  ├─ gitleaks.yml          秘密混入の監視（push / PR / 毎週）
│  ├─ test.yml              genesis のコアをヘッドレス検証
│  └─ pages.yml             GitHub Pages へ自動公開
├─ .gitleaks.toml
└─ LICENSE (MIT)
```

## 番人と公開

- **gitleaks** が push / PR / 毎週の巡回で git 履歴と作業ツリーを走査（初回スキャンは漏洩ゼロ）
- **test** が `生` の人工生命コアをブラウザなしで検証
- **pages** で `main` への push ごとに自動公開。**Settings → Pages → Source** を
  `GitHub Actions` にすると `https://sm06224.github.io/na/` で全作品が開けます

---

<div align="center">
<sub>無一物中無尽蔵 — 何も無いところに、尽きせぬものが宿る。</sub>
</div>
