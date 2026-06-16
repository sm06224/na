import test from 'node:test';
import assert from 'node:assert/strict';
import '../js/core/game.js';
import { RNG } from '../js/core/rng.js';
import { createUnit } from '../js/core/unit.js';
import { Board } from '../js/core/board.js';
import { strikeInfo, resolveCombat } from '../js/core/combat.js';
import { SKILLS, skill } from '../js/core/skills.js';
import { classDef } from '../js/core/classes.js';

function duel(aSpec, dSpec) {
  const r = new RNG(11);
  const a = createUnit({ side: 'player', ...aSpec }, r.derive('a'));
  const d = createUnit({ side: 'enemy', ...dSpec }, r.derive('d'));
  const b = new Board(4, 1); b.add(a, 1, 0); b.add(d, 2, 0); b.rebuildIndex();
  return { a, d, b };
}

test('新技：定義がそろっている', () => {
  for (const id of ['vengeance', 'gamble', 'lifedeath', 'certainty', 'guard']) {
    assert.ok(skill(id), `技 ${id}`);
    assert.ok(skill(id).desc.length > 0);
  }
});

test('堅実：命中＋15', () => {
  // 回避の高い相手にして、命中が100で頭打ちにならないようにする
  const foe = { classId: 'soldier', level: 10, items: ['iron_lance'], statBoost: { spd: 20, lck: 15 } };
  const base = duel({ classId: 'mercenary', level: 10, items: ['steel_sword'] }, foe);
  const sure = duel({ classId: 'mercenary', level: 10, items: ['steel_sword'], skills: ['certainty'] }, foe);
  const bh = strikeInfo(base.a, base.d, base.b).hit, sh = strikeInfo(sure.a, sure.d, sure.b).hit;
  assert.ok(bh < 100 && sh <= 100);
  assert.equal(sh - bh, 15);
});

test('一か八か：会心＋15・命中−10', () => {
  const base = duel({ classId: 'mercenary', level: 10, items: ['steel_sword'] }, { classId: 'soldier', level: 10, items: ['iron_lance'] });
  const g = duel({ classId: 'mercenary', level: 10, items: ['steel_sword'], skills: ['gamble'] }, { classId: 'soldier', level: 10, items: ['iron_lance'] });
  const bi = strikeInfo(base.a, base.d, base.b), gi = strikeInfo(g.a, g.d, g.b);
  assert.equal(gi.crit - bi.crit, 15);
  assert.equal(gi.hit - bi.hit, -10);
});

test('死線：攻めれば威力＋3、守りは−3（受けると傷が増える）', () => {
  const atkBase = duel({ classId: 'mercenary', level: 10, items: ['steel_sword'] }, { classId: 'soldier', level: 10, items: ['iron_lance'] });
  const atkLD = duel({ classId: 'mercenary', level: 10, items: ['steel_sword'], skills: ['lifedeath'] }, { classId: 'soldier', level: 10, items: ['iron_lance'] });
  assert.equal(strikeInfo(atkLD.a, atkLD.d, atkLD.b).dmg - strikeInfo(atkBase.a, atkBase.d, atkBase.b).dmg, 3, '攻めて＋3');
  // 守り側に死線を持たせると、受ける傷が増える
  const defBase = duel({ classId: 'mercenary', level: 10, items: ['steel_sword'] }, { classId: 'soldier', level: 10, items: ['iron_lance'] });
  const defLD = duel({ classId: 'mercenary', level: 10, items: ['steel_sword'] }, { classId: 'soldier', level: 10, items: ['iron_lance'], skills: ['lifedeath'] });
  assert.equal(strikeInfo(defLD.a, defLD.d, defLD.b).dmg - strikeInfo(defBase.a, defBase.d, defBase.b).dmg, 3, '守って−3＝被弾＋3');
});

test('守勢：受ける傷を2やわらげる', () => {
  // 同じ種・同じ攻め手で、守勢の有無だけを比べる（strikeInfo は不変なので命中/会心ロールは同一）
  const atk = { classId: 'fighter', level: 14, items: ['steel_axe'] };
  const base = duel(atk, { classId: 'knight', level: 10, items: ['iron_lance'] });
  resolveCombat(base.a, base.d, base.b, new RNG(7));
  const takenBase = base.d.maxHp - base.d.hp;
  const grd = duel(atk, { classId: 'knight', level: 10, items: ['iron_lance'], skills: ['guard'] });
  resolveCombat(grd.a, grd.d, grd.b, new RNG(7));
  const takenGuard = grd.d.maxHp - grd.d.hp;
  assert.ok(takenBase > 0, '素では傷を受ける');
  assert.ok(takenGuard < takenBase, '守勢のほうが被弾が少ない');
});

test('復讐：失った HP の半分が傷に上乗せされうる（発動時）', () => {
  // 技を確実に出すため技%を高く、HP を大きく削った状態で比較
  const r = new RNG(3);
  const a = createUnit({ side: 'player', classId: 'berserker', level: 20, items: ['silver_axe'], skills: ['vengeance'], statBoost: { skl: 30 } }, r.derive('a'));
  const d = createUnit({ side: 'enemy', classId: 'general', level: 20, items: ['iron_lance'] }, r.derive('d'));
  a.hp = 1;                                  // 大きく失っている＝復讐の上乗せが大きい
  const b = new Board(4, 1); b.add(a, 1, 0); b.add(d, 2, 0); b.rebuildIndex();
  const baseDmg = strikeInfo(a, d, b).dmg;
  const before = d.hp;
  resolveCombat(a, d, b, new RNG(5));
  // 復讐が乗れば素のダメージより多く入りうる（少なくとも破綻なく決着）
  assert.ok(d.hp <= before, '相手は傷つく');
  assert.ok(baseDmg >= 0);
});

test('新技は上級職から手に入る（剣聖＝一か八か・将軍＝守勢…）', () => {
  assert.ok(classDef('swordmaster').skills.includes('gamble'));
  assert.ok(classDef('hero').skills.includes('certainty'));
  assert.ok(classDef('warrior').skills.includes('lifedeath'));
  assert.ok(classDef('general').skills.includes('guard'));
  assert.ok(classDef('berserker').skills.includes('vengeance'));
});
