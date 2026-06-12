import * as THREE from 'three';
import type { CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import { buildBoss } from './models';
import { makePowerLabel } from './labels';

/** 终极 Boss：唯一独立敌方模型，可被兵海击败（对齐 M11）。 */
export class Boss {
  readonly power: number;
  readonly position: THREE.Vector3;
  alive = true;

  private root = new THREE.Group();
  private model: THREE.Group;
  private hit: THREE.Mesh;
  private label: CSS2DObject;

  constructor(scene: THREE.Scene, x: number, z: number, power: number) {
    this.power = power;
    this.position = new THREE.Vector3(x, 0, z);
    this.root.position.copy(this.position);

    this.model = buildBoss();
    this.root.add(this.model);

    const label = makePowerLabel(power, 'enemy');
    label.obj.position.set(0, 5, 0);
    this.label = label.obj;
    this.root.add(label.obj);

    this.hit = new THREE.Mesh(
      new THREE.CylinderGeometry(2.4, 2.4, 5, 14),
      new THREE.MeshBasicMaterial({ visible: false }),
    );
    this.hit.position.y = 2.5;
    this.hit.userData.bossHit = true;
    this.root.add(this.hit);

    scene.add(this.root);
  }

  get hitObject(): THREE.Object3D {
    return this.hit;
  }

  /** 倒地演出。 */
  defeat(onDone?: () => void): void {
    this.alive = false;
    this.hit.userData.bossHit = false;
    this.label.removeFromParent();
    (this.label.element as HTMLElement).remove();
    const start = performance.now();
    const tick = () => {
      const t = Math.min(1, (performance.now() - start) / 900);
      this.model.rotation.x = -t * (Math.PI / 2) * 0.9;
      this.model.position.y = -t * 0.6;
      const shake = (1 - t) * 0.15;
      this.model.position.x = (Math.random() - 0.5) * shake;
      if (t < 1) requestAnimationFrame(tick);
      else onDone?.();
    };
    tick();
  }

  spin(time: number): void {
    if (this.alive) this.model.rotation.y = Math.sin(time * 0.6) * 0.25;
  }
}
