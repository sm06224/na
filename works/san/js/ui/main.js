/* ============================================================
   算 — 開発環境のへそ。

   左に機械（画面と口）、右に工房（紙と虫眼鏡）。
   ここはそれらを束ねるだけで、機械の理屈は core/ に、
   珠の理屈は lang/ にある。ここは何も計算しない。
   ============================================================ */

import { Machine, STEPS_PER_FRAME } from '../core/machine.js';
import { assemble } from '../core/asm.js';
import { compile } from '../lang/tama.js';
import { ROMS } from '../roms.js';
import { Screen } from './screen.js';
import { AudioOut } from './audio.js';
import { createPad } from './input.js';
import { createEditor } from './editor.js';
import { createDebugger } from './debugger.js';

const $ = id => document.getElementById(id);

/* ----- 部品 ----- */

const machine = new Machine();
const screen = new Screen($('screen'), $('screenBox'));
const audio = new AudioOut();
const pad = createPad($('screenBox'));

/* ----- 状態 ----- */

let powered = false;      // 電源が入っているか
let paused = false;       // 止めて覗いているか
let skipBp = false;       // 再開直後、いま立っている中断点を一度だけ見逃す
let haltNoted = false;    // 停止・故障を口に書いたか
let build = null;         // 最後に組めたもの { words, origin, lineOf, ... }
let lineToAddr = new Map();        // 行 → その行の最初の番地
let breakAddrs = new Set();        // 中断点（番地）
const bpLines = new Set();         // 中断点（行）

/* ----- 工房 ----- */

const editor = createEditor($('editor'), {
  onBreakToggle(line) {
    if (bpLines.has(line)) bpLines.delete(line);
    else bpLines.add(line);
    editor.setBreakpoints(bpLines);
    bindBreakpoints();
  },
});

const dbg = createDebugger({
  regs: $('dbgRegs'),
  dis: $('dbgDisasm'),
  memAddr: $('memAddr'),
  memDump: $('memDump'),
});

/* ----- 口（シリアル） ----- */

const serialOut = $('serialOut');
const CONSOLE_MAX = 24000;   // これより長い記憶は、先頭から忘れる

function appendConsole(text, cls = null) {
  if (!text) return;
  const stick = serialOut.scrollTop + serialOut.clientHeight >= serialOut.scrollHeight - 6;
  if (cls) {
    const span = document.createElement('span');
    span.className = cls;
    span.textContent = text;
    serialOut.appendChild(span);
  } else {
    serialOut.appendChild(document.createTextNode(text));
  }
  let total = serialOut.textContent.length;
  while (total > CONSOLE_MAX && serialOut.firstChild) {
    const n = serialOut.firstChild;
    const len = n.textContent.length;
    const over = total - CONSOLE_MAX;
    if (len <= over) { n.remove(); total -= len; }
    else { n.textContent = n.textContent.slice(over); total -= over; }
  }
  if (stick) serialOut.scrollTop = serialOut.scrollHeight;
}

function pumpSerial() {
  appendConsole(machine.devices.takeSerial());
}

$('serialIn').addEventListener('keydown', e => {
  if (e.key !== 'Enter') return;
  const v = e.target.value;
  machine.devices.pressKey(v + '\n');
  appendConsole('⟩ ' + v + '\n', 'echo');
  e.target.value = '';
});

/* ----- 組む ----- */

function showErrors(errors) {
  const box = $('buildErrors');
  box.innerHTML = '';
  box.hidden = !errors.length;
  for (const er of errors) {
    const b = document.createElement('button');
    b.className = 'errRow';
    b.textContent = `${er.line} 行: ${er.msg}`;
    b.addEventListener('click', () => editor.scrollToLine(er.line));
    box.appendChild(b);
  }
}

/* 紙の中身を組む。誤りがあれば赤を点して null */
function doBuild() {
  const src = editor.getValue();
  const lang = $('langSel').value;
  const out = lang === 'tama' ? compile(src) : assemble(src);
  editor.setErrors(out.ok ? [] : out.errors);
  showErrors(out.ok ? [] : out.errors);
  return out.ok ? out : null;
}

/* 行 → 番地の逆引き表（中断点のため）。最初の番地を採る */
function buildLineMap() {
  lineToAddr = new Map();
  if (!build) return;
  const end = build.origin + build.words.length;
  for (let a = build.origin; a < end; a++) {
    const ln = build.lineOf(a);
    if (ln != null && !lineToAddr.has(ln)) lineToAddr.set(ln, a);
  }
}

function bindBreakpoints() {
  breakAddrs = new Set();
  for (const line of bpLines) {
    const a = lineToAddr.get(line);
    if (a !== undefined) breakAddrs.add(a);
  }
}

/* 組んで、据えて、入口に PC を合わせる。走らせはしない */
function loadProgram() {
  const out = doBuild();
  if (!out) return false;
  build = out;
  buildLineMap();
  bindBreakpoints();
  machine.reset();
  machine.loadWords(build.words, build.origin);
  powered = true;
  haltNoted = false;
  skipBp = false;
  editor.setCurrentLine(null);
  $('bPower').textContent = '組んで走らせる';
  return true;
}

/* ----- 走る ----- */

/* 1 フレームぶん。中断点に当たったら、時は進めずに止まる */
function stepFrame(budget = STEPS_PER_FRAME) {
  const vm = machine.vm, dev = machine.devices;
  let steps = 0;
  while (steps < budget && !vm.halted && !dev.flip) {
    if (breakAddrs.size && breakAddrs.has(vm.pc) && !(skipBp && steps === 0)) {
      skipBp = false;
      return { hitBp: true };
    }
    vm.step();
    steps++;
  }
  skipBp = false;
  dev.tick();
  return { hitBp: false };
}

