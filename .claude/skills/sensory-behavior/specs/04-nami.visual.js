// 波(触れる水面)— 触れると水は応えるか
//
// 見どころ:
//   - canvas 作品の検証: DOM の観測点が無いので、画素の変化「量」で語る
//   - 基準との比較: まず凪の自然な揺らぎを測り、波の変化がそれを
//     はっきり上回ることを要求する(常時アニメーションでも誤判定しない)
//   - 作品の仕様を読んだ計測: この水面は放っておくと雨が降る(凪の基準が
//     濡れる)が、指を置いている間は降らない。だから指を置いたまま凪を測り、
//     長押しした指を離して大波を立てる —「長く押すほど、大きく深い波」

export default {
  name: '波 — 触れると水は応えるか',

  async run(t) {
    await t.goto('/works/nami/');

    // 幕を開ける
    await t.human.click('#bOpen');
    await t.page.waitFor(`!document.getElementById('bar').hidden`, { label: '水辺への入場' });

    // 幕(intro)は 1.5 秒かけて消え、その間は水に触れない(pointerdown を
    // 幕が吸い込む)。この事実は elementFromPoint の見張りが見つけた。
    // 人間と同じく「水面に手が届くようになるまで」待ってから触る。
    const { width: w, height: h } = t.page.size;
    await t.page.waitFor(
      `document.elementFromPoint(${w * 0.5}, ${h * 0.5})?.id === 'pond'`,
      { timeout: 6000, label: '幕が引き、水面に手が届く' },
    );
    t.note('幕が引ききるまで水面には触れない(1.5s フェード中は pointer が幕に吸われる)— 到達可能性の見張りが検出');
    await t.page.settle(300);

    // 指を置いたまま、凪の自然な揺らぎ(何もしなくても変わる量)を測る
    await t.human.moveTo(w * 0.5, h * 0.5);
    await t.human.buttonDown();
    await t.page.settle(150);
    const calm1 = await t.shot('凪(指を置いたまま)その一');
    await t.page.settle(500);
    const calm2 = await t.shot('凪(指を置いたまま)その二');
    const idle = await t.diff('凪のあいだの自然な揺らぎ', calm1, calm2, { threshold: 40 });

    // 長く押した指を、離す
    await t.page.settle(800);
    await t.human.buttonUp();
    await t.page.settle(500);
    const wave = await t.shot('離した指の下から生まれた大波');
    const wake = await t.diff('凪 → 大波', calm2, wave, { threshold: 40 });
    const floor = Math.max(idle.ratio * 5, 0.01);
    t.expect(
      wake.ratio > floor,
      `触れると波紋が生まれる(凪の揺らぎ ${(idle.ratio * 100).toFixed(3)}% ≪ 波 ${(wake.ratio * 100).toFixed(2)}%)`,
    );

    // なぞれば航跡
    await t.human.drag(w * 0.30, h * 0.42, w * 0.70, h * 0.60, { steps: 18 });
    await t.page.settle(200);
    await t.shot('なぞった航跡');

    // 聴覚: 触れると水音がするか(音の dead interaction 検出)
    const heard = await t.listen.record('触れた水音', async () => {
      await t.human.clickAt(w * 0.35, h * 0.5);
      await t.page.settle(1200);
    });
    if (t.expect(heard !== null, '音の機構が動いている(AudioContext を捕捉)') && heard) {
      t.expect(heard.rmsDb > -55, `触れると水音が鳴る(RMS ${heard.rmsDb.toFixed(1)} dBFS)`);
      t.expect(heard.clipRatio < 0.001, `音が割れていない(クリッピング ${(heard.clipRatio * 100).toFixed(2)}%)`);
    }

    // 「音を消す」は本当に消すのか(dead mute 検出)。残響の尾を待ってから測る
    await t.human.click('#bMute');
    await t.page.settle(1200);
    const mutedSound = await t.listen.record('消音後に触れた音', async () => {
      await t.human.clickAt(w * 0.62, h * 0.5);
      await t.page.settle(1200);
    });
    if (mutedSound) {
      t.expect(
        !Number.isFinite(mutedSound.rmsDb) || mutedSound.rmsDb < -60,
        `「音を消す」で本当に消える(RMS ${Number.isFinite(mutedSound.rmsDb) ? mutedSound.rmsDb.toFixed(1) : '-∞'} dBFS)`,
      );
    }

    // 「凪にする」— ラベルどおり水面がしずまるか(画面が嘘をつかない)。
    // 聴覚検分の間に波は自然減衰しきっている(平らな水面を reset しても
    // 画面は変わらない)し、小波は 1 秒で閾値未満に薄れる。
    // 長押しの大波を立て直してからボタンを試す
    await t.human.moveTo(w * 0.5, h * 0.45);
    await t.human.buttonDown();
    await t.page.settle(1100);
    await t.human.buttonUp();
    await t.page.settle(300);
    await t.act('「凪にする」で水面が変わる', { expect: 'change' }, async () => {
      await t.human.click('#bStill');
    });
    await t.page.settle(200);
    const stillA = await t.shot('凪の検分 その一');
    await t.page.settle(500);
    const stillB = await t.shot('凪の検分 その二');
    const calm = await t.diff('凪にした後の静けさ', stillA, stillB, { threshold: 40 });
    t.expect(
      calm.ratio < 0.01,
      `「凪にする」で水面は本当にしずまる(強い揺れ ${(calm.ratio * 100).toFixed(3)}%)`,
    );
  },
};
