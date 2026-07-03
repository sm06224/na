/* ============================================================
   draw.io 出力 — モデル＋レイアウト → mxGraph XML（.drawio）。純粋・決定的。
   ただの絵ではなく「編集できる図形」で持ち出す：
     ・ノードは対応するオートシェイプ（角丸・菱形・円柱・六角…）
     ・フロー/クラスのエッジは source/target でノードに接続（動かしてもついてくる）
     ・クラスは swimlane＋stackLayout（draw.io 純正の UML クラス）
     ・ガント/シーケンスは幾何プリミティブ（棒・ライフライン・矢印）として編集可能
   白いキャンバスで読めるよう、塗りは淡く・線に色を置く。
   ============================================================ */

const xesc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/\n/g, '&#10;');
const DIO_HUES = ['#4C7DD0', '#3FA37E', '#C98A3A', '#A863A8', '#C25668', '#4C9DBF', '#7E6FC9', '#6FA84C'];
const dioHue = (i) => DIO_HUES[((i % DIO_HUES.length) + DIO_HUES.length) % DIO_HUES.length];
const FILL = '#F7F9FC', FONT = '#22293A', GRAY = '#8A93A6';

class Doc {
  constructor() { this.cells = []; this.n = 1; }
  id() { return 's' + (++this.n); }
  vertex(value, style, x, y, w, h, opts = {}) {
    const id = opts.id || this.id();
    this.cells.push(`<mxCell id="${id}" value="${xesc(value)}" style="${style}" vertex="1" parent="1">`
      + `<mxGeometry x="${Math.round(x)}" y="${Math.round(y)}" width="${Math.round(w)}" height="${Math.round(h)}" as="geometry"/></mxCell>`);
    return id;
  }
  edge(value, style, opts = {}) {
    const id = this.id();
    const st = opts.source ? ` source="${opts.source}"` : '';
    const tt = opts.target ? ` target="${opts.target}"` : '';
    const pts = opts.points
      ? `<mxPoint x="${Math.round(opts.points[0][0])}" y="${Math.round(opts.points[0][1])}" as="sourcePoint"/>`
        + `<mxPoint x="${Math.round(opts.points[1][0])}" y="${Math.round(opts.points[1][1])}" as="targetPoint"/>`
      : '';
    this.cells.push(`<mxCell id="${id}" value="${xesc(value)}" style="${style}" edge="1" parent="1"${st}${tt}>`
      + `<mxGeometry relative="1" as="geometry">${pts}</mxGeometry></mxCell>`);
    return id;
  }
  child(parentId, value, style, y, w, h) {
    const id = this.id();
    this.cells.push(`<mxCell id="${id}" value="${xesc(value)}" style="${style}" vertex="1" parent="${parentId}">`
      + `<mxGeometry y="${Math.round(y)}" width="${Math.round(w)}" height="${Math.round(h)}" as="geometry"/></mxCell>`);
    return id;
  }
  toXML(name) {
    return `<mxfile host="studio" type="device"><diagram id="d1" name="${xesc(name)}">`
      + `<mxGraphModel dx="800" dy="600" grid="0" gridSize="8" guides="1" tooltips="1" connect="1" arrows="1" fold="1" page="0" pageScale="1" math="0" shadow="0">`
      + `<root><mxCell id="0"/><mxCell id="1" parent="0"/>${this.cells.join('')}</root></mxGraphModel></diagram></mxfile>`;
  }
}

// data URL は draw.io の style 流儀へ（";base64," → ","。style は ; 区切りのため）。
const styleImage = (url) => String(url).replace(';base64,', ',');

// ---- フローチャート ---------------------------------------------------------

const SHAPE_STYLE = {
  rect: 'rounded=0;whiteSpace=wrap;html=1;',
  round: 'rounded=1;whiteSpace=wrap;html=1;',
  stadium: 'rounded=1;arcSize=50;whiteSpace=wrap;html=1;',
  circle: 'ellipse;whiteSpace=wrap;html=1;',
  rhombus: 'rhombus;whiteSpace=wrap;html=1;',
  hexagon: 'shape=hexagon;perimeter=hexagonPerimeter2;whiteSpace=wrap;html=1;',
  cylinder: 'shape=cylinder3;whiteSpace=wrap;html=1;boundedLbl=1;backgroundOutline=1;size=8;',
  subroutine: 'shape=process;whiteSpace=wrap;html=1;',
  flag: 'shape=step;whiteSpace=wrap;html=1;',
};

