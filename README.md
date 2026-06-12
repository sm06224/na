<div align="center">

# `na`

### 無から生まれた、小さな作品集 — *small works, born from nothing*

[![gitleaks](https://github.com/sm06224/na/actions/workflows/gitleaks.yml/badge.svg)](https://github.com/sm06224/na/actions/workflows/gitleaks.yml)
[![test](https://github.com/sm06224/na/actions/workflows/test.yml/badge.svg)](https://github.com/sm06224/na/actions/workflows/test.yml)
[![license: MIT](https://img.shields.io/badge/license-MIT-9af5e0.svg)](./LICENSE)

**無 → 庭 → 生 → 史 → 番 → 言**

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

### 📜 [史 `shi`](./works/shi/) — *a history that writes itself*
ひとりでに書かれてゆく歴史書。種から大陸・川・気候が生まれ、集落が興り、**王が立ち、
国が領土を塗り広げる**。街道は **A\* 経路探索**で結ばれ、国境の摩擦は戦争に、交易は富と
**疫病の伝播**になる。文明は石器から中世へ時代を進み、すべての出来事は固有名つきで
**史書**に刻まれる（「全史の間」で通史が読める）。コアは DOM 非依存・15 tests。
1200 年のヘッドレス検証では 239 の戦争、85 の反乱、87 の国の滅亡が記録された。

### 🗓 [番 `ban`](./works/ban/) — *シフト表は、ブラウザだけで*
作品集で唯一の**実用ツール**。シフト作成者の過半数が「時間がかかりすぎ」と答える
毎月の苦行を、**焼きなまし法ソルバ**が数秒で終わらせる。勤務間インターバル 11h・
連勤上限・夜勤回数という**公的ガイドライン準拠のルール**を自動チェックし、
土日・夜勤の偏りを均す。無料・登録不要・**データは端末から一歩も出ない**。
Excel 対応 CSV／iCal／印刷／PWA（オフライン動作）。コアは DOM 非依存・**49 tests**。

### 🗣 [言 `koto`](./works/koto/) — *a language that invents itself*
**無から言葉が生まれる**世界。群れが音をさぐり、通じた音だけが約束になる。単語は発生し、
訛り、**方言に分かれ**、意味がずれ、死語になる。よく通じ合う群は栄え、通じない群は縮む——
**言語が生存と結びついている**。群をクリックすると**勝手に書かれた辞書**が読め、語の誕生・
意味の変化・借用が言語史に刻まれる。誰も設計しない言語を眺める。コアは DOM 非依存・**20 tests**。

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
│  ├─ genesis/              🌍 生（人工生命）
│  │  ├─ index.html · style.css
│  │  ├─ js/                rng · genome · brain · world · render · …
│  │  └─ tests/
│  ├─ shi/                  📜 史（文明と歴史）
│  │  ├─ index.html · style.css
│  │  ├─ js/core/           terrain · pathfind · war · trade · chronicle · world · …
│  │  ├─ js/ui/             render · inspector · feed · …
│  │  └─ tests/
│  ├─ ban/                  🗓 番（シフト表ツール・PWA）
│  │  ├─ index.html · help.html · sw.js
│  │  ├─ js/core/           model · rules · solver · csv · ical · store · …
│  │  ├─ js/ui/             grid · panels · violations · …
│  │  └─ tests/
│  └─ koto/                 🗣 言（創発する言語）
│     ├─ index.html · style.css
│     ├─ js/core/           phonology · meaning · lexicon · chronicle · world
│     ├─ js/ui/             render · panels · main
│     └─ tests/
├─ .github/workflows/
│  ├─ gitleaks.yml          秘密混入の監視（push / PR / 毎週）
│  ├─ test.yml              生と史のコアをヘッドレス検証
│  └─ pages.yml             GitHub Pages へ自動公開
├─ .gitleaks.toml
└─ LICENSE (MIT)
```

## 番人と公開

- **gitleaks** が push / PR / 毎週の巡回で git 履歴と作業ツリーを走査（初回スキャンは漏洩ゼロ）
- **test** が `生`・`史`・`番`・`言` のコアをブラウザなしで検証（計 100 tests）
- **pages** で `main` への push ごとに自動公開。**Settings → Pages → Source** を
  `GitHub Actions` にすると `https://sm06224.github.io/na/` で全作品が開けます

---

<div align="center">
<sub>無一物中無尽蔵 — 何も無いところに、尽きせぬものが宿る。</sub>
</div>
