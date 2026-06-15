/* ============================================================
   窟 — 年代記と言伝（ことづて）。`史` が歴史を書いたように、
   この潜行で起きた値うちのある出来事を、勝手に書き留める。
   死んだとき、その一代記が墓碑銘になる。
   ============================================================ */

export class MessageLog {
  constructor(max = 200) { this.lines = []; this.max = max; this.turn = 0; }
  add(text, kind = 'info') {
    if (!text) return;
    const last = this.lines[this.lines.length - 1];
    if (last && last.text === text) { last.count = (last.count || 1) + 1; last.turn = this.turn; return; }
    this.lines.push({ text, kind, turn: this.turn });
    if (this.lines.length > this.max) this.lines.shift();
  }
  recent(n = 6) { return this.lines.slice(-n); }
  serialize() { return { lines: this.lines.slice(-60), turn: this.turn }; }
  static deserialize(o) { const m = new MessageLog(); m.lines = o.lines || []; m.turn = o.turn || 0; return m; }
}

export class Chronicle {
  constructor() { this.events = []; }
  record(turn, depth, type, text) { this.events.push({ turn, depth, type, text }); }

  /* 墓碑銘：この潜行の要約 */
  epitaph(player, depth, cause) {
    const lines = [];
    lines.push(`${player.name}は、第 ${depth} 階で${cause}。`);
    lines.push(`レベル ${player.level}・${player.turns} 手・${player.kills} 体を葬り・金 ${player.gold}。`);
    const notable = this.events.filter(e => e.type === 'boss' || e.type === 'descend' || e.type === 'find').slice(-4);
    for (const e of notable) lines.push(`　${e.text}`);
    return lines;
  }
  serialize() { return { events: this.events }; }
  static deserialize(o) { const c = new Chronicle(); c.events = o.events || []; return c; }
}
