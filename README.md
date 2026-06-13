<div align="center">

# `na`

### 無から生まれた、小さな作品集 — *small works, born from nothing*

[![gitleaks](https://github.com/sm06224/na/actions/workflows/gitleaks.yml/badge.svg)](https://github.com/sm06224/na/actions/workflows/gitleaks.yml)
[![test](https://github.com/sm06224/na/actions/workflows/test.yml/badge.svg)](https://github.com/sm06224/na/actions/workflows/test.yml)
[![license: MIT](https://img.shields.io/badge/license-MIT-9af5e0.svg)](./LICENSE)

**無 → 庭 → 生 → 史 → 番 → 言 → 歌 → 備 → 奏 → 苔 → 織 → 算 → 針 → 狐 → 星**

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

### 🎵 [歌 `uta`](./works/uta/) — *music that composes itself*
**無から音楽が生まれる**世界。胸に残った節だけが、もう一度歌われる。歌は変奏され、
**覚えやすい歌ほど生き残る**——この淘汰圧だけで、誰も教えていないのに**フック（サビ）が
創発する**。分派の創始者効果が節回しの方言を生み、覚えやすい歌ほど群れを越えて**流行**する。
そして Web Audio で**この世界の歌が実際に聴こえる**（五音音階なので、どの歌が重なっても
協和する）。出力が「言葉」だった系譜が、ここで「音」になる。コアは DOM 非依存・**24 tests**。

### 🎒 [備 `sonae`](./works/sonae/) — *我が家の備蓄は、三分でわかる*
二番目の**実用ツール**。家族構成（乳幼児・高齢者・ペット・生理用品まで）と日数を入れると、
**公的な目安に基づく約30品目の備蓄リスト**が数量つきで出る。チェックすると備え率が見え、
**冷蔵庫に貼れる A4 チェックリスト**として印刷できる。無料・登録不要・オフラインで動き、
**データは端末から一歩も出ない**。根拠は農水省・東京備蓄ナビ・環境省。コアは DOM 非依存・**17 tests**。

### 🎐 [奏 `kanade`](./works/kanade/) — *みんなで触れる、光の楽器*
ひとつの画面に**何本でも指を**。スマホを輪の真ん中に置けば、その場の全員で合奏できる。
使える音を**半音のない五音音階**に量子化してあるので、**誰がでたらめに触っても濁らない**
（この約束はテストが守る）。弾いた音と光は**8 秒後に薄くなって還ってくる**（こだま）ので、
ひとりでも重ね録りの合奏になる。残響はノイズから手作り。音源ファイルなし・サーバーなし。
`庭` と `歌` の血を引く、あなたたちが鳴らす楽器。コアは DOM 非依存・**12 tests**。

### 🪨 [苔 `koke`](./works/koke/) — *moss grows over this repository*
作品集で唯一、**開いても動かない**作品。時間がたつと変わる作品。毎週月曜の朝、
CI の庭師がひとりでに目を覚まし、石庭の SVG に苔をすこし描き足して、**自分でコミットして帰る**。
庭は状態を持たず**週番号の純粋関数**なので、庭師が何週眠っても苔は経った時間ぶん育つ。
そして第8週・第26週・第52週……**歳月だけが連れてくる客**が、コードの中で待っている。**7 tests**。

### 🧵 [織 `ori`](./works/ori/) — *cloth woven from song*
**歌を布に織る織り機**。旋律の高さが組織（経糸の浮き沈みの規則＝セルオートマトン）を選び、
長さが緯糸の段数になり、高さは草木染めの色になる——だから**歌のフックが、目に見える柄になる**。
カナ譜の文法は `歌` と同じなので、**あちらの世界で生まれた節をそのまま織って持ち帰れる**。
布の丈が満ちるまで歌はリピートされるが、組織の状態は繰り返しを越えて流れるので、
同じ色の帯が巡っても織り味は二度と同じにならない。出力の系譜は「言葉 → 音 → **紋様**」へ。
織り上がりには**銘**（決定的な指紋）がつき、SVG で持ち帰れる。コアは DOM 非依存・**12 tests**。

### 🖥 [算 `san`](./works/san/) — *a computer born from nothing*
作品集でいちばん大きな作品。**無から作った計算機**——ブラウザに住む架空の 16bit コンソール。
自作の CPU（独自命令セット）・アセンブラ・**日本語キーワードの高級言語「珠」とそのコンパイラ**・
128×96・16色の画面・4チャンネル音源・**ステップ実行とブレークポイントを持つデバッガ**まで、
すべて依存ゼロで一そろい。仕様書（[HARDWARE.md](./works/san/HARDWARE.md)・
[LANGUAGE.md](./works/san/LANGUAGE.md)）が機械の唯一の真実。同梱 ROM では**蛍が機械の中で
もう一度光り**、へびが遊べ、電卓がシリアル越しに答え、珠で書かれた「恋歌」が
あの節を機械の声で歌う。コアは DOM 非依存・**105 tests**。

### 🧭 [針 `hari`](./works/hari/) — *a needle that remembers the way back*
三番目の**実用ツール**、そして**スマホでこそ**の一品。駐車場・フェスのテント・宿に
ワンタップで針を刺せば、あとは**矢印と距離だけ**が連れ戻す。地図を出さない設計だから
**完全オフライン**——電波のない立体駐車場や山でいちばん効く。GPS は精度加重平均で刺し、
磁気センサーの磁北は**国土地理院の偏角近似式で真北に補正**、🔔を入れると**正しい方向ほど
速く脈打つ振動**で画面を見ずに歩ける。座標を URL に畳んだリンクを送れば、相手はブラウザで
開くだけの**サーバーなし待ち合わせ**。登録なし・**場所は端末から出ない**・PWA。
コアは DOM 非依存・**29 tests**。

### 🦊 [狐 `kitsune`](./works/kitsune/) — *a GPS treasure hunt*
`針` から生まれた、**スマホひとつで遊ぶ宝探し**。**狐（出題者）**が街を歩いて的を仕掛け、
名前・ヒント・通過方法を添えて**コースまるごとを一本のリンクに畳む**。**追手**はそれを開くだけ、
針と同じ**矢印**で次の的へ駆ける——地図は出ないから、知っている街も迷宮になる。
通過のしるしは三つ：📍**GPS**（輪に入れば自動）・🔳**QR**（現地に貼った QR を標準カメラで。
**コードは依存ゼロで自作**）・📷**写真**（その場の一枚が証明であり思い出）。QR が運ぶのは
答えの**ハッシュだけ**だからリンクを解読してもズルできず、順番も飛ばせない。
**サーバーは一台もない**——コースも進行も写真も端末から出ない。コアは DOM 非依存・**24 tests**。

### ★ [星 `hoshi`](./works/hoshi/) — *a sky that names itself*
**誰も設計しない夜空**。種ひとつから 600 の星が撒かれ、明るい星は近ければ
**おのずと結ばれて星座になり**（最小全域木で枝を張る）、**自分で名のり**、かたちと
主星の色から**由来＝神話が書かれる**。`言`・`歌`・`史` と続いた「ひとりでに名づけ、
物語る」系譜の、夜の章。すべては種の純粋関数だから、**同じ種からは一星も一文字も
ちがわない同じ空**——リンク（`#s=種`）で誰かと同じ夜を見上げられる。空でいちばん
明るい**一番星**が最初に灯り、その由来は次に来る人への言づてになっている。
コアは DOM 非依存・**9 tests**。

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
│  ├─ koto/                 🗣 言（創発する言語）
│  │  ├─ index.html · style.css
│  │  ├─ js/core/           phonology · meaning · lexicon · chronicle · world
│  │  ├─ js/ui/             render · panels · main
│  │  └─ tests/
│  ├─ uta/                  🎵 歌（創発する音楽）
│  │  ├─ index.html · style.css
│  │  ├─ js/core/           scale · occasions · repertoire · chronicle · world
│  │  ├─ js/ui/             render · audio · panels · main
│  │  └─ tests/
│  ├─ sonae/                🎒 備（防災備蓄チェッカー）
│  │  ├─ index.html · style.css
│  │  ├─ js/core/           items · calc
│  │  ├─ js/ui/main.js
│  │  └─ tests/
│  ├─ kanade/               🎐 奏（みんなで触れる楽器）
│  │  ├─ index.html · style.css
│  │  ├─ js/core/music.js   音階・量子化・こだま
│  │  ├─ js/ui/             audio · main
│  │  └─ tests/
│  ├─ koke/                 🪨 苔（時間の純粋関数としての庭）
│  │  ├─ garden.svg         毎週、CI がここに苔を描き足す
│  │  ├─ grow.js · js/core/garden.js
│  │  └─ tests/
│  ├─ ori/                  🧵 織（歌を布に織る織り機）
│  │  ├─ index.html · style.css
│  │  ├─ tegami.svg         額装された手紙（恋歌を織った布）
│  │  ├─ tegami.js · js/core/  rng · kana · loom
│  │  └─ tests/
│  ├─ san/                  🖥 算（無から生まれた計算機）
│  │  ├─ HARDWARE.md        機械仕様書（ISA・メモリマップ・デバイス）
│  │  ├─ LANGUAGE.md        言語「珠」仕様書
│  │  ├─ index.html · style.css
│  │  ├─ js/core/           vm · asm · bus · devices · machine
│  │  ├─ js/lang/           珠コンパイラ
│  │  ├─ js/ui/             画面 · 音 · エディタ · デバッガ
│  │  ├─ js/roms.js · roms/ 同梱 ROM（蛍・へび・万華鏡・電卓 …）
│  │  └─ tests/
│  ├─ hari/                 🧭 針（帰り道を覚えている羅針盤・PWA）
│  │  ├─ index.html · style.css · manifest · sw.js
│  │  ├─ js/core/           geo（球面三角・磁気偏角・平滑化） · spots（覚え書き・リンク符号）
│  │  ├─ js/ui/             sensors · needle · main
│  │  └─ tests/
│  ├─ kitsune/              🦊 狐（GPS 宝探し・PWA）
│  │  ├─ index.html · style.css · manifest · sw.js
│  │  ├─ js/core/           geo · course（コース符号・通過判定） · qr（QR 自作）
│  │  ├─ js/ui/             sensors · needle · camera · main
│  │  └─ tests/
│  └─ hoshi/                ★ 星（ひとりでに名づける夜空）
│     ├─ index.html · style.css
│     ├─ js/core/           rng · sky（星・星座・命名・神話・銘）
│     ├─ js/ui/             render · main
│     └─ tests/
├─ .github/workflows/
│  ├─ gitleaks.yml          秘密混入の監視（push / PR / 毎週）
│  ├─ test.yml              各作品のコアをヘッドレス検証
│  ├─ koke.yml              苔の庭師（毎週月曜の朝、勝手にコミットする）
│  └─ pages.yml             GitHub Pages へ自動公開
├─ .gitleaks.toml
└─ LICENSE (MIT)
```

## 番人と公開

- **gitleaks** が push / PR / 毎週の巡回で git 履歴と作業ツリーを走査（初回スキャンは漏洩ゼロ）
- **test** が `生`・`史`・`番`・`言`・`歌`・`備`・`奏`・`苔` のコアをブラウザなしで検証（計 160 tests）、`蛍` は光るかどうかだけ
- **koke** が毎週月曜の朝、庭に苔を描き足してコミットする（このリポジトリは放っておいても育つ）
- **pages** で `main` への push ごとに自動公開。**Settings → Pages → Source** を
  `GitHub Actions` にすると `https://sm06224.github.io/na/` で全作品が開けます

---

<div align="center">

<img src="works/koke/garden.svg" width="92%" alt="苔庭 — 毎週月曜の朝、CI がここに苔を描き足していく">

<sub>↑ この庭は毎週月曜の朝、ひとりでに育ちます（<a href="works/koke/">苔</a>）</sub>

<br><br>

<sub>無一物中無尽蔵 — 何も無いところに、尽きせぬものが宿る。</sub><br>
<sub>……六月の夜なら、ターミナルで <code>./蛍</code> を。</sub>
</div>
