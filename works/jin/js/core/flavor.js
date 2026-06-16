/* ============================================================
   陣 — 人となり（フレーバー）と必殺技。
   仲間それぞれに異名・決め台詞・固有の閃き（signatureSkill）を。
   固有技は game.js の ROSTER に skills として配られ、戦で確率発動する。
   発動の瞬間、決め台詞のカットインが入る（ui/main.js）。
   純粋なデータのみ・副作用なし。
   ============================================================ */

export const HEROES = {
  'リン':     { epithet: '辺境の若き主',   signature: '天翔ける刃',   skill: 'aether',    quote: 'これが、託された力だ！', color: '#7fd0ff' },
  'ガレス':   { epithet: '鉄壁の重騎',     signature: '不動の盾',     skill: 'pavise',    quote: 'ここは——通さん！',     color: '#9ab0d8' },
  'セラ':     { epithet: '癒しの祈り手',   signature: '奇跡の祈り',   skill: 'miracle',   quote: 'まだ、あきらめない！', color: '#ffe6a0' },
  'ロウェン': { epithet: '森の射手',       signature: '貫きの一矢',   skill: 'pierce',    quote: '——逃がさない。',       color: '#cfe08a' },
  'ミラ':     { epithet: '紅蓮の魔道士',   signature: '紅蓮の咆哮',   skill: 'ignis',     quote: '焼き尽くす！',         color: '#ff8a4a' },
  'カイ':     { epithet: '流れの剣士',     signature: '流星十文字',   skill: 'astra',     quote: 'もらったッ！',         color: '#e0e6ff' },
  'フィオ':   { epithet: '蒼天の天馬騎',   signature: '蒼天の舞',     skill: 'adept',     quote: '空は、わたしのもの！', color: '#a8e0ff' },
  'ドラン':   { epithet: '駆け抜ける槍',   signature: '貫突の突撃',   skill: 'colossus',  quote: '突き抜ける！',         color: '#ffd0a0' },
  'オレン':   { epithet: '闇の理に通ず',   signature: '闇蝕の理',     skill: 'luna',      quote: '頁を、めくろう。',     color: '#c79bff' },
  'リーザ':   { epithet: '塔の光の徒',     signature: '聖光の癒し',   skill: 'sol',       quote: '光あれ——。',          color: '#ffe08a' },
  'グンナル': { epithet: '谷の生き残り',   signature: '猛りの斧',     skill: 'wrath',     quote: 'うおおおッ！！',       color: '#ff9a5a' },
  'ノエル':   { epithet: '影と鍵の名手',   signature: '影の一刺し',   skill: 'lethality', quote: 'さよなら。',           color: '#bfa0ff' },
  'セレネ':   { epithet: '星に焼かれし魔', signature: '逆しまの星',   skill: 'ignis',     quote: '星よ、墜ちろ。',       color: '#ffcf6a' },
  'ガイル':   { epithet: '運命を断つ騎士', signature: '運命断ち',     skill: 'colossus',  quote: '俺の運命は、俺が書く！', color: '#cfe0ff' },
  'ミーア':   { epithet: '星詠みの巫女',   signature: '星宿りの癒し', skill: 'sol',       quote: '星より、人の側に。',   color: '#ffe6c0' },
};

export function heroFlavor(name) { return HEROES[name] || null; }

/* 名前→固有スキル id（ROSTER へ配るため）。 */
export function signatureSkillOf(name) { const h = HEROES[name]; return h ? h.skill : null; }
