/* ============================================================
   虫眼鏡 — 止まった機械の中を覗く。

   レジスタとフラグ、PC のまわりの逆アセンブル、好きな番地の
   メモリ。読むのは bus.ram を直に（bus.read だと乱数が進む
   など、覗いただけで機械が変わってしまう）。
   ============================================================ */

import { disasm } from '../core/asm.js';

const W = 0xFFFF;
const h4 = v => (v & W).toString(16).toUpperCase().padStart(4, '0');
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const DIS_BEFORE = 3;   // PC の前に見せる命令数
const DIS_ROWS = 9;     // 全部で見せる命令数
const MEM_ROWS = 16;    // メモリ表の行数
const MEM_COLS = 8;     // 1 行のワード数

export function createDebugger(els) {
  /* els: { regs, dis, memAddr(<input>), memDump(<pre>) } */
  let memBase = 0x8000;
  let last = null;   // { machine, lineOf, origin } 最後に覗いたもの

  els.memAddr.addEventListener('change', () => {
    const v = parseInt(els.memAddr.value.trim().replace(/^0x/i, ''), 16);
    if (!Number.isNaN(v)) memBase = v & W;
    els.memAddr.value = h4(memBase);
    paintMem();
  });

  function paintRegs() {
    const vm = last.machine.vm;
    let out = '';
    for (let i = 0; i < 8; i++) {
      out += `<div class="reg"><span class="rn">R${i}</span>` +
        `<span class="rv">${h4(vm.regs[i])}</span>` +
        `<span class="rd">${vm.regs[i]}</span></div>`;
    }
    out += `<div class="reg"><span class="rn">PC</span><span class="rv">${h4(vm.pc)}</span></div>`;
    out += `<div class="reg"><span class="rn">SP</span><span class="rv">${h4(vm.sp)}</span></div>`;
    const f = (name, on) => (on ? `<b>${name}</b>` : name);
    out += `<div class="flags">${f('Z', vm.fZ)} ${f('LT', vm.fLT)} ${f('B', vm.fB)}</div>`;
    if (vm.fault) out += `<div class="fault">故障 — ${esc(vm.fault)}</div>`;
    els.regs.innerHTML = out;
  }

  function paintDis() {
    const { machine, lineOf } = last;
    const vm = machine.vm, ram = machine.bus.ram;
    /* 命令は 2 ワード刻み。PC の少し前から、刻みを崩さずに見せる */
    let start = vm.pc - DIS_BEFORE * 2;
    if (start < 0) start = vm.pc & 1;
    let out = '';
    for (let r = 0; r < DIS_ROWS; r++) {
      const a = (start + r * 2) & W;
      const w0 = ram[a], imm = ram[(a + 1) & W];
      const here = a === vm.pc;
      const ln = lineOf ? lineOf(a) : undefined;
      out += `<div class="dis-row${here ? ' cur' : ''}">` +
        `<span class="dis-pc">${here ? '▶' : ''}</span>` +
        `<span class="dis-addr">${h4(a)}</span>` +
        `<span class="dis-w">${h4(w0)} ${h4(imm)}</span>` +
        `<span class="dis-t">${esc(disasm(w0, imm))}</span>` +
        `<span class="dis-line">${ln != null ? ln + '行' : ''}</span>` +
        `</div>`;
    }
    els.dis.innerHTML = out;
  }

  function paintMem() {
    if (!last) return;
    const ram = last.machine.bus.ram;
    let out = '';
    for (let r = 0; r < MEM_ROWS; r++) {
      const a = (memBase + r * MEM_COLS) & W;
      out += h4(a) + ':';
      for (let i = 0; i < MEM_COLS; i++) out += ' ' + h4(ram[(a + i) & W]);
      out += '\n';
    }
    els.memDump.textContent = out;
  }

  els.memAddr.value = h4(memBase);

  return {
    /* 止まるたび・進めるたびに呼ぶ */
    refresh(machine, lineOf = null, origin = 0x0100) {
      last = { machine, lineOf, origin };
      paintRegs();
      paintDis();
      paintMem();
    },
  };
}
