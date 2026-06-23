/* ============================================================
   謎 — 機械を回す手。鍵を押すとローターが進み、ランプが灯り、
   入力と出力がテープに積もる。設定を変えれば、位置を保ったまま組み直す。
   すべてこの端末の中だけ。鍵（#k=）を分かち合えば、同じ機械が開く。
   ============================================================ */
import { Enigma, packKey, unpackKey } from '../core/enigma.js';

const ROWS = ['QWERTZUIO', 'ASDFGHJK', 'PYXCVBNML'];
const ALPHA = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const ROTOR_NAMES = ['I', 'II', 'III', 'IV', 'V'];
const $ = (id) => document.getElementById(id);

let settings = parseHash() || {
  rotors: ['I', 'II', 'III'], reflector: 'B', rings: ['A', 'A', 'A'], positions: ['A', 'A', 'A'], plugs: [],
};
let machine = new Enigma(settings);
let armed = null;     // プラグボードで選択中の文字

function parseHash() {
  if (!location.hash.startsWith('#k=')) return null;
  try {
    const s = unpackKey(decodeURIComponent(location.hash.slice(3)));
    s.rings = [...String(s.rings)]; s.positions = [...String(s.positions)];
    if (s.rotors.length !== 3) return null;
    return s;
  } catch { return null; }
}

function rebuild(keepWindow = true) {
  if (keepWindow) settings.positions = [...machine.window()];
  machine = new Enigma(settings);
  renderRotors(); renderPlugboard(); updateKeyText();
}

/* ---- ローター ---- */
function renderRotors() {
  const el = $('rotors');
  el.innerHTML = '';
  for (let i = 0; i < 3; i++) {
    const r = document.createElement('div');
    r.className = 'rotor';
    const sel = `<select data-i="${i}" class="pick">${ROTOR_NAMES.map((n) => `<option ${n === settings.rotors[i] ? 'selected' : ''}>${n}</option>`).join('')}</select>`;
    const ring = `<select data-i="${i}" class="ringsel">${[...ALPHA].map((c, j) => `<option value="${c}" ${c === settings.rings[i] ? 'selected' : ''}>${String(j + 1).padStart(2, '0')} ${c}</option>`).join('')}</select>`;
    r.innerHTML = `${sel}
      <button class="arrow up" data-i="${i}">▲</button>
      <div class="win"><span class="letter">${machine.window()[i]}</span></div>
      <button class="arrow down" data-i="${i}">▼</button>
      <span class="ring">環 ${ring}</span>`;
    el.appendChild(r);
  }
  // 反射器
  const ref = document.createElement('div');
  ref.className = 'rotor';
  ref.innerHTML = `<select id="refsel">${['B', 'C'].map((n) => `<option ${n === settings.reflector ? 'selected' : ''}>${n}</option>`).join('')}</select>
    <div class="win" style="opacity:.7"><span class="letter">⟲</span></div><span class="ring">反射器</span>`;
  el.appendChild(ref);
}
function setPositionsFromWindow() { settings.positions = [...machine.window()]; }
function bumpRotor(i, d) {
  setPositionsFromWindow();
  const p = (ALPHA.indexOf(settings.positions[i]) + d + 26) % 26;
  settings.positions[i] = ALPHA[p];
  machine = new Enigma(settings);
  $('rotors').querySelectorAll('.letter')[i].textContent = settings.positions[i];
  updateKeyText();
}

/* ---- ランプ・鍵盤・プラグ ---- */
function renderBoard(id, kind) {
  const el = $(id); el.innerHTML = '';
  for (const row of ROWS) {
    const r = document.createElement('div'); r.className = 'row';
    for (const ch of row) {
      const c = document.createElement('div');
      c.className = 'cell'; c.dataset.ch = ch; c.textContent = ch;
      r.appendChild(c);
    }
    el.appendChild(r);
  }
}
function renderPlugboard() {
  renderBoard('plugboard', 'plug');
  const paired = {};
  for (const p of settings.plugs) { paired[p[0]] = p[1]; paired[p[1]] = p[0]; }
  $('plugboard').querySelectorAll('.cell').forEach((c) => {
    const ch = c.dataset.ch;
    if (paired[ch]) { c.classList.add('wired'); c.insertAdjacentHTML('beforeend', `<span class="pair">${paired[ch]}</span>`); }
    if (ch === armed) c.classList.add('armed');
  });
}

function lamp(ch) {
  const cells = $('lamps').querySelectorAll('.cell');
  cells.forEach((c) => c.classList.remove('on'));
  const t = [...cells].find((c) => c.dataset.ch === ch);
  if (t) { t.classList.add('on'); clearTimeout(lamp.t); lamp.t = setTimeout(() => t.classList.remove('on'), 420); }
}

