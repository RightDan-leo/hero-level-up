import * as THREE from 'three';
import { CSS2DRenderer } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import { Hero } from './Hero';
import { Squad } from './Squad';
import { EnemyFormation } from './EnemyFormation';
import { Boss } from './Boss';
import { Chest } from './Chest';
import { Hud } from './Hud';
import { Sfx } from './sfx';
import { buildSoldier } from './models';
import { PathGraph } from './PathGraph';
import {
  CAMERA, COLORS, ARMY,
  MAP_WAYPOINTS, MAP_EDGES, MAP_DECOR, MAP_CHESTS, MAP_BOSS, MAP_HERO, WORLD,
  MAP_SCALE, toWorld,
  soldierCountForPower, tierForPower,
} from '../config/gameConfig';

type State = 'intro' | 'playing' | 'finale' | 'victory';

interface Pending {
  type: 'enemy' | 'boss' | 'chest';
  enemy?: EnemyFormation;
  chest?: Chest;
  edge?: number;
  cross?: string; // 击败挡路怪后跨越到的对侧节点
}

export class Game {
  private container: HTMLElement;
  private renderer: THREE.WebGLRenderer;
  private labelRenderer: CSS2DRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private clock = new THREE.Clock();
  private raycaster = new THREE.Raycaster();
  private dirLight!: THREE.DirectionalLight;

  private graph!: PathGraph;
  private hero!: Hero;
  private squad!: Squad;
  private enemies: EnemyFormation[] = [];
  private decor: EnemyFormation[] = [];
  private chests: Chest[] = [];
  private boss!: Boss;
  private hud: Hud;

  private roadMeshes = new Map<number, THREE.Mesh>();
  private groundPick!: THREE.Mesh;

  private heroNode = MAP_HERO.waypoint;
  private route: THREE.Vector3[] = [];
  private pending: Pending | null = null;
  private speed = MAP_HERO.speed * MAP_SCALE;

  private state: State = 'intro';
  private power = MAP_HERO.startPower;
  private camShake = 0;

  constructor(container: HTMLElement) {
    this.container = container;

    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.domElement.classList.add('game-canvas');
    container.appendChild(this.renderer.domElement);

    this.labelRenderer = new CSS2DRenderer();
    this.labelRenderer.domElement.className = 'css2d-layer';
    container.appendChild(this.labelRenderer.domElement);

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(COLORS.sky);
    this.scene.fog = new THREE.Fog(COLORS.sky, 48, 140);

    this.camera = new THREE.PerspectiveCamera(CAMERA.fov, 1, 0.1, 400);

    this.setupLights();
    this.setupGround();
    this.buildLevel();
    this.resize();

    this.hud = new Hud(container, () => window.location.reload());
    this.hud.setHint('👆 点击进军 · 沿路击溃红色编队并收编他们');
    this.refreshHud();

    window.addEventListener('resize', () => this.resize());
    this.renderer.domElement.addEventListener('pointerdown', (e) => this.onPointerDown(e));

    this.clock.start();
    this.renderer.setAnimationLoop(() => this.tick());
  }

  // ── 节点(图坐标) → 3D 世界坐标 ─────────────────────────────────────────────
  private nodeVec(id: string): THREE.Vector3 {
    const n = this.graph.node(id);
    const w = toWorld(n.x, n.y);
    return new THREE.Vector3(w.x, 0, w.z);
  }

  private setupLights(): void {
    this.scene.add(new THREE.HemisphereLight(0xbfd4ff, 0x3a4a2a, 0.9));
    const dir = new THREE.DirectionalLight(0xfff2d8, 1.05);
    dir.position.set(8, 24, 12);
    dir.castShadow = true;
    dir.shadow.mapSize.set(1024, 1024);
    const c = dir.shadow.camera as THREE.OrthographicCamera;
    c.left = -24; c.right = 24; c.top = 24; c.bottom = -24; c.near = 1; c.far = 80;
    this.scene.add(dir);
    this.scene.add(dir.target);
    this.dirLight = dir;
  }

