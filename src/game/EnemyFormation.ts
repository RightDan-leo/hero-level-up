import * as THREE from 'three';
import type { CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import { buildSoldier } from './models';
import { makePowerLabel } from './labels';
import { enemySoldierCount, tierForPower, type EnemyRole } from '../config/gameConfig';

export interface FormationOpts {
  id: string;
  power: number;
  role: EnemyRole;
  /** 3D 地面坐标。 */
  x: number;
  z: number;
  /** 关联的边索引（挡路怪/守卫所在边；装饰怪为 -1）。 */
  edge: number;
  /** 装饰怪：仅渲染、不可点击、不可达。 */
  decor?: boolean;
}

/** 一支红方编队：挡路怪 / 守卫 / 装饰，数量与阶级随战力派生，复用士兵模型换红材质。 */
export class EnemyFormation {
  readonly id: string;
  readonly power: number;
  readonly role: EnemyRole;
  readonly edge: number;
  readonly decor: boolean;
  readonly position: THREE.Vector3;
  alive = true;

  private root = new THREE.Group();
  private soldiers: THREE.Group[] = [];
  private hit: THREE.Mesh;
  private label: CSS2DObject;

  constructor(scene: THREE.Scene, opts: FormationOpts) {
    this.id = opts.id;
    this.power = opts.power;
    this.role = opts.role;
    this.edge = opts.edge;
    this.decor = !!opts.decor;
    this.position = new THREE.Vector3(opts.x, 0, opts.z);
    this.root.position.copy(this.position);

    const count = enemySoldierCount(opts.power);
    const tier = tierForPower(opts.power);
    const perRow = 4;
    for (let i = 0; i < count; i++) {
      const row = Math.floor(i / perRow);
      const inRow = Math.min(perRow, count - row * perRow);
      const col = i % perRow;
      const s = buildSoldier(tier, 'enemy');
      s.position.set((col - (inRow - 1) / 2) * 0.95, 0, row * 0.95);
      this.soldiers.push(s);
      this.root.add(s);
    }
    if (this.decor) this.root.scale.setScalar(0.92);

    const label = makePowerLabel(opts.power, 'enemy');
    label.obj.position.set(0, 2.3, 0);
    this.label = label.obj;
    this.root.add(label.obj);

    const r = Math.max(1.3, Math.min(3, 1 + count * 0.14));
    this.hit = new THREE.Mesh(
      new THREE.CylinderGeometry(r, r, 3, 12),
      new THREE.MeshBasicMaterial({ visible: false }),
    );
    this.hit.position.y = 1.5;
    this.hit.userData.enemyId = this.id;
    this.root.add(this.hit);

    scene.add(this.root);
  }

  get hitObject(): THREE.Object3D {
    return this.hit;
  }

  soldierWorldPositions(): THREE.Vector3[] {
    return this.soldiers.map((s) => s.getWorldPosition(new THREE.Vector3()));
  }

  defeat(onDone?: () => void): void {
    this.alive = false;
    this.hit.userData.enemyId = undefined;
    // 立即移除头顶战力标签的 DOM（CSS2DRenderer 不会随物体移除而自动清理）
    this.label.removeFromParent();
    (this.label.element as HTMLElement).remove();
    let pending = this.soldiers.length || 1;
    const finish = () => { if (--pending <= 0) { this.root.removeFromParent(); onDone?.(); } };
    if (this.soldiers.length === 0) finish();
    for (const s of this.soldiers) {
      const dir = new THREE.Vector3(s.position.x, 0, s.position.z).normalize().multiplyScalar(1.5);
      const start = performance.now();
      const fromY = s.position.y;
      const tick = () => {
        const t = Math.min(1, (performance.now() - start) / 360);
        s.position.x += dir.x * 0.04;
        s.position.z += dir.z * 0.04;
        s.position.y = fromY - t * 1.2;
        s.scale.setScalar(Math.max(0.01, 1 - t));
        if (t < 1) requestAnimationFrame(tick);
        else finish();
      };
      tick();
    }
  }
}