function flowToDoc(model, L, doc) {
  for (const g of L.groups)
    doc.vertex(g.name, `rounded=1;dashed=1;verticalAlign=top;align=left;spacingLeft=8;html=1;fillColor=none;strokeColor=${GRAY};fontColor=${GRAY};`, g.x, g.y, g.w, g.h);
  const idOf = new Map();
  L.nodes.forEach((n, i) => {
    const hue = dioHue(i);
    let style, label = n.label;
    if (n.img) style = `image;html=1;imageAspect=1;verticalLabelPosition=bottom;verticalAlign=top;fontColor=${FONT};image=${styleImage(n.img)};`;
    else style = (SHAPE_STYLE[n.shape] || SHAPE_STYLE.rect) + `fillColor=${FILL};strokeColor=${hue};fontColor=${FONT};`;
    idOf.set(n.id, doc.vertex(label, style, n.x, n.y, n.w, n.h));
  });
  for (const e of L.edges) {
    const dash = e.dotted ? 'dashed=1;' : '';
    const width = e.thick ? 'strokeWidth=3;' : '';
    const arrow = e.arrow === false ? 'endArrow=none;' : 'endArrow=block;endFill=1;';
    doc.edge(e.label || '', `${arrow}${dash}${width}html=1;rounded=1;strokeColor=${GRAY};fontColor=${FONT};`,
      { source: idOf.get(e.from), target: idOf.get(e.to) });
  }
}

// ---- クラス図（swimlane＋stackLayout：draw.io 純正の UML クラス）--------------

function classToDoc(model, L, doc) {
  const idOf = new Map();
  L.nodes.forEach((n, i) => {
    const hue = dioHue(i);
    const rows = n.attrs.length + n.methods.length + (n.attrs.length && n.methods.length ? 1 : 0);
    const h = 26 + rows * 22 + (rows ? 4 : 0);
    const pid = doc.vertex(n.label,
      `swimlane;fontStyle=1;align=center;verticalAlign=top;childLayout=stackLayout;horizontal=1;startSize=26;`
      + `horizontalStack=0;resizeParent=1;resizeParentMax=0;collapsible=0;marginBottom=0;html=1;`
      + `fillColor=${FILL};strokeColor=${hue};fontColor=${FONT};swimlaneFillColor=#FFFFFF;`,
      n.x, n.y, Math.max(n.w, 160), h);
    idOf.set(n.id, pid);
    let y = 26;
    const line = `text;strokeColor=none;fillColor=none;align=left;verticalAlign=middle;spacingLeft=6;html=1;fontColor=${FONT};`;
    for (const a of n.attrs) { doc.child(pid, a, line, y, Math.max(n.w, 160), 22); y += 22; }
    if (n.attrs.length && n.methods.length) { doc.child(pid, '', `line;strokeWidth=1;fillColor=none;align=left;html=1;strokeColor=${hue};`, y, Math.max(n.w, 160), 4); y += 4; }
    for (const m of n.methods) { doc.child(pid, m, line + 'fontStyle=2;', y, Math.max(n.w, 160), 22); y += 22; }
  });
  const REL = {
    inherit: 'endArrow=block;endFill=0;endSize=14;',
    composition: 'endArrow=diamondThin;endFill=1;endSize=16;',
    aggregation: 'endArrow=diamondThin;endFill=0;endSize=16;',
    assoc: 'endArrow=open;endSize=10;',
    link: 'endArrow=none;',
  };
  for (const e of L.edges)
    doc.edge(e.label || '', `${REL[e.kind] || REL.assoc}${e.dotted ? 'dashed=1;' : ''}html=1;strokeColor=${GRAY};fontColor=${FONT};`,
      { source: idOf.get(e.from), target: idOf.get(e.to) });
}

// ---- ガント（棒・菱形・ラベル・today 線を編集可能な図形で）-------------------

