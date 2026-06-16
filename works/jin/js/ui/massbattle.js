/* ============================================================
   陣 — 会戦の俯瞰ドット絵アニメ（ロマサガ風の軍勢ぶつかり）。
   resolveMassCombat の決定的な結果（各ラウンドの残兵）を、俯瞰の戦場で
   粒の兵が前進→激突→損耗→後退、と round ごとに動かして見せる。
   純関数 massPlan（兵数→粒数の台本）と、その台本を描く animator から成る。
   ============================================================ */

const MAX_DOTS = 48;     // 片軍の最大粒数（兵力はこれに丸めて表す）

/* 結果から「粒の台本」を組む（純粋・テスト可能）。
   { scale, dotsA0, dotsB0, rounds:[{a,b,killA,killB}] } */
export function massPlan(res, maxDots = MAX_DOTS) {
  const top = Math.max(1, res.troops0A, res.troops0B);
  const scale = Math.max(1, Math.ceil(top / maxDots));
  const dots = n => Math.max(0, Math.round(n / scale));
  const dotsA0 = dots(res.troops0A), dotsB0 = dots(res.troops0B);
  let pa = dotsA0, pb = dotsB0;
  const rounds = [];
  for (const r of res.rounds) {
    const a = dots(r.a), b = dots(r.b);
    rounds.push({ a, b, killA: Math.max(0, pa - a), killB: Math.max(0, pb - b) });
    pa = a; pb = b;
  }
  return { scale, dotsA0, dotsB0, rounds };
}

const COL = {
  a: { body: '#5b74d6', edge: '#2b3a86' },
  b: { body: '#c0463e', edge: '#7e2a25' },
  ground: '#46402f', ground2: '#3c3726',
};

function makeArmyDots(n, side, vw, vh) {
  const cols = Math.max(1, Math.ceil(Math.sqrt(n * 0.7)));
  const rows = Math.ceil(n / cols);
  const gap = Math.min(22, (vh * 0.6) / Math.max(rows, 1));
  const homeX = side === 'a' ? vw * 0.2 : vw * 0.8;
  const dir = side === 'a' ? 1 : -1;
  const arr = [];
  for (let i = 0; i < n; i++) {
    const c = i % cols, rw = (i / cols) | 0;
    const hx = homeX + dir * (-c * gap * 0.7);
    const hy = vh * 0.5 + (rw - rows / 2) * gap + (c % 2) * gap * 0.3;
    arr.push({ hx, hy, x: hx, y: hy, side, dir, alive: true, death: 0, ph: (i * 0.37) % 1 });
  }
  return arr;
}

