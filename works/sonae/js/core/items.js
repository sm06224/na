/* ============================================================
   品目 — 家庭備蓄の品目台帳。
   数量は公的な目安に基づく：
   ・水 3L/人/日（飲料2L+調理1L）、最低3日・推奨1週間
     （農林水産省「災害時に備えた食品ストックガイド」、内閣府）
   ・主食3食/人/日・簡易トイレ5回/人/日（東京都「東京備蓄ナビ」の考え方）
   ・カセットボンベ 約6本/人/週（同上。実測では大きく下回ることも）
   ・ペットのフード・水は少なくとも5日分、できれば7日分以上
     （環境省「人とペットの災害対策ガイドライン」）
   あくまで目安。家庭の事情に合わせて増減してください。
   ============================================================ */

/* per: 1 日 1 人あたりの係数（daily: true なら日数を掛ける）
   adult=大人 child=子ども(小学生〜) infant=乳幼児 elderly=高齢者
   female=生理用品を使う人 pet=ペット
   fixed: 世帯あたりの固定数 */
export const CATS = [
  { id: 'water', label: '水・食料' },
  { id: 'toilet', label: 'トイレ・衛生' },
  { id: 'life', label: '暮らし・あかり・情報' },
  { id: 'infant', label: '乳幼児のために', need: 'infants' },
  { id: 'female', label: '生理用品', need: 'females' },
  { id: 'elderly', label: '高齢の家族のために', need: 'elderly' },
  { id: 'pet', label: 'ペットのために', need: 'pets' },
];

