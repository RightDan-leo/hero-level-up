// 一次性校验：3D 版读取的共享地图 level.map.json 在「图约束 + 大吃小成长」下可通关。
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = path.dirname(fileURLToPath(import.meta.url));
const map = JSON.parse(fs.readFileSync(path.resolve(dir, '../src/config/level.map.json'), 'utf-8'));
const army = JSON.parse(fs.readFileSync(path.resolve(dir, '../src/config/data/army.json'), 'utf-8'));

const soldierCount = (p) => {
  let c = 1;
  for (const [pw, n] of army.countCurve) if (p >= pw) c = n;
  return Math.min(army.maxSoldiers, c);
};
const tier = (p) => {
  let t = 0;
  for (let i = 0; i < army.tierThresholds.length; i++) if (p >= army.tierThresholds[i]) t = i;
  return t;
};

const edges = map.edges;
const locked = edges.map((e) => !!e.blocker);
const startNode = map.hero.startWaypoint;

function reachable() {
  const seen = new Set([startNode]);
  const stack = [startNode];
  while (stack.length) {
    const u = stack.pop();
    edges.forEach((e, i) => {
      if (locked[i]) return;
      let v = null;
      if (e.a === u) v = e.b; else if (e.b === u) v = e.a;
      if (v && !seen.has(v)) { seen.add(v); stack.push(v); }
    });
  }
  return seen;
}

let power = map.hero.startPower;
const log = [];
let progress = true;
while (progress) {
  progress = false;
  const seen = reachable();
  edges.forEach((e, i) => {
    if (!locked[i]) return;
    const eng = seen.has(e.a) || seen.has(e.b);
    if (eng && power >= e.blocker.power) {
      power += e.blocker.power;
      locked[i] = false;
      progress = true;
      log.push(`击溃 ${e.a}-${e.b} (${e.blocker.role} p=${e.blocker.power}) → 战力 ${power}, 士兵 x${soldierCount(power)}, 阶 ${army.tierNames[tier(power)]}`);
    }
  });
}

// 宝箱（守卫已清除 → 节点可达即开箱，取较高奖励）
const seenFinal = reachable();
for (const c of map.chests) {
  if (seenFinal.has(c.waypoint)) {
    const best = c.options.reduce((a, b) => (b.bonus > a.bonus ? b : a));
    power += best.bonus;
    log.push(`开箱 @${c.waypoint}: ${best.label} +${best.bonus} → 战力 ${power}`);
  }
}

const bossReachable = seenFinal.has(map.boss.waypoint);
const bossBeatable = power >= map.boss.power;

console.log(log.join('\n'));
console.log('\n── 结算 ──');
console.log('节点数', map.waypoints.length, '边数', edges.length, '挡路怪', edges.filter((e) => e.blocker).length, '装饰怪', map.decor.length, '宝箱', map.chests.length);
console.log('未打通的边(应仅剩封死守卫):', edges.map((e, i) => [e, i]).filter(([, i]) => locked[i]).map(([e]) => `${e.a}-${e.b}(${e.blocker.power})`).join(', ') || '无');
console.log('最终战力', power, '士兵 x' + soldierCount(power), '兵种', army.tierNames[tier(power)]);
console.log('Boss 可达', bossReachable, '| 战力≥Boss(' + map.boss.power + ')', bossBeatable);
console.log(bossReachable && bossBeatable ? '\n✅ 地图可通关' : '\n❌ 不可通关');