  private setupGround(): void {
    const w = WORLD.width * MAP_SCALE + 24;
    const h = WORLD.height * MAP_SCALE + 24;
    const cz = -h / 2 + 8;
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(w, h),
      new THREE.MeshStandardMaterial({ color: COLORS.ground, roughness: 1 }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.z = cz;
    ground.receiveShadow = true;
    this.scene.add(ground);

    // 透明拾取面（点击空地导航）
    this.groundPick = new THREE.Mesh(
      new THREE.PlaneGeometry(w, h),
      new THREE.MeshBasicMaterial({ visible: false }),
    );
    this.groundPick.rotation.x = -Math.PI / 2;
    this.groundPick.position.set(0, 0.01, cz);
    this.groundPick.userData.ground = true;
    this.scene.add(this.groundPick);
  }

  private buildLevel(): void {
    this.graph = new PathGraph(
      MAP_WAYPOINTS,
      MAP_EDGES.map((e) => ({ a: e.a, b: e.b })),
    );

    // 路网（每条边一块地面带；挡路边渲染为锁定色）
    for (let i = 0; i < MAP_EDGES.length; i++) {
      const e = MAP_EDGES[i];
      const a = this.nodeVec(e.a);
      const b = this.nodeVec(e.b);
      const len = a.distanceTo(b);
      const road = new THREE.Mesh(
        new THREE.BoxGeometry(2.8, 0.06, len),
        new THREE.MeshStandardMaterial({ color: COLORS.groundPath, roughness: 1 }),
      );
      road.position.set((a.x + b.x) / 2, 0.03, (a.z + b.z) / 2);
      road.rotation.y = Math.atan2(b.x - a.x, b.z - a.z);
      road.receiveShadow = true;
      this.scene.add(road);
      this.roadMeshes.set(i, road);
    }

    // 节点圆盘
    const nodeMat = new THREE.MeshStandardMaterial({ color: 0xb6a778, roughness: 1 });
    for (const n of MAP_WAYPOINTS) {
      const w = toWorld(n.x, n.y);
      const disc = new THREE.Mesh(new THREE.CylinderGeometry(1.7, 1.7, 0.08, 16), nodeMat);
      disc.position.set(w.x, 0.04, w.z);
      disc.receiveShadow = true;
      this.scene.add(disc);
    }

    // 挡路怪/守卫编队（占据所在边，击败前锁定该边）
    for (let i = 0; i < MAP_EDGES.length; i++) {
      const e = MAP_EDGES[i];
      if (!e.blocker) continue;
      const a = this.graph.node(e.a);
      const b = this.graph.node(e.b);
      const at = e.blocker.at;
      const gx = a.x + (b.x - a.x) * at;
      const gy = a.y + (b.y - a.y) * at;
      const w = toWorld(gx, gy);
      const f = new EnemyFormation(this.scene, {
        id: `E${i}`, power: e.blocker.power, role: e.blocker.role, x: w.x, z: w.z, edge: i,
      });
      this.enemies.push(f);
      this.graph.setLocked(i, true);
      this.setRoadLocked(i, true);
    }

    // 装饰怪（通道之外，不可达、不可点击）
    for (let i = 0; i < MAP_DECOR.length; i++) {
      const d = MAP_DECOR[i];
      const w = toWorld(d.x, d.y);
      this.decor.push(new EnemyFormation(this.scene, {
        id: `D${i}`, power: d.power, role: 'optional', x: w.x, z: w.z, edge: -1, decor: true,
      }));
    }

    // 宝箱（死路尽头，被守卫把守 → 守卫清除后图上可达即可开启）
    for (let i = 0; i < MAP_CHESTS.length; i++) {
      const c = MAP_CHESTS[i];
      const w = toWorld(c.x, c.y);
      this.chests.push(new Chest(this.scene, `C${i}`, w.x, w.z, c.options));
    }

    // Boss
    const bw = toWorld(MAP_BOSS.x, MAP_BOSS.y);
    this.boss = new Boss(this.scene, bw.x, bw.z, MAP_BOSS.power);

    // 主角 + 初始小队
    const hw = toWorld(MAP_HERO.x, MAP_HERO.y);
    this.hero = new Hero(this.scene, hw.x, hw.z, this.power);
    this.squad = new Squad(this.scene);
    this.squad.setTier(tierForPower(this.power));
    this.squad.setCount(soldierCountForPower(this.power), this.hero.position);

    this.camera.position.set(hw.x + CAMERA.offset.x, CAMERA.offset.y, hw.z + CAMERA.offset.z);
    this.camera.lookAt(hw.x, 1.5, hw.z - CAMERA.lookAhead);
  }

  private setRoadLocked(edge: number, locked: boolean): void {
    const m = this.roadMeshes.get(edge);
    if (!m) return;
    (m.material as THREE.MeshStandardMaterial).color.setHex(locked ? 0x8a4a3a : COLORS.groundPath);
  }

  // ── 输入：把点击映射为图约束移动 / 交战 / 开箱 ─────────────────────────────
  private onPointerDown(e: PointerEvent): void {
    if (this.state === 'intro') {
      this.state = 'playing';
    }
    if (this.state !== 'playing') return;

    const rect = this.renderer.domElement.getBoundingClientRect();
    const ndc = new THREE.Vector2(
      ((e.clientX - rect.left) / rect.width) * 2 - 1,
      -((e.clientY - rect.top) / rect.height) * 2 + 1,
    );
    this.raycaster.setFromCamera(ndc, this.camera);

    const pickables: THREE.Object3D[] = [];
    for (const en of this.enemies) if (en.alive) pickables.push(en.hitObject);
    for (const c of this.chests) if (!c.opened) pickables.push(c.hitObject);
    if (this.boss.alive) pickables.push(this.boss.hitObject);
    pickables.push(this.groundPick);

    const hits = this.raycaster.intersectObjects(pickables, false);
    if (hits.length === 0) return;
    const obj = hits[0].object;

    if (obj.userData.enemyId) {
      const en = this.enemies.find((x) => x.id === obj.userData.enemyId && x.alive);
      if (en) this.issueEnemy(en);
    } else if (obj.userData.chestId) {
      const c = this.chests.find((x) => x.id === obj.userData.chestId && !x.opened);
      if (c) this.issueChest(c);
    } else if (obj.userData.bossHit) {
      this.issueBoss();
    } else if (obj.userData.ground) {
      this.navTo(hits[0].point);
    }
  }

  /** 把一串节点 id 转成世界路点（跳过当前所在节点）。 */
  private routeNodes(ids: string[]): THREE.Vector3[] {
    return ids.slice(1).map((id) => this.nodeVec(id));
  }

  private issueEnemy(en: EnemyFormation): void {
    const e = MAP_EDGES[en.edge];
    const pathA = this.graph.shortestNodes(this.heroNode, e.a);
    const pathB = this.graph.shortestNodes(this.heroNode, e.b);
    let approach: string | null = null;
    let cross = '';
    if (pathA.length && (!pathB.length || pathA.length <= pathB.length)) { approach = e.a; cross = e.b; }
    else if (pathB.length) { approach = e.b; cross = e.a; }
    if (!approach) { this.hud.banner('⚠ 需要先打通前方道路', 1100); return; }

    const pts = this.routeNodes(this.graph.shortestNodes(this.heroNode, approach));
    // 终点：从接近节点朝挡路怪走，停在编队前
    const an = this.nodeVec(approach);
    const dir = en.position.clone().sub(an); dir.y = 0;
    const stop = Math.min(3.0, dir.length() * 0.5);
    const approachPt = en.position.clone().sub(dir.normalize().multiplyScalar(stop));
    pts.push(approachPt);
    this.route = pts;
    this.heroNode = approach;
    this.pending = { type: 'enemy', enemy: en, edge: en.edge, cross };
  }

  private issueChest(c: Chest): void {
    const cNode = MAP_CHESTS[this.chests.indexOf(c)].waypoint;
    const path = this.graph.shortestNodes(this.heroNode, cNode);
    if (!path.length) { this.hud.banner('⚠ 守卫未清除，无法到达宝箱', 1200); return; }
    this.route = this.routeNodes(path);
    this.heroNode = cNode;
    this.pending = { type: 'chest', chest: c };
  }

  private issueBoss(): void {
    const path = this.graph.shortestNodes(this.heroNode, MAP_BOSS.waypoint);
    if (!path.length) { this.hud.banner('⚠ 通往 Boss 的道路尚未打通', 1200); return; }
    const pts = this.routeNodes(path);
    const last = this.nodeVec(MAP_BOSS.waypoint);
    const dir = this.boss.position.clone().sub(last); dir.y = 0;
    if (dir.length() > 0.1) pts[pts.length - 1] = this.boss.position.clone().sub(dir.normalize().multiplyScalar(5));
    this.route = pts;
    this.heroNode = MAP_BOSS.waypoint;
    this.pending = { type: 'boss' };
  }

  private reachableNode(id: string): boolean {
    return id === this.heroNode || this.graph.shortestNodes(this.heroNode, id).length > 0;
  }

  /** 该挡路怪所在边是否有一端可达（能走上去交战）。 */
  private engageReachable(en: EnemyFormation): boolean {
    const e = MAP_EDGES[en.edge];
    return this.reachableNode(e.a) || this.reachableNode(e.b);
  }

  private navTo(point: THREE.Vector3): void {
    // 候选①：最近的「可达空地节点」（横移/回溯，走开放通道）
    let bestNode = '';
    let bestNodeD = Infinity;
    for (const n of MAP_WAYPOINTS) {
      if (n.id === this.heroNode || !this.reachableNode(n.id)) continue;
      const w = toWorld(n.x, n.y);
      const d = Math.hypot(w.x - point.x, w.z - point.z);
      if (d < bestNodeD) { bestNodeD = d; bestNode = n.id; }
    }
    // 候选②：最近的「可推进挡路怪」（前方封路时，走上去破阵）
    let bestEn: EnemyFormation | null = null;
    let bestEnD = Infinity;
    for (const en of this.enemies) {
      if (!en.alive || !this.engageReachable(en)) continue;
      const d = Math.hypot(en.position.x - point.x, en.position.z - point.z);
      if (d < bestEnD) { bestEnD = d; bestEn = en; }
    }
    // 离点击点更近者优先：空地→移动；前方被怪挡→推进交战
    if (bestEn && bestEnD <= bestNodeD) { this.issueEnemy(bestEn); return; }
    if (bestNode) {
      this.route = this.routeNodes(this.graph.shortestNodes(this.heroNode, bestNode));
      this.heroNode = bestNode;
      this.pending = null;
      return;
    }
    if (bestEn) this.issueEnemy(bestEn);
  }

  private tick(): void {
    const dt = Math.min(0.05, this.clock.getDelta());
    const t = this.clock.elapsedTime;

    this.hero.idleAnim(t);
    if (this.route.length > 0) {
      const reached = this.hero.moveToward(this.route[0], this.speed, dt, 0.12);
      if (reached) {
        this.route.shift();
        if (this.route.length === 0 && this.pending) this.resolvePending();
      }
    }

    this.squad.update(this.hero.position, this.hero.heading, t);
    this.boss.spin(t);
    for (const c of this.chests) c.pulse(t);
    this.updateCamera(dt);

    this.labelRenderer.render(this.scene, this.camera);
    this.renderer.render(this.scene, this.camera);
  }

  private resolvePending(): void {
    const p = this.pending;
    this.pending = null;
    if (!p) return;
    if (p.type === 'enemy' && p.enemy) this.resolveEnemy(p.enemy, p.edge!, p.cross!);
    else if (p.type === 'boss') this.resolveBoss();
    else if (p.type === 'chest' && p.chest) this.openChest(p.chest);
  }

  private resolveEnemy(enemy: EnemyFormation, edge: number, cross: string): void {
    if (!enemy.alive) return;
    if (this.power < enemy.power) {
      Sfx.reject();
      this.hud.banner('⚠ 战力不足！<br><span style="font-size:16px">先壮大兵团再来</span>', 1300);
      // 退回接近节点
      this.route = [this.nodeVec(this.heroNode)];
      return;
    }
    Sfx.clash();
    this.camShake = 0.35;
    const positions = enemy.soldierWorldPositions();
    enemy.defeat();
    this.power += enemy.power;
    this.hero.setPower(this.power);
    const added = this.squad.setCount(soldierCountForPower(this.power), this.hero.position);
    if (added > 0) { Sfx.rally(); this.hud.banner(`收编! 士兵 x${this.squad.count}`, 1000); }
    const tierUp = this.squad.setTier(tierForPower(this.power));
    if (tierUp) { Sfx.evolve(); this.hud.banner(`⚔ 兵团进化 · ${ARMY.tierNames[this.squad.currentTier]} ⚔`, 1500); }

    // 解锁该边，跨越到对侧
    this.graph.setLocked(edge, false);
    this.setRoadLocked(edge, false);
    this.heroNode = cross;
    this.route.push(this.nodeVec(cross));

    this.refreshHud();
    this.updateProgressHint();
    this.absorb(positions);
  }

  private resolveBoss(): void {
    if (this.power < this.boss.power) {
      Sfx.reject();
      this.hud.banner('⚠ 兵力不足，无法撼动 Boss！', 1300);
      this.route = [this.nodeVec(this.heroNode)];
      return;
    }
    this.state = 'finale';
    Sfx.clash();
    this.camShake = 0.6;
    this.boss.defeat(() => this.playDragonFinale());
  }

  private openChest(chest: Chest): void {
    if (chest.opened) return;
    const opt = chest.bestOption();
    chest.open();
    Sfx.rally();
    this.power += opt.bonus;
    this.hero.setPower(this.power);
    this.squad.setCount(soldierCountForPower(this.power), this.hero.position);
    const tierUp = this.squad.setTier(tierForPower(this.power));
    if (tierUp) { Sfx.evolve(); this.hud.banner(`⚔ 兵团进化 · ${ARMY.tierNames[this.squad.currentTier]} ⚔`, 1400); }
    else this.hud.banner(`🎁 ${opt.label} · 战力 +${opt.bonus}`, 1400);
    this.refreshHud();
    this.updateProgressHint();
  }

  private absorb(positions: THREE.Vector3[]): void {
    if (positions.length === 0) return;
    const tier = this.squad.currentTier;
    for (let i = 0; i < positions.length; i++) {
      const p = positions[i];
      const proxy = buildSoldier(tier, 'enemy');
      proxy.position.copy(p);
      this.scene.add(proxy);
      const start = performance.now();
      const delay = i * 35;
      const dest = this.hero.position.clone();
      const tick = () => {
        const el = performance.now() - start - delay;
        if (el < 0) { requestAnimationFrame(tick); return; }
        const tt = Math.min(1, el / 480);
        proxy.position.x = THREE.MathUtils.lerp(p.x, dest.x, tt);
        proxy.position.z = THREE.MathUtils.lerp(p.z, dest.z, tt);
        proxy.position.y = Math.sin(tt * Math.PI) * 2.2;
        proxy.scale.setScalar(1 - tt * 0.5);
        if (tt < 1) requestAnimationFrame(tick);
        else { proxy.removeFromParent(); Sfx.absorb(); }
      };
      tick();
    }
  }

  private playDragonFinale(): void {
    const dragon = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({ color: 0xff7a1f, emissive: 0xb83000, emissiveIntensity: 0.8, roughness: 0.5 });
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.9, 3.2, 6, 12), mat);
    body.rotation.z = Math.PI / 2;
    dragon.add(body);
    const head = new THREE.Mesh(new THREE.ConeGeometry(0.9, 1.8, 8), mat);
    head.position.set(2.4, 0, 0);
    head.rotation.z = -Math.PI / 2;
    dragon.add(head);
    for (const s of [-1, 1]) {
      const wing = new THREE.Mesh(
        new THREE.PlaneGeometry(3.2, 2),
        new THREE.MeshStandardMaterial({ color: 0xff9a3f, emissive: 0x802000, side: THREE.DoubleSide, transparent: true, opacity: 0.92 }),
      );
      wing.position.set(0, 0, s * 1.6);
      wing.rotation.x = s * 0.5;
      dragon.add(wing);
    }
    dragon.position.copy(this.boss.position).setY(2);
    dragon.scale.setScalar(0.1);
    this.scene.add(dragon);