/* ---- 打鍵 ---- */
function press(ch) {
  ch = ch.toUpperCase();
  if (ch < 'A' || ch > 'Z') return;
  const out = machine.encodeChar(ch);
  $('in').textContent = group(($('in').textContent + ch).replace(/ /g, ''));
  $('out').textContent = group(($('out').textContent + out).replace(/ /g, ''));
  // ローター窓を更新
  const ws = machine.window();
  $('rotors').querySelectorAll('.letter').forEach((l, i) => { l.textContent = ws[i]; });
  lamp(out);
  const k = $('keys').querySelector(`.cell[data-ch="${ch}"]`);
  if (k) { k.classList.add('down'); setTimeout(() => k.classList.remove('down'), 110); }
  updateKeyText();
}
const group = (s) => s.replace(/(.{5})/g, '$1 ').trim();

/* ---- プラグボード操作 ---- */
function plugClick(ch) {
  const cur = settings.plugs.find((p) => p.includes(ch));
  if (cur) { settings.plugs = settings.plugs.filter((p) => p !== cur); armed = null; rebuild(); return; }
  if (armed === null) { armed = ch; renderPlugboard(); return; }
  if (armed === ch) { armed = null; renderPlugboard(); return; }
  if (settings.plugs.some((p) => p.includes(armed))) { armed = ch; renderPlugboard(); return; }
  settings.plugs.push(armed + ch); armed = null; rebuild();
}

/* ---- 鍵テキスト・共有 ---- */
function updateKeyText() { setPositionsFromWindow(); $('keytext').textContent = packKey(settings); }
function flash(m) { const t = $('toast'); t.textContent = m; t.classList.add('on'); clearTimeout(flash.t); flash.t = setTimeout(() => t.classList.remove('on'), 1900); }

/* ---- 配線 ---- */
function wire() {
  renderRotors(); renderBoard('lamps'); renderBoard('keys'); renderPlugboard(); updateKeyText();

  $('rotors').addEventListener('click', (e) => {
    const up = e.target.closest('.arrow.up'); const dn = e.target.closest('.arrow.down');
    if (up) bumpRotor(+up.dataset.i, +1);
    if (dn) bumpRotor(+dn.dataset.i, -1);
  });
  $('rotors').addEventListener('change', (e) => {
    if (e.target.classList.contains('pick')) settings.rotors[+e.target.dataset.i] = e.target.value;
    else if (e.target.classList.contains('ringsel')) settings.rings[+e.target.dataset.i] = e.target.value;
    else if (e.target.id === 'refsel') settings.reflector = e.target.value;
    rebuild();
  });
  $('keys').addEventListener('click', (e) => { const c = e.target.closest('.cell'); if (c) press(c.dataset.ch); });
  $('plugboard').addEventListener('click', (e) => { const c = e.target.closest('.cell'); if (c) plugClick(c.dataset.ch); });
  window.addEventListener('keydown', (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (/^[a-zA-Z]$/.test(e.key)) { press(e.key); e.preventDefault(); }
  });

  $('reset').addEventListener('click', () => { machine = new Enigma(settings); renderRotors(); updateKeyText(); });
  $('clear').addEventListener('click', () => { $('in').textContent = ''; $('out').textContent = ''; });
  $('random').addEventListener('click', () => {
    const pick = [...ROTOR_NAMES].sort(() => Math.random() - 0.5).slice(0, 3);
    const rnd = () => ALPHA[Math.floor(Math.random() * 26)];
    const letters = [...ALPHA].sort(() => Math.random() - 0.5);
    const plugs = []; for (let i = 0; i < 12; i += 2) plugs.push(letters[i] + letters[i + 1]);   // 6 対
    settings = { rotors: pick, reflector: Math.random() < 0.5 ? 'B' : 'C', rings: [rnd(), rnd(), rnd()], positions: [rnd(), rnd(), rnd()], plugs };
    machine = new Enigma(settings); wireRefresh();
  });
  $('share').addEventListener('click', async () => {
    updateKeyText();
    const url = location.origin + location.pathname + '#k=' + encodeURIComponent(packKey(settings));
    try { await navigator.clipboard.writeText(url); flash('この鍵へのリンクを写しました'); }
    catch { location.hash = 'k=' + encodeURIComponent(packKey(settings)); flash('上のリンクが、この鍵です'); }
  });
}
function wireRefresh() { renderRotors(); renderPlugboard(); updateKeyText(); }

wire();
