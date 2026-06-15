/* ============================================================
   窟 — 画面。鞄・装備・人物・ヘルプ・死。盤の上に重なる札。
   一覧は a,b,c… の字で選ぶ（クリックでも）。
   ============================================================ */

import { slotName, SLOTS, equipBonus } from '../core/inventory.js';
import { hungerWord, xpForLevel } from '../core/player.js';
import { statusName } from '../core/status.js';

const LETTERS = 'abcdefghijklmnopqrstuvwxyz';

export class Screens {
  constructor(root) {
    this.root = root;          // #overlay
    this.onPick = null;
    this.mode = null;
    root.addEventListener('click', e => {
      if (e.target === root) this.hide();
      const li = e.target.closest('[data-letter]');
      if (li && this.onPick) this.pick(li.dataset.letter);
    });
  }

  get open() { return !this.root.hidden; }
  hide() { this.root.hidden = true; this.root.innerHTML = ''; this.onPick = null; this.mode = null; this.items = null; }

  pick(letter) {
    const i = LETTERS.indexOf(letter);
    if (this.items && i >= 0 && i < this.items.length) { const cb = this.onPick; const it = this.items[i]; this.hide(); cb && cb(it); }
  }

  panel(title, bodyHtml, hint) {
    this.root.hidden = false;
    this.root.innerHTML = `<div class="panel"><div class="ptitle">${title}</div><div class="pbody">${bodyHtml}</div>${hint ? `<div class="phint">${hint}</div>` : ''}</div>`;
  }

  /* 一覧から選ぶ（カテゴリで絞る）。onPick(item) を呼ぶ。 */
  chooseItem(game, title, filter, onPick) {
    const inv = game.player.inv.filter(filter || (() => true));
    if (!inv.length) { this.message(title, 'それに使えるものは持っていない。'); return false; }
    this.items = inv; this.onPick = onPick; this.mode = 'pick';
    const rows = inv.map((it, i) => `<div class="row" data-letter="${LETTERS[i]}"><span class="key">${LETTERS[i]}</span><span class="glyph" style="color:${it.d.color || '#ccc'}">${it.d.glyph}</span><span class="nm">${esc(it.displayName(game.ids))}</span></div>`).join('');
    this.panel(title, rows, '字で選ぶ・Escで閉じる');
    return true;
  }

  message(title, text) { this.panel(title, `<div class="ptext">${esc(text)}</div>`, 'Escで閉じる'); this.mode = 'msg'; }

  inventory(game) {
    const inv = game.player.inv;
    if (!inv.length) { this.message('持ち物', '鞄は空っぽだ。'); return; }
    const groups = {};
    for (const it of inv) (groups[it.category] = groups[it.category] || []).push(it);
    let html = '';
    for (const cat of ['weapon', 'armor', 'ring', 'amulet', 'potion', 'scroll', 'wand', 'food', 'gold']) {
      if (!groups[cat]) continue;
      html += `<div class="cat">${catName(cat)}</div>`;
      for (const it of groups[cat]) html += `<div class="row"><span class="glyph" style="color:${it.d.color || '#ccc'}">${it.d.glyph}</span><span class="nm">${esc(it.displayName(game.ids))}${equippedMark(game, it)}</span></div>`;
    }
    this.panel('持ち物', html, 'Escで閉じる');
    this.mode = 'msg';
  }

  equipment(game) {
    const p = game.player;
    let html = '';
    for (const slot of SLOTS) {
      const it = p.equip[slot];
      html += `<div class="row"><span class="key">${slotName(slot)}</span><span class="nm">${it ? `<span class="glyph" style="color:${it.d.color}">${it.d.glyph}</span> ${esc(it.displayName(game.ids))}` : '—'}</span></div>`;
    }
    const b = equipBonus(p);
    html += `<div class="cat">装備の補正</div><div class="ptext">命中 +${b.acc}　防御 +${b.def}　回避 +${b.eva}　力 +${b.str}</div>`;
    this.panel('装備', html, 'Escで閉じる');
    this.mode = 'msg';
  }

  character(game) {
    const p = game.player;
    const st = p.statuses.map(s => `${statusName(s.type)}(${s.turns})`).join('・') || 'なし';
    const html = `
      <div class="ptext">名　　${esc(p.name)}</div>
      <div class="ptext">レベル ${p.level}　経験 ${p.xp}/${p.nextXP}</div>
      <div class="ptext">HP　 ${p.hp}/${p.maxhp}</div>
      <div class="ptext">力 ${p.stats.str}　防御 ${p.stats.def}　命中 ${p.stats.acc}　回避 ${p.stats.eva}</div>
      <div class="ptext">深さ ${game.depth}（最深 ${p.depthMax}）　手数 ${p.turns}</div>
      <div class="ptext">撃破 ${p.kills}　金 ${p.gold}　${hungerWord(p) ? '腹：' + hungerWord(p) : ''}</div>
      <div class="ptext">状態 ${st}</div>`;
    this.panel('人物', html, 'Escで閉じる');
    this.mode = 'msg';
  }

  help() {
    const rows = [
      ['移動', '矢印 / hjkl / yubn（斜め）/ テンキー'],
      ['. または 5', 'その場で待つ'],
      ['g , （カンマ）', '足元の品を拾う'],
      ['> / <', '階段を降りる / 上る'],
      ['i / e', '持ち物 / 装備を見る'],
      ['q', '薬を飲む（quaff）'],
      ['r', '巻物を読む'],
      ['z', '杖を振る（→ 向き）'],
      ['w', '武器・防具を装備する'],
      ['t', '品を投げる（→ 向き）'],
      ['f', '食べる'],
      ['d', '置く（drop）'],
      ['s', '周りを調べる（隠し扉・罠）'],
      ['@ / C', '人物を見る'],
      ['S', 'この潜行を保存（自動でも保存）'],
      ['? ', 'この一覧'],
    ];
    const html = rows.map(([k, v]) => `<div class="row"><span class="key wide">${esc(k)}</span><span class="nm">${esc(v)}</span></div>`).join('');
    this.panel('遊び方', html, 'Escで閉じる');
    this.mode = 'msg';
  }

  death(game) {
    const lines = game.chronicle.epitaph(game.player, game.depth, game.cause);
    const won = game.state === 'won';
    const html = `<div class="grave ${won ? 'won' : ''}">${won ? '☀' : '☖'}</div>` + lines.map(l => `<div class="ptext center">${esc(l)}</div>`).join('') +
      `<div class="ptext center dim" style="margin-top:1em">同じ種：<code>#s=${game.seedRaw}</code></div>`;
    this.panel(won ? '生還' : '墓碑銘', html, 'Enter または R で、別の窟へ');
    this.mode = 'death';
  }
}

function equippedMark(game, it) {
  return Object.values(game.player.equip).includes(it) ? '（装備中）' : '';
}
function catName(c) { return { weapon: '武器', armor: '防具', ring: '指輪', amulet: '護符', potion: '薬', scroll: '巻物', wand: '杖', food: '食料', gold: '金' }[c] || c; }
function esc(s) { return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
