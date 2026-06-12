import * as THREE from 'three';
import { buildSoldier } from './models';

interface Unit {
  group: THREE.Group;
  offset: THREE.Vector3;
  phase: number;
}

const PER_ROW = 6;

/**
 * 我方蓝色士兵小队：数量随战力增长（弹入新兵），阶级跨阈值时全军换模型，
 * 以楔形阵列平滑跟随主角。渲染用独立 low-poly Group（原型期；M17.5 可转 InstancedMesh）。
 */
export class Squad {
  private scene: THREE.Scene;
  private units: Unit[] = [];
  private tier = 0;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
  }

  get count(): number {
    return this.units.length;
  }

  get currentTier(): number {
    return this.tier;
  }

  setTier(tier: number): boolean {
    if (tier === this.tier) return false;
    this.tier = tier;
    for (const u of this.units) {
      const wasPos = u.group.position.clone();
      u.group.clear();
      const fresh = buildSoldier(this.tier, 'ally');
      while (fresh.children.length) u.group.add(fresh.children[0]);
      u.group.position.copy(wasPos);
      // 升阶脉冲
      u.group.scale.setScalar(1.35);
    }
    return true;
  }

  /** 设定目标兵数；增兵时弹入。返回新增数量。 */
  setCount(n: number, anchor: THREE.Vector3): number {
    const target = Math.max(1, Math.round(n));
    let added = 0;
    while (this.units.length < target) {
      this.spawn(anchor);
      added++;
    }
    while (this.units.length > target) {
      const u = this.units.pop();
      u?.group.removeFromParent();
    }
    this.relayout();
    return added;
  }

  private spawn(anchor: THREE.Vector3): void {
    const g = buildSoldier(this.tier, 'ally');
    g.position.copy(anchor);
    g.scale.setScalar(0.01);
    this.scene.add(g);
    this.units.push({ group: g, offset: new THREE.Vector3(), phase: Math.random() * Math.PI * 2 });
  }

  private relayout(): void {
    const n = this.units.length;
    for (let i = 0; i < n; i++) {
      const row = Math.floor(i / PER_ROW);
      const inRow = Math.min(PER_ROW, n - row * PER_ROW);
      const col = i % PER_ROW;
      const x = (col - (inRow - 1) / 2) * 1.15;
      const z = 1.7 + row * 1.25;
      this.units[i].offset.set(x, 0, z);
    }
  }

  /** 每帧跟随主角（anchor=主角世界坐标，heading=主角朝向 y 弧度）。 */
  update(anchor: THREE.Vector3, heading: number, time: number): void {
    const cos = Math.cos(heading);
    const sin = Math.sin(heading);
    for (const u of this.units) {
      const ox = u.offset.x;
      const oz = u.offset.z;
      // 把局部阵型偏移按朝向旋转到世界
      const wx = anchor.x + ox * cos - oz * sin;
      const wz = anchor.z + ox * sin + oz * cos;
      const bob = Math.sin(time * 3 + u.phase) * 0.04;
      u.group.position.x += (wx - u.group.position.x) * 0.18;
      u.group.position.z += (wz - u.group.position.z) * 0.18;
      u.group.position.y = bob;
      u.group.rotation.y = heading;
      const s = u.group.scale.x;
      if (s < 1) u.group.scale.setScalar(Math.min(1, s + 0.08));
      else if (s > 1) u.group.scale.setScalar(Math.max(1, s - 0.04));
    }
  }
}
