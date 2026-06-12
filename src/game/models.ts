import * as THREE from 'three';
import { COLORS } from '../config/gameConfig';

/**
 * 程序化低多边形角色（占位，M17.4 用 art-browser GLB 替换）。
 * 角色"模型种类"严格 ≤5：主角 ×1 + 士兵 3 阶 ×3（蓝/红双方共用，仅换材质）+ Boss ×1。
 */

const matCache = new Map<string, THREE.MeshStandardMaterial>();
function mat(color: number, key: string): THREE.MeshStandardMaterial {
  let m = matCache.get(key);
  if (!m) {
    m = new THREE.MeshStandardMaterial({ color, roughness: 0.7, metalness: 0.1 });
    matCache.set(key, m);
  }
  return m;
}

export type Team = 'ally' | 'enemy';

const TEAM_BODY: Record<Team, number> = { ally: COLORS.ally, enemy: COLORS.enemy };
const TEAM_DARK: Record<Team, number> = { ally: COLORS.allyDark, enemy: COLORS.enemyDark };

/** 士兵 3 阶：0=新兵 1=重装 2=精锐。返回一个可缩放/着色的 Group。 */
export function buildSoldier(tier: number, team: Team): THREE.Group {
  const g = new THREE.Group();
  const body = TEAM_BODY[team];
  const dark = TEAM_DARK[team];
  const t = Math.max(0, Math.min(2, tier));

  // 身体
  const bodyGeo = new THREE.CapsuleGeometry(0.26 + t * 0.03, 0.55 + t * 0.08, 4, 8);
  const bodyMesh = new THREE.Mesh(bodyGeo, mat(body, `${team}-body-${t}`));
  bodyMesh.position.y = 0.6;
  bodyMesh.castShadow = true;
  g.add(bodyMesh);

  // 头
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.2, 10, 8), mat(0xf0c9a0, 'skin'));
  head.position.y = 1.18 + t * 0.05;
  head.castShadow = true;
  g.add(head);

  // 头盔（阶级越高越明显）
  const helmet = new THREE.Mesh(
    new THREE.SphereGeometry(0.22, 10, 8, 0, Math.PI * 2, 0, Math.PI * 0.6),
    mat(dark, `${team}-helm-${t}`),
  );
  helmet.position.y = 1.27 + t * 0.05;
  g.add(helmet);

  // 武器：长矛
  const spear = new THREE.Mesh(
    new THREE.CylinderGeometry(0.03, 0.03, 1.4, 6),
    mat(0x8a6a3a, 'spear'),
  );
  spear.position.set(0.34, 0.9, 0);
  spear.rotation.z = 0.18;
  g.add(spear);

  // 重装/精锐：加肩甲
  if (t >= 1) {
    const pads = new THREE.Mesh(
      new THREE.BoxGeometry(0.72, 0.16, 0.46),
      mat(dark, `${team}-pad-${t}`),
    );
    pads.position.y = 0.92;
    g.add(pads);
  }
  // 精锐：盾 + 头羽
  if (t >= 2) {
    const shield = new THREE.Mesh(
      new THREE.CylinderGeometry(0.3, 0.3, 0.06, 12),
      mat(COLORS.heroAccent, `${team}-shield`),
    );
    shield.rotation.x = Math.PI / 2;
    shield.rotation.z = Math.PI / 2;
    shield.position.set(-0.38, 0.75, 0.05);
    g.add(shield);
    const plume = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.3, 6), mat(0xffe27a, 'plume'));
    plume.position.y = 1.55;
    g.add(plume);
  }

  return g;
}

/** 主角/指挥官（醒目、带披风与战旗）。单模型，永不换模型。 */
export function buildHero(): THREE.Group {
  const g = new THREE.Group();

  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.38, 0.8, 5, 10), mat(COLORS.hero, 'hero-body'));
  body.position.y = 0.9;
  body.castShadow = true;
  g.add(body);

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.26, 12, 10), mat(0xf0c9a0, 'skin'));
  head.position.y = 1.65;
  head.castShadow = true;
  g.add(head);

  const helm = new THREE.Mesh(
    new THREE.SphereGeometry(0.3, 12, 10, 0, Math.PI * 2, 0, Math.PI * 0.62),
    mat(COLORS.heroAccent, 'hero-helm'),
  );
  helm.position.y = 1.78;
  g.add(helm);

  // 披风
  const cape = new THREE.Mesh(
    new THREE.PlaneGeometry(0.8, 1.1),
    new THREE.MeshStandardMaterial({ color: 0xc23a2e, side: THREE.DoubleSide, roughness: 0.8 }),
  );
  cape.position.set(0, 1.0, -0.32);
  cape.rotation.x = 0.18;
  g.add(cape);

  // 战旗
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 2.4, 6), mat(0x6a4a2a, 'pole'));
  pole.position.set(0.5, 1.2, -0.1);
  g.add(pole);
  const flag = new THREE.Mesh(
    new THREE.PlaneGeometry(0.7, 0.45),
    new THREE.MeshStandardMaterial({ color: COLORS.heroAccent, side: THREE.DoubleSide, roughness: 0.6 }),
  );
  flag.position.set(0.86, 2.1, -0.1);
  g.add(flag);

  g.scale.setScalar(1.15);
  return g;
}

/** Boss：体型巨大、犄角、威慑造型（唯一独立敌方模型）。 */
export function buildBoss(): THREE.Group {
  const g = new THREE.Group();

  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.95, 1.6, 6, 12), mat(COLORS.boss, 'boss-body'));
  body.position.y = 1.9;
  body.castShadow = true;
  g.add(body);

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.6, 14, 12), mat(0x7a2a36, 'boss-head'));
  head.position.y = 3.4;
  head.castShadow = true;
  g.add(head);

  // 犄角
  for (const sx of [-1, 1]) {
    const horn = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.8, 8), mat(0xe8d8b0, 'boss-horn'));
    horn.position.set(0.32 * sx, 3.9, 0);
    horn.rotation.z = sx * -0.5;
    g.add(horn);
  }

  // 肩甲
  for (const sx of [-1, 1]) {
    const pad = new THREE.Mesh(new THREE.SphereGeometry(0.5, 10, 8), mat(0x4a1820, 'boss-pad'));
    pad.position.set(1.05 * sx, 2.5, 0);
    pad.scale.set(1, 0.7, 1);
    g.add(pad);
  }

  // 巨斧
  const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 3.2, 6), mat(0x3a2a1a, 'boss-handle'));
  handle.position.set(1.5, 2.2, 0);
  handle.rotation.z = 0.25;
  g.add(handle);
  const blade = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.0, 0.7), mat(0xbfc6cc, 'boss-blade'));
  blade.position.set(1.95, 3.4, 0);
  g.add(blade);

  return g;
}