    Sfx.dragon();
    this.flashScreen();
    this.hud.banner('🐉 巨龙之力 · 觉醒！<br><span style="font-size:15px">本关无法使用 · 下载游戏即可释放</span>', 2600);

    const start = performance.now();
    const anim = () => {
      const tt = Math.min(1, (performance.now() - start) / 1800);
      dragon.scale.setScalar(0.1 + tt * 2.2);
      dragon.position.y = 2 + tt * 7;
      dragon.rotation.y = tt * Math.PI * 0.6;
      if (tt < 1) requestAnimationFrame(anim);
      else {
        this.state = 'victory';
        Sfx.victory();
        this.hud.showCTA(this.power, this.squad.count);
      }
    };
    anim();
  }

  private flashScreen(): void {
    const f = document.createElement('div');
    f.style.cssText = 'position:absolute;inset:0;background:#fff;opacity:0.85;pointer-events:none;z-index:20;transition:opacity 0.6s;';
    this.container.appendChild(f);
    requestAnimationFrame(() => { f.style.opacity = '0'; });
    setTimeout(() => f.remove(), 700);
  }

  private updateProgressHint(): void {
    const reachableBoss = this.graph.shortestNodes(this.heroNode, MAP_BOSS.waypoint).length > 0;
    if (reachableBoss && this.boss.alive) this.hud.setHint('道路已通！点击 Boss 发起总攻 ⚔');
    else this.hud.setHint('点击红色编队击溃并收编 · 战力越高士兵越多');
  }

  private updateCamera(dt: number): void {
    const tx = this.hero.position.x + CAMERA.offset.x;
    const ty = CAMERA.offset.y;
    const tz = this.hero.position.z + CAMERA.offset.z;
    const lerp = 1 - Math.pow(1 - CAMERA.lerp, dt * 60);
    this.camera.position.x += (tx - this.camera.position.x) * lerp;
    this.camera.position.y += (ty - this.camera.position.y) * lerp;
    this.camera.position.z += (tz - this.camera.position.z) * lerp;

    if (this.camShake > 0) {
      this.camera.position.x += (Math.random() - 0.5) * this.camShake;
      this.camera.position.y += (Math.random() - 0.5) * this.camShake;
      this.camShake = Math.max(0, this.camShake - dt * 1.5);
    }
    this.camera.lookAt(this.hero.position.x, 1.5, this.hero.position.z - CAMERA.lookAhead);

    this.dirLight.position.set(this.hero.position.x + 8, 24, this.hero.position.z + 12);
    this.dirLight.target.position.set(this.hero.position.x, 0, this.hero.position.z - 4);
  }

  private refreshHud(): void {
    this.hud.setPower(this.power, this.squad.count, this.squad.currentTier);
  }

  private resize(): void {
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;
    this.renderer.setSize(w, h);
    this.labelRenderer.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  // ── 开发/测试钩子（CDP 验证用，绕过移动/光线拾取做确定性结算）──────────────
  /** 按 id 直接结算一支编队（验证图可达 + 解锁 + 跨边 + 成长）。 */
  devAttack(id: string): string {
    const en = this.enemies.find((e) => e.id === id && e.alive);
    if (!en) return 'no-enemy';
    const e = MAP_EDGES[en.edge];
    const pa = this.graph.shortestNodes(this.heroNode, e.a);
    const pb = this.graph.shortestNodes(this.heroNode, e.b);
    let approach: string | null = null;
    let cross = '';
    if (pa.length && (!pb.length || pa.length <= pb.length)) { approach = e.a; cross = e.b; }
    else if (pb.length) { approach = e.b; cross = e.a; }
    if (!approach) return 'unreachable';
    this.heroNode = approach;
    this.resolveEnemy(en, en.edge, cross);
    return JSON.stringify(this.debug);
  }

  devChest(id: string): string {
    const c = this.chests.find((x) => x.id === id && !x.opened);
    if (!c) return 'no-chest';
    const cNode = MAP_CHESTS[this.chests.indexOf(c)].waypoint;
    if (!this.graph.shortestNodes(this.heroNode, cNode).length) return 'unreachable';
    this.openChest(c);
    return JSON.stringify(this.debug);
  }

  devBoss(): string {
    if (!this.graph.shortestNodes(this.heroNode, MAP_BOSS.waypoint).length) return 'unreachable';
    this.resolveBoss();
    return JSON.stringify(this.debug);
  }

  get debug() {
    return {
      power: this.power,
      soldiers: this.squad.count,
      tier: this.squad.currentTier,
      heroNode: this.heroNode,
      state: this.state,
      enemiesAlive: this.enemies.filter((e) => e.alive).length,
      lockedEdges: MAP_EDGES.map((_, i) => i).filter((i) => this.graph.isLocked(i)),
      bossAlive: this.boss.alive,
      chestsOpened: this.chests.filter((c) => c.opened).length,
    };
  }
}