export const ITEMS = [
  /* ---------- 水・食料 ---------- */
  { id: 'water', cat: 'water', name: '飲料水', unit: 'L',
    per: { adult: 3, child: 3, elderly: 3, infant: 1, daily: true },
    note: '1人1日3L（飲料2L＋調理1L）。2Lペットボトルなら本数で約半分' },
  { id: 'staple', cat: 'water', name: '主食（レトルトご飯・アルファ米・麺など）', unit: '食',
    per: { adult: 3, child: 3, elderly: 3, daily: true },
    note: '1人1日3食。無洗米＋カセットコンロの組み合わせも' },
  { id: 'main', cat: 'water', name: '主菜（缶詰・レトルト食品）', unit: '個',
    per: { adult: 1.3, child: 1.3, elderly: 1.3, daily: true },
    note: 'さば缶・カレー・パスタソースなど、普段食べ慣れたもの' },
  { id: 'veg', cat: 'water', name: '野菜ジュース・果物缶など', unit: '本',
    per: { adult: 1, child: 1, elderly: 1, daily: true },
    note: '災害時はビタミンと食物繊維が不足しがち' },
  { id: 'snack', cat: 'water', name: 'お菓子・栄養補助食品', unit: '袋',
    per: { adult: 0.3, child: 0.5, elderly: 0.3, daily: true },
    note: 'チョコ・ビスケットなど。心の支えにもなる' },
  { id: 'seasoning', cat: 'water', name: '塩・しょうゆ等の調味料', unit: '式', fixed: 1,
    note: '使いかけの常備分で足りることが多い。確認だけ' },
  { id: 'stove', cat: 'water', name: 'カセットコンロ', unit: '台', fixed: 1,
    note: '温かい食事は何よりの回復薬。電気・ガスが止まっても使える' },
  { id: 'gas', cat: 'water', name: 'カセットボンベ', unit: '本',
    per: { adult: 0.9, child: 0.9, elderly: 0.9, daily: true },
    note: '公的目安は1人1週間約6本。調理を簡素にすれば実際はもっと少なめ' },

  /* ---------- トイレ・衛生 ---------- */
  { id: 'toilet', cat: 'toilet', name: '簡易トイレ（携帯トイレ）', unit: '回分',
    per: { adult: 5, child: 5, elderly: 5, daily: true },
    note: '1人1日5回が目安。断水時、これが一番困る' },
  { id: 'tp', cat: 'toilet', name: 'トイレットペーパー', unit: 'ロール',
    per: { adult: 0.15, child: 0.15, elderly: 0.15, daily: true },
    note: '1人1週間で約1ロール' },
  { id: 'wet', cat: 'toilet', name: 'ウェットティッシュ・からだふき', unit: '個',
    per: { adult: 0.15, child: 0.15, infant: 0.15, elderly: 0.15, daily: true },
    note: 'お風呂に入れない日々の味方。1人1週間1個' },
  { id: 'mask', cat: 'toilet', name: 'マスク', unit: '枚',
    per: { adult: 1, child: 1, elderly: 1, daily: true },
    note: '避難生活では感染症と粉じんから身を守る' },
  { id: 'sanitizer', cat: 'toilet', name: '手指消毒液・せっけん', unit: '本', fixed: 1,
    note: '断水時の手洗いの代わりに' },
  { id: 'firstaid', cat: 'toilet', name: '救急セット・常備薬・お薬手帳', unit: '式', fixed: 1,
    note: '持病の薬は1週間分。お薬手帳のコピーも' },

  /* ---------- 暮らし・あかり・情報 ---------- */
  { id: 'light', cat: 'life', name: 'LEDランタン・懐中電灯', unit: '個',
    per: { adult: 1, child: 1, elderly: 1 },
    note: 'できれば1人1灯＋共用1灯。停電の夜は長い' },
  { id: 'battery', cat: 'life', name: '乾電池（予備）', unit: '本',
    per: { adult: 4, child: 4, elderly: 4 },
    note: 'ランタン・ラジオの電池形式に合わせて' },
  { id: 'mobile', cat: 'life', name: 'モバイルバッテリー', unit: '個',
    per: { adult: 1, elderly: 1 },
    note: '情報と連絡は命綱。普段から満充電の習慣を' },
  { id: 'radio', cat: 'life', name: '携帯ラジオ', unit: '台', fixed: 1,
    note: '停電時・通信障害時の情報源' },
  { id: 'wrap', cat: 'life', name: '食品用ラップ', unit: '本', fixed: 1,
    note: '皿にかぶせれば洗い物いらず。包帯や防寒の代用にも' },
  { id: 'bag', cat: 'life', name: 'ポリ袋・ごみ袋', unit: '箱', fixed: 1,
    note: '調理・ごみ・水運び・防寒、何にでも化ける' },
  { id: 'dish', cat: 'life', name: '紙皿・紙コップ・割り箸', unit: '式', fixed: 1,
    note: '人数×日数分。断水中は洗えない' },
  { id: 'glove', cat: 'life', name: '軍手・ガムテープ', unit: '式', fixed: 1,
    note: '片付けとガラス片から手を守る' },
  { id: 'cash', cat: 'life', name: '現金（小銭・千円札）', unit: '式', fixed: 1,
    note: '停電時はカード・電子マネーが使えない。1万円程度を小さく崩して' },

  /* ---------- 乳幼児 ---------- */
  { id: 'milk', cat: 'infant', name: '粉ミルク・液体ミルク', unit: '日分',
    per: { infant: 1, daily: true },
    note: '液体ミルクはお湯いらず。哺乳びんが洗えないときは紙コップ授乳も' },
  { id: 'babyfood', cat: 'infant', name: '離乳食・ベビーフード', unit: '食',
    per: { infant: 3, daily: true },
    note: '食べ慣れた味を。アレルギー対応品は特に手に入りにくい' },
  { id: 'diaper', cat: 'infant', name: 'おむつ', unit: '枚',
    per: { infant: 8, daily: true },
    note: '発災後は1週間以上品薄になりやすい。サイズアウトに注意して回す' },
  { id: 'babywipe', cat: 'infant', name: 'おしりふき', unit: '個',
    per: { infant: 0.3, daily: true },
    note: '大人のからだふきにも使える万能選手' },

  /* ---------- 生理用品 ---------- */
  { id: 'sanitary', cat: 'female', name: '生理用品', unit: '個',
    per: { female: 30 },
    note: '約1周期分。災害時は手に入りにくく、もらいにくい' },

  /* ---------- 高齢者 ---------- */
  { id: 'adultdiaper', cat: 'elderly', name: '大人用おむつ・尿とりパッド（必要な方）', unit: '枚',
    per: { elderly: 5, daily: true },
    note: '使っている方のみ。使わない方はゼロでよい' },
  { id: 'softfood', cat: 'elderly', name: 'やわらかい食品・とろみ剤（必要な方）', unit: '食',
    per: { elderly: 1, daily: true },
    note: 'かむ力・のみこむ力に合わせて。お粥のレトルトなど' },
  { id: 'denture', cat: 'elderly', name: '入れ歯洗浄剤・口腔ケア用品', unit: '式', fixed: 1,
    note: '口の清潔は誤嚥性肺炎の予防になる' },

  /* ---------- ペット ---------- */
  { id: 'petfood', cat: 'pet', name: 'ペットフード', unit: '日分',
    per: { pet: 1, daily: true },
    note: '環境省の目安は最低5日分、できれば7日分以上。療法食は特に多めに' },
  { id: 'petwater', cat: 'pet', name: 'ペット用の水', unit: 'L',
    per: { pet: 0.5, daily: true },
    note: '体格による（中型犬で1日約0.5〜1L）。人の分とは別に' },
  { id: 'petsheet', cat: 'pet', name: 'ペットシーツ・排泄用品', unit: '枚',
    per: { pet: 3, daily: true },
    note: 'ケージ・リード・写真（迷子対策）も合わせて確認' },
];

export const itemById = Object.fromEntries(ITEMS.map(i => [i.id, i]));