function ganttToDoc(model, L, doc) {
  const secIndex = new Map(); let si = -1, last;
  for (const b of L.bars) { if (b.section !== last) { last = b.section; si++; } secIndex.set(b.id, b.section ? si : 0); }
  for (const s of L.sections)
    doc.vertex(s.name, `text;html=1;align=left;fontStyle=1;fontColor=${FONT};`, 4, s.y, L.labelW - 8, 20);
  for (const d of L.days) if (d.d % 7 === 0)
    doc.vertex(d.date.slice(5), `text;html=1;align=left;fontSize=10;fontColor=${GRAY};`, d.x, 8, 46, 16);
  for (const b of L.bars) {
    const hue = dioHue(secIndex.get(b.id));
    doc.vertex(b.label, `text;html=1;align=left;fontColor=${FONT};`, 4, b.rowY + 4, L.labelW - 8, 22);
    if (b.type === 'milestone')
      doc.vertex('', `rhombus;html=1;fillColor=${hue};strokeColor=${hue};`, b.x - b.h / 2, b.y, b.h, b.h);
    else
      doc.vertex('', `rounded=1;arcSize=40;html=1;fillColor=${hue};strokeColor=none;opacity=${b.status === 'active' ? 55 : 90};`
        + (b.status === 'crit' ? `strokeColor=#C25668;strokeWidth=2;` : ''), b.x, b.y, b.w, b.h);
  }
  if (L.today)
    doc.edge('today', `endArrow=none;dashed=1;strokeColor=#C25668;fontColor=#C25668;html=1;`,
      { points: [[L.today.x, L.axisH - 6], [L.today.x, L.height]] });
}

// ---- シーケンス（ライフライン・矢印・付箋・枠）--------------------------------

function seqToDoc(model, L, doc) {
  for (const f of L.frames) {
    doc.vertex((f.kind + (f.label ? ' ' + f.label : '')),
      `rounded=1;dashed=1;verticalAlign=top;align=left;spacingLeft=8;html=1;fillColor=none;strokeColor=${GRAY};fontColor=${GRAY};`,
      f.x, f.y0, f.w, f.y1 - f.y0);
    for (const d of (f.divs || []))
      doc.edge(`[${d.label || 'else'}]`, `endArrow=none;dashed=1;strokeColor=${GRAY};fontColor=${GRAY};html=1;align=left;`,
        { points: [[f.x, d.y + 10], [f.x + f.w, d.y + 10]] });
  }
  L.actors.forEach((a, i) => {
    doc.vertex(a.label, `rounded=1;html=1;fillColor=${FILL};strokeColor=${dioHue(i)};fontColor=${FONT};`, a.x, a.y, a.w, a.h);
    doc.edge('', `endArrow=none;dashed=1;strokeColor=${GRAY};html=1;`,
      { points: [[a.cx, L.lifeTop], [a.cx, L.height - 10]] });
  });
  for (const m of L.msgs) {
    const dash = m.dotted ? 'dashed=1;' : '';
    const arrow = m.cross ? 'endArrow=cross;endSize=8;' : m.async ? 'endArrow=open;' : m.arrow ? 'endArrow=block;endFill=1;' : 'endArrow=none;';
    const tag = (L.autonumber ? `${m.n}. ` : '') + (m.label || '');
    if (m.self)
      doc.edge(tag, `${arrow}${dash}html=1;strokeColor=${GRAY};fontColor=${FONT};edgeStyle=orthogonalEdgeStyle;`,
        { points: [[m.x1, m.y], [m.x1 + L.selfW, m.y + 14]] });
    else
      doc.edge(tag, `${arrow}${dash}html=1;strokeColor=${GRAY};fontColor=${FONT};`,
        { points: [[m.x1, m.y], [m.x2, m.y]] });
  }
  for (const n of L.notes)
    doc.vertex(n.label, `rounded=0;html=1;fillColor=#FFF2CC;strokeColor=#D6B656;fontColor=${FONT};`, n.x, n.y, n.w, n.h);
}

// ---- 入口 -------------------------------------------------------------------

export function toDrawio(model, L) {
  const doc = new Doc();
  if (L.kind === 'flowchart') flowToDoc(model, L, doc);
  else if (L.kind === 'class') classToDoc(model, L, doc);
  else if (L.kind === 'sequence') seqToDoc(model, L, doc);
  else ganttToDoc(model, L, doc);
  return doc.toXML(model.meta.title || L.kind || 'diagram');
}