/* 会戦アニメを再生。done() を最後に呼ぶ（タップでスキップ可）。 */
export function playMassBattle(canvas, res, opts = {}) {
  const plan = massPlan(res);
  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  const vw = window.innerWidth, vh = window.innerHeight;
  canvas.width = vw * dpr; canvas.height = vh * dpr;
  canvas.style.width = vw + 'px'; canvas.style.height = vh + 'px';
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  const A = makeArmyDots(plan.dotsA0, 'a', vw, vh);
  const B = makeArmyDots(plan.dotsB0, 'b', vw, vh);
  const sparks = [];
  let troopA = res.troops0A, troopB = res.troops0B;
  const nameA = opts.nameA || '自軍', nameB = opts.nameB || '敵軍';

  // 台本（フェイズ列）：各ラウンドで前進→激突→後退
  const steps = [];
  res.rounds.forEach((r, i) => {
    steps.push({ t: 'advance', dur: 360 });
    steps.push({ t: 'clash', dur: 240, killA: plan.rounds[i].killA, killB: plan.rounds[i].killB, troopA: r.a, troopB: r.b });
    steps.push({ t: 'recoil', dur: 220 });
  });
  steps.push({ t: 'end', dur: 1e9 });

  let si = 0, t0 = performance.now(), shake = 0, done = false, raf = 0;
  const aliveOf = arr => arr.filter(d => d.alive);
  function kill(arr, n) {
    const live = aliveOf(arr);
    for (let k = 0; k < n && k < live.length; k++) {
      // 中央に近い者から倒れる
      live.sort((p, q) => (p.side === 'a' ? q.x - p.x : p.x - q.x));
      const d = live[k]; d.alive = false; d.death = 1;
      sparks.push({ x: d.x, y: d.y, vx: (Math.random() - 0.5) * 1.5, vy: -1 - Math.random(), life: 1, c: '#ffe' });
    }
  }

  function finish() {
    if (done) return; done = true;
    cancelAnimationFrame(raf);
    window.removeEventListener('pointerdown', skip);
    if (opts.onDone) opts.onDone();
  }
  function skip() { finish(); }
  window.addEventListener('pointerdown', skip);

  function frame(now) {
    raf = requestAnimationFrame(frame);
    const step = steps[si];
    const p = Math.min(1, (now - t0) / step.dur);
    // フェイズ遷移
    if (p >= 1 && step.t !== 'end') {
      if (step.t === 'clash') { kill(A, step.killA); kill(B, step.killB); troopA = step.troopA; troopB = step.troopB; shake = 10; }
      si++; t0 = now;
    }
    // 位置の更新
    const clashX = vw * 0.5;
    for (const d of [...A, ...B]) {
      if (!d.alive) { d.y += 1.4; d.death = Math.max(0, d.death - 0.04); continue; }
      let tx = d.hx, ty = d.hy;
      // 両軍とも中央の境へ詰め寄る（0.6＝境の手前で噛み合う）
      if (step.t === 'advance') { tx = d.hx + (clashX - d.hx) * 0.6 * p; }
      else if (step.t === 'clash') { tx = d.hx + (clashX - d.hx) * 0.6; }
      else if (step.t === 'recoil') { tx = d.hx + (clashX - d.hx) * 0.6 * (1 - p); }
      const bob = Math.sin(now / 120 + d.ph * 6) * 1.5;
      d.x += (tx - d.x) * 0.25; d.y += (ty + bob - d.y) * 0.25;
    }
    shake = Math.max(0, shake - 0.6);
    draw(now);
  }

  function draw(now) {
    ctx.clearRect(0, 0, vw, vh);
    ctx.save();
    if (shake > 0.5) ctx.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);
    // 地（俯瞰）
    ctx.fillStyle = COL.ground; ctx.fillRect(0, 0, vw, vh);
    const ps = 14;
    for (let y = 0; y < vh; y += ps) for (let x = ((y / ps) & 1) * ps; x < vw; x += ps * 2) { ctx.fillStyle = COL.ground2; ctx.fillRect(x, y, ps, ps); }
    // 中央の境
    ctx.fillStyle = 'rgba(0,0,0,.18)'; ctx.fillRect(vw * 0.5 - 2, 0, 4, vh);
    // 兵（粒）
    const ds = Math.max(4, Math.min(9, (vw / 120) | 0));
    for (const d of [...A, ...B]) {
      const c = COL[d.side];
      if (d.alive) {
        ctx.fillStyle = c.edge; ctx.fillRect((d.x | 0) - ds / 2, (d.y | 0) - ds / 2 + 1, ds, ds);
        ctx.fillStyle = c.body; ctx.fillRect((d.x | 0) - ds / 2, (d.y | 0) - ds / 2, ds, ds - 2);
        ctx.fillStyle = '#e9c39c'; ctx.fillRect((d.x | 0) - ds / 4, (d.y | 0) - ds / 2 - 1, ds / 2, 2);  // 頭
      } else if (d.death > 0) {
        ctx.globalAlpha = d.death; ctx.fillStyle = c.edge; ctx.fillRect((d.x | 0) - ds / 2, (d.y | 0), ds, 2); ctx.globalAlpha = 1;
      }
    }
    // 火花
    for (let i = sparks.length - 1; i >= 0; i--) {
      const s = sparks[i]; s.x += s.vx; s.y += s.vy; s.vy += 0.12; s.life -= 0.04;
      if (s.life <= 0) { sparks.splice(i, 1); continue; }
      ctx.globalAlpha = s.life; ctx.fillStyle = s.c; ctx.fillRect(s.x | 0, s.y | 0, 2, 2); ctx.globalAlpha = 1;
    }
    ctx.restore();
    // 兵力の帯と数
    bar(ctx, 20, 18, vw * 0.34, nameA, troopA, res.troops0A, COL.a.body, false);
    bar(ctx, vw - 20 - vw * 0.34, 18, vw * 0.34, nameB, troopB, res.troops0B, COL.b.body, true);
    if (steps[si].t === 'end') {
      ctx.fillStyle = 'rgba(0,0,0,.5)'; ctx.fillRect(0, vh * 0.42, vw, 64);
      ctx.fillStyle = '#fff'; ctx.font = `bold 30px ui-sans-serif`; ctx.textAlign = 'center';
      ctx.fillText(res.winner === 'a' ? `${nameA} 勝利！` : `${nameB} 勝利……`, vw / 2, vh * 0.42 + 42);
      ctx.font = `15px ui-sans-serif`; ctx.fillStyle = '#cdd6ea';
      ctx.fillText('タップで進む', vw / 2, vh * 0.42 + 64 + 18);
    }
  }
  function bar(ctx, x, y, w, name, cur, max, color, right) {
    const h = 14, frac = Math.max(0, cur / Math.max(1, max));
    ctx.fillStyle = 'rgba(0,0,0,.5)'; ctx.fillRect(x, y, w, h);
    ctx.fillStyle = color; ctx.fillRect(right ? x + w - w * frac : x, y, w * frac, h);
    ctx.fillStyle = '#fff'; ctx.font = 'bold 13px ui-sans-serif'; ctx.textAlign = right ? 'right' : 'left';
    ctx.fillText(`${name}　${cur}`, right ? x + w : x, y - 4);
  }

  raf = requestAnimationFrame(frame);
  return { skip: finish };
}