function refreshDebug() {
  dbg.refresh(machine, build ? build.lineOf : null, build ? build.origin : 0x0100);
  const ln = build ? build.lineOf(machine.vm.pc) : null;
  editor.setCurrentLine(paused && ln != null ? ln : null);
  $('dbgPanes').classList.toggle('stale', !paused);
}

function enterPause() {
  paused = true;
  audio.silence();
  refreshDebug();
}

function leavePause() {
  paused = false;
  skipBp = true;
  editor.setCurrentLine(null);
  $('dbgPanes').classList.add('stale');
}

function noteHalt() {
  if (haltNoted) return;
  haltNoted = true;
  audio.silence();
  const vm = machine.vm;
  appendConsole(vm.fault ? `※ 故障 — ${vm.fault}\n` : '※ 機械は静かに止まった (HLT)\n', 'echo');
  refreshDebug();
}

/* ----- 看板 ----- */

const stState = $('stState'), stFrame = $('stFrame'), stSteps = $('stSteps');

function updateStatus() {
  const vm = machine.vm;
  let label, cls;
  if (!powered) { label = '待機'; cls = 'idle'; }
  else if (vm.fault) { label = '故障 — ' + vm.fault; cls = 'bad'; }
  else if (vm.halted) { label = '停止'; cls = 'off'; }
  else if (paused) { label = '一時停止'; cls = 'hold'; }
  else { label = '走行中'; cls = 'run'; }
  if (stState.textContent !== label) stState.textContent = label;
  stState.className = 'state ' + cls;
  stFrame.textContent = 'フレーム ' + machine.devices.frame;
  stSteps.textContent = '命令 ' + vm.steps;
  $('bPause').textContent = paused ? '再開' : '一時停止';
  $('bPause').classList.toggle('active', paused);
}

/* ----- 心拍 ----- */

let lastFrameAt = 0;   // 速い画面（120Hz など）でも機械は 60fps で歩かせる

function tick(now = performance.now()) {
  requestAnimationFrame(tick);
  const due = now - lastFrameAt >= 15;
  if (due && powered && !paused && !machine.vm.halted) {
    lastFrameAt = now;
    machine.devices.setButtons(pad.active ? pad.mask : 0);
    const r = stepFrame();
    audio.update(machine.devices.sound);
    if (r.hitBp) enterPause();
    if (machine.vm.halted) noteHalt();
  }
  pumpSerial();
  screen.draw(machine.bus);   // 走っていなくても、いまの VRAM を映しておく
  updateStatus();
}
requestAnimationFrame(tick);

/* ----- 釦 ----- */

$('bPower').addEventListener('click', () => {
  audio.ensure();   // AudioContext は人の手の中でしか生まれない
  if (loadProgram()) {
    paused = false;
    $('screenBox').focus();
  }
  updateStatus();
});

$('bPause').addEventListener('click', () => {
  if (!powered) return;
  if (paused) leavePause();
  else enterPause();
  updateStatus();
});

$('bStepI').addEventListener('click', () => {
  if (!powered) { if (!loadProgram()) return; }
  if (!paused) { enterPause(); updateStatus(); return; }
  const vm = machine.vm;
  if (!vm.halted) {
    vm.step();
    /* FLIP の前で立ち止まらせない。見せたがっているなら見せて、時を進める */
    if (machine.devices.flip) machine.devices.tick();
    if (vm.halted) noteHalt();
  }
  pumpSerial();
  refreshDebug();
  updateStatus();
});

$('bStepF').addEventListener('click', () => {
  if (!powered) { if (!loadProgram()) return; }
  if (!paused) { enterPause(); updateStatus(); return; }
  if (!machine.vm.halted) {
    skipBp = true;
    stepFrame();
    if (machine.vm.halted) noteHalt();
  }
  pumpSerial();
  refreshDebug();
  updateStatus();
});

$('bReset').addEventListener('click', () => {
  if (!build && !loadProgram()) return;
  machine.reset();
  machine.loadWords(build.words, build.origin);
  powered = true;
  haltNoted = false;
  skipBp = false;
  paused = true;   // 据え直したら、まず覗けるように止めておく
  refreshDebug();
  updateStatus();
});

$('bMute').addEventListener('click', e => {
  const m = !audio.muted;
  audio.setMuted(m);
  e.target.textContent = m ? '音を出す' : '音を消す';
  e.target.classList.toggle('active', m);
});

/* ----- 棚 ----- */

const romSel = $('romSel'), langSel = $('langSel');

for (const rom of ROMS) {
  const opt = document.createElement('option');
  opt.value = rom.id;
  opt.textContent = rom.name;
  romSel.appendChild(opt);
}

function loadRom(rom) {
  if (!rom) return;
  langSel.value = rom.lang;
  editor.setLang(rom.lang);
  editor.setValue(rom.src);
  $('romBlurb').textContent = rom.blurb ?? '';
  bpLines.clear();
  editor.setBreakpoints(bpLines);
  breakAddrs.clear();
  build = null;
  lineToAddr.clear();
  editor.setErrors([]);
  showErrors([]);
  editor.setCurrentLine(null);
}

romSel.addEventListener('change', () => {
  loadRom(ROMS.find(r => r.id === romSel.value));
});
langSel.addEventListener('change', () => editor.setLang(langSel.value));

/* 起動：棚のいちばん手前を紙に置いておく。走らせるのは人の手 */
if (ROMS.length) loadRom(ROMS[0]);
appendConsole('「電源を入れる」で、機械が目を覚ます。\n', 'echo');
updateStatus();
