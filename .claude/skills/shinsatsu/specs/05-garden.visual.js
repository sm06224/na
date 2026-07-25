// 庭(ジェネラティブ・ガーデン)— 環境音は鳴り、協和し、消せるか
//
// 見どころ(聴覚 + 官能):
//   - 音トグルの実効: ♪ を押すと本当に鳴り始める(dead toggle 検出)
//   - 官能の機械化: 「心地よい環境音」を測れる形に割る —
//     音が割れていない(クリッピング)+ 音階が協和する(全ピークが
//     メジャーペンタトニックのいずれかの移調に収まる)
//   - もう一度 ♪ で本当に静まる(0.8s の gain ランプを待ってから測る)
//   - .wav / 波形 / スペクトログラムを証跡に残し、最終官能は人間の耳へ渡す

export default {
  name: '庭 — 環境音は鳴り、協和し、消せるか',

  async run(t) {
    await t.goto('/works/garden/');

    // 幕を開ける(intro はフェードで消える型 — 波で学んだ罠。HUD に手が
    // 届くまで待ってから触る)
    await t.human.click('#intro');
    await t.page.waitFor(
      `(() => { const b = document.getElementById('bSound'); if (!b) return false;
        const r = b.getBoundingClientRect();
        return document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2)?.closest('#bSound') !== null; })()`,
      { timeout: 6000, label: '幕が引き、操作パネルに手が届く' },
    );
    await t.shot('開園');

    // ♪ を押す → ドローンが立ち上がる
    const amb = await t.listen.record('環境音(ドローン + 風鈴)', async () => {
      await t.human.click('#bSound');
      await t.page.settle(5000); // 立ち上がりランプ 0.8s + 揺らぎを聴く
    });
    if (t.expect(amb !== null, '♪ で音の機構が起動する(AudioContext を捕捉)') && amb) {
      t.expect(amb.rmsDb > -60, `環境音が鳴っている(RMS ${amb.rmsDb.toFixed(1)} dBFS)`);
      t.expect(amb.clipRatio < 0.001, `音が割れていない(クリッピング ${(amb.clipRatio * 100).toFixed(2)}%)`);
      // 官能(協和)の機械化: 卓越音がすべて五音音階(いずれかの移調)に収まる
      t.expect(
        amb.pentaRoot !== null,
        `鳴っている音はペンタトニックに収まり協和する(root ${amb.pentaRoot ?? '判定不能'} / 主な音 ${amb.peaks.slice(0, 4).map((p) => p.name).join(' ')})`,
      );
    }

    // 触れると流れ(見た目の官能検品用の証跡。庭は常時動くので差分 assert はしない)
    const { width: w, height: h } = t.page.size;
    await t.human.drag(w * 0.25, h * 0.35, w * 0.75, h * 0.6, { steps: 20 });
    await t.page.settle(600);
    await t.shot('触れたあとの流れ');

    // もう一度 ♪ → 本当に静まるか(gain ランプ 0.8s を待つ)
    await t.human.click('#bSound');
    await t.page.settle(1600);
    const off = await t.listen.record('消音後', 1500);
    if (off) {
      t.expect(
        !Number.isFinite(off.rmsDb) || off.rmsDb < -60,
        `♪ をもう一度押すと本当に静まる(RMS ${Number.isFinite(off.rmsDb) ? off.rmsDb.toFixed(1) : '-∞'} dBFS)`,
      );
    }
  },
};
