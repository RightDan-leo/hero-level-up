import * as THREE from 'three';
import { CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import type { RewardOption } from '../config/gameConfig';

/** 死路尽头的宝箱：被守卫怪把守（图上不可达），击败守卫解锁可达后点击开启 → 取较高奖励。 */
export class Chest {
  readonly id: string;
  readonly position: THREE.Vector3;
  readonly options: RewardOption[];
  opened = false;

  private root = new THREE.Group();
  private lid: THREE.Mesh;
  private hit: THREE.Mesh;
  private label: CSS2DObject;

  constructor(scene: THREE.Scene, id: string, x: number, z: number, options: RewardOption[]) {
    this.id = id;
    this.options = options;
    this.position = new THREE.Vector3(x, 0, z);
    this.root.position.copy(this.position);

    const woodDark = new THREE.MeshStandardMaterial({ color: 0x7a4a22, roughness: 0.8 });
    const gold = new THREE.MeshStandardMaterial({ color: 0xe8b53a, roughness: 0.4, metalness: 0.5, emissive: 0x4a3000, emissiveIntensity: 0.5 });

    const base = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.8, 1.0), woodDark);
    base.position.y = 0.4;
    base.castShadow = true;
    this.root.add(base);

    this.lid = new THREE.Mesh(new THREE.BoxGeometry(1.46, 0.5, 1.06), gold);
    this.lid.position.set(0, 0.95, 0);
    this.root.add(this.lid);

    for (const sx of [-0.62, 0.62]) {
      const band = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.3, 1.08), gold);
      band.position.set(sx, 0.55, 0);
      this.root.add(band);
    }

    this.hit = new THREE.Mesh(
      new THREE.CylinderGeometry(1.4, 1.4, 2.4, 12),
      new THREE.MeshBasicMaterial({ visible: false }),
    );
    this.hit.position.y = 1.2;
    this.hit.userData.chestId = id;
    this.root.add(this.hit);

    const el = document.createElement('div');
    el.className = 'power-label chest';
    el.textContent = '🎁';
    this.label = new CSS2DObject(el);
    this.label.position.set(0, 2.2, 0);
    this.root.add(this.label);

    scene.add(this.root);
  }

  get hitObject(): THREE.Object3D {
    return this.hit;
  }

  /** 取较高奖励的选项。 */
  bestOption(): RewardOption {
    return this.options.reduce((a, b) => (b.bonus > a.bonus ? b : a));
  }

  open(): void {
    this.opened = true;
    this.hit.userData.chestId = undefined;
    (this.label.element as HTMLElement).textContent = '✓';
    const start = performance.now();
    const tick = () => {
      const t = Math.min(1, (performance.now() - start) / 500);
      this.lid.rotation.x = -t * 1.2;
      this.lid.position.z = -t * 0.5;
      if (t < 1) requestAnimationFrame(tick);
    };
    tick();
  }

  pulse(time: number): void {
    if (this.opened) return;
    this.root.position.y = Math.sin(time * 2) * 0.08;
  }
}
