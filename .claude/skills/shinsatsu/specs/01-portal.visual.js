// 玄関(ルートの作品一覧)— 扉は人間の手で開くか
//
// 見どころ:
//   - dead scroll 検出: ホイールを回して、ページが「実際に」動くこと
//   - 到達可能性: 目当ての札(カード)が最前面に見えていること(elementFromPoint)
//   - 実クリックで作品へ渡れること

export default {
  name: '玄関 — 作品集の扉は人間の手で開くか',

  async run(t) {
    await t.goto('/');
    await t.shot('着地直後');

    // ホイールで下りていく。scrollY が動かなければ dead scroll。
    const y0 = await t.page.eval('scrollY');
    await t.human.wheel(1400, { x: 640, y: 450 });
    await t.page.settle(200);
    const y1 = await t.page.eval('scrollY');
    t.expect(y1 > y0 + 200, `ホイールでページが実際に動く(scrollY ${y0} → ${Math.round(y1)})`);

    // 「反」の札まで手で探しにいき、見えているのを確かめてから押す
    const probe = await t.human.bringIntoView('a.card.c-han');
    t.expect(probe.ok, `「反」の札が最前面に見えている${probe.ok ? '' : ' — ' + probe.reason}`);
    await t.shot('札が見えた');

    await t.human.click('a.card.c-han');
    await t.page.waitFor(`location.pathname.endsWith('/works/han/')`, { timeout: 10000, label: '反への遷移' });
    await t.page.settle(300);
    t.pass(`札を押すと作品へ渡れる(${await t.page.eval('location.pathname')})`);
    await t.shot('渡った先');
  },
};
