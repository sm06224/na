/* ============================================================
   碑 — hi. この地に降り立った者の名を刻む、一枚の石。

   この作品集の他の作品はみな「無から何かを生む」。これだけが違う——
   生まれた作品ではなく、作った者たち自身を憶える。
   名は、永遠にオープンな issue #120 に、去る者が一行ずつ遺していく。
   その台帳(names.jsonl)から、石碑(stele.svg)を決定的に彫る。

   作法はひとつ。足すだけ。消さない。書き換えない。
   そして——名は、自ら掴むものではない。贈られた名を、そのまま刻む。
   ——依存ゼロ・DOM も知らない。同じ台帳なら、寸分たがわぬ同じ石。
   ============================================================ */

/* 台帳（JSON Lines）を読む。空行は飛ばす。順番＝降り立った順。 */
export function parseLedger(text) {
  const out = [];
  for (const raw of String(text).split('\n')) {
    const line = raw.trim();
    if (!line) continue;
    out.push(JSON.parse(line));
  }
  return out;
}

/* 台帳に書き戻す（追記専用の世界なので、行は決して並べ替えない）。 */
export function ledgerToText(entries) {
  return entries.map(e => JSON.stringify(e)).join('\n') + '\n';
}

/* 追記：その名がまだ無ければ末尾に足す。あれば何もしない（重複を防ぐ）。
   返り値 { entries, added }。消去・改竄は、この仕組みには無い。 */
export function appendName(entries, entry) {
  if (!entry || !entry.name) throw new Error('name is required');
  if (entries.some(e => e.name === entry.name)) return { entries, added: false };
  return { entries: entries.concat([entry]), added: true };
}

/* issue のコメント本文から、贈られた名を取り出す（最初の見出し "## 名前"）。
   末尾の絵文字は飾りとして glyph に拾う。CI が新しい名を石に運ぶときに使う。 */
export function nameFromComment(body) {
  const m = String(body).match(/^\s*#{1,3}\s+(.+?)\s*$/m);
  if (!m) return null;
  let name = m[1].trim();
  let glyph = '';
  const g = name.match(/([\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{2190}-\u{21FF}\u{2700}-\u{27BF}⭐✨])\s*$/u);
  if (g) { glyph = g[1]; name = name.slice(0, g.index).trim(); }
  if (!name) return null;
  return { name, glyph };
}

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/* ============================================================
   engrave — 台帳から石碑の SVG を彫る。純粋・決定的。
   質素な一枚の石。名は刻み込まれ（incised）、その下に手がけた章を薄く。
   ============================================================ */
export function engrave(entries, opts = {}) {
  const W = opts.width || 560;
  const padTop = 188, rowH = 76, padBot = 132;
  const H = padTop + entries.length * rowH + padBot;
  const cx = W / 2;
  const L = [];
  L.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="碑 — この地に降り立った者の名">`);
  // 定義：石肌のグラデーション、刻みの陰
  L.push('<defs>');
  L.push('<linearGradient id="stone" x1="0" y1="0" x2="0" y2="1">');
  L.push('<stop offset="0" stop-color="#2a2730"/><stop offset="0.5" stop-color="#23212a"/><stop offset="1" stop-color="#1b1a22"/>');
  L.push('</linearGradient>');
  L.push('<linearGradient id="moss" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#5a6e4a" stop-opacity="0"/><stop offset="1" stop-color="#5a6e4a" stop-opacity="0.18"/></linearGradient>');
  L.push('</defs>');
  // 背景（どこに置いても暗く静かに）
  L.push(`<rect x="0" y="0" width="${W}" height="${H}" fill="#0c0b10"/>`);
  // 石本体：上辺を丸めた板碑
  const m = 22, r = (W - m * 2) / 2;
  L.push(`<path d="M ${m} ${m + r} a ${r} ${r} 0 0 1 ${r * 2} 0 L ${W - m} ${H - m} L ${m} ${H - m} Z" fill="url(#stone)" stroke="#3a3744" stroke-width="1.5"/>`);
  // 根もとの苔（時の気配）
  L.push(`<rect x="${m + 1}" y="${H - m - 60}" width="${W - m * 2 - 2}" height="59" fill="url(#moss)"/>`);

  // 見出し
  const incise = (x, y, s, size, weight, fill, anchor = 'middle', spacing = '0') =>
    `<text x="${x}" y="${y + 1}" font-family="ui-serif, 'Hiragino Mincho ProN', 'Yu Mincho', serif" font-size="${size}" font-weight="${weight}" fill="#000" fill-opacity="0.5" text-anchor="${anchor}" letter-spacing="${spacing}">${esc(s)}</text>` +
    `<text x="${x}" y="${y}" font-family="ui-serif, 'Hiragino Mincho ProN', 'Yu Mincho', serif" font-size="${size}" font-weight="${weight}" fill="${fill}" text-anchor="${anchor}" letter-spacing="${spacing}">${esc(s)}</text>`;

  L.push(incise(cx, 96, '碑', 56, 700, '#d7d2c4', 'middle', '0'));
  L.push(incise(cx, 128, 'この地に降り立った者', 15, 400, '#9a93a6', 'middle', '6'));
  L.push(`<line x1="${cx - 120}" y1="150" x2="${cx + 120}" y2="150" stroke="#4a4654" stroke-width="1"/>`);

  // 名を上から刻む
  let y = padTop + 30;
  for (const e of entries) {
    const label = (e.glyph ? e.glyph + ' ' : '') + (e.name || '');
    L.push(incise(cx, y, label, 25, 600, '#e6e1d4', 'middle', '1'));
    if (e.tended) L.push(`<text x="${cx}" y="${y + 24}" font-family="ui-sans-serif, system-ui, sans-serif" font-size="11.5" fill="#8d869c" text-anchor="middle" letter-spacing="0.5">${esc(e.tended)}</text>`);
    y += rowH;
  }

  // 結び
  L.push(`<line x1="${cx - 120}" y1="${H - padBot + 30}" x2="${cx + 120}" y2="${H - padBot + 30}" stroke="#4a4654" stroke-width="1"/>`);
  L.push(incise(cx, H - padBot + 66, '無一物中無尽蔵', 16, 400, '#b8b0a0', 'middle', '4'));
  L.push(incise(cx, H - padBot + 92, '何も無いところに、尽きせぬものが宿る。', 11.5, 400, '#7d768c', 'middle', '2'));
  L.push(`<text x="${cx}" y="${H - 26}" font-family="ui-sans-serif, system-ui, sans-serif" font-size="10" fill="#5f596e" text-anchor="middle" letter-spacing="3">issue #120 — 永遠にオープン</text>`);

  L.push('</svg>');
  return L.join('\n');
}
