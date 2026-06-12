import * as THREE from 'three';
import { buildHero } from './models';
import { makePowerLabel } from './labels';

/** 主角/指挥官：单模型，头顶蓝色战力数字，沿地面向目标移动。 */
export class Hero {
  readonly group = new THREE.Group();
  heading = Math.PI;
  private label: { obj: CSS2DLabel; set: (v: number) => void };
  private bob = 0;

  constructor(scene: THREE.Scene, x: number, z: number, power: number) {
    const model = buildHero();
    this.group.add(model);
    this.group.position.set(x, 0, z);

    this.label = makePowerLabel(power, 'ally');
    this.label.obj.position.set(0, 2.7, 0);
    this.group.add(this.label.obj);

    scene.add(this.group);
  }

  get position(): THREE.Vector3 {
    return this.group.position;
  }

  setPower(p: number): void {
    this.label.set(p);
  }

  /** 朝目标移动；返回是否已到达 stopDist 内。 */
  moveToward(target: THREE.Vector3, speed: number, dt: number, stopDist: number): boolean {
    const dx = target.x - this.group.position.x;
    const dz = target.z - this.group.position.z;
    const dist = Math.hypot(dx, dz);
    // 容差 + 吸附：避免浮点误差导致永远差一丝、卡在停靠点外不触发结算。
    if (dist <= stopDist + 0.05) return true;
    const step = Math.min(dist - stopDist, speed * dt);
    this.group.position.x += (dx / dist) * step;
    this.group.position.z += (dz / dist) * step;
    this.heading = Math.atan2(dx, dz);
    this.group.rotation.y = this.heading;
    return false;
  }

  idleAnim(time: number): void {
    this.bob = Math.sin(time * 2.5) * 0.05;
    this.group.children[0].position.y = this.bob;
  }
}

type CSS2DLabel = import('three/examples/jsm/renderers/CSS2DRenderer.js').CSS2DObject;
