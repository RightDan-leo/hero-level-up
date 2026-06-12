import Phaser from 'phaser';
import { GAME_CONSTANTS } from '../config/game.config';
import { GAME_VIEW } from '../config/view';
import { M1_LEVEL, CTA, WAYPOINTS, GRAPH_EDGES } from '../config/level.config';
import { Hero } from '../entities/Hero';
import { Enemy, escortCountForPower } from '../entities/Enemy';
import { Pickup } from '../entities/Pickup';
import { Chest } from '../entities/Chest';
import { Boss } from '../entities/Boss';
import { Companion } from '../entities/Companion';
import { Pet } from '../entities/Pet';
import { ArmySquad, soldierCountForPower } from '../entities/ArmySquad';
import { VARIANTS, DEFAULT_VARIANT, type VariantId, type VariantSpec } from '../config/variants';
import { formIndexForPower } from '../config/forms.config';
import { EquipGateOverlay } from '../systems/EquipGateOverlay';
import { PathGraph } from '../systems/PathGraph';
import { playDragonUltimate } from '../systems/DragonUltimate';
import { floatingText, clickMarker } from '../utils/feedback';
import { Sfx } from '../utils/sfx';
import type { GameState } from '../types';

const TOUCH_PAD = 6;
const STOP_DISTANCE = 4;
const BLOCK_COOLDOWN = 600;
const ARRIVE_EASE = 70;

export class GameScene extends Phaser.Scene {
  private gameState: GameState = 'idle';
  private hero!: Hero;
  private enemies: Enemy[] = [];
  private decorEnemies: Enemy[] = [];
  private pickups: Pickup[] = [];
  private chests: Chest[] = [];
  /** 仅用于「一次性教学引导」：开局第一个野怪 + 第一个宝箱。其余不提示最优解。 */
  private firstEnemy: Enemy | null = null;
  private firstChest: Chest | null = null;
  private boss!: Boss;
  private companion!: Companion;
  /** 当前版本变体（经典/宠物/士兵）——三版共用地图，机制各自独立。 */
  private variant: VariantId = DEFAULT_VARIANT;
  private variantSpec: VariantSpec = VARIANTS[DEFAULT_VARIANT];
  /** 宠物版的进化宠物（其余版本为空）。 */
  private pet: Pet | null = null;
  /** 士兵版的主角随从小队（其余版本为空）。 */
  private squad: ArmySquad | null = null;
  /** 驯兽师版开局「获得宠物」演出进行中——期间宠物由演出 tween 接管，不走跟随。 */
  private petIntroActive = false;
  private wasd!: {
    W: Phaser.Input.Keyboard.Key;
    A: Phaser.Input.Keyboard.Key;
    S: Phaser.Input.Keyboard.Key;
    D: Phaser.Input.Keyboard.Key;
  };
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private powerText!: Phaser.GameObjects.Text;
  private guideArrow!: Phaser.GameObjects.Text;
  private soundBtn!: Phaser.GameObjects.Text;
  private backBtn!: Phaser.GameObjects.Text;
  private tutorialHint?: Phaser.GameObjects.Container;
  private dragonBtn!: Phaser.GameObjects.Container;
  private dragonBtnBg!: Phaser.GameObjects.Graphics;
  private dragonBtnLabel!: Phaser.GameObjects.Text;
  /** 最终 Boss 是否已被击败（之后触发龙技解锁演出 + CTA）。 */
  private bossDefeated = false;
  private blockCooldowns = new WeakMap<Enemy, number>();
  private bossNudgeAt = 0;
  private graph!: PathGraph;
  /** 英雄沿通道行走的折线路径（世界点序列），约束移动用。 */
  private heroRoute: Array<{ x: number; y: number }> = [];
  /** 模态弹窗（装备门/宝箱）打开时屏蔽通道点击移动。 */
  private modalOpen = false;
  /** 模态关闭瞬间的时间戳：用于吞掉"关窗同一次点击"误触发的移动。 */
  private modalClosedAt = 0;

  constructor() {
    super({ key: GAME_CONSTANTS.SCENES.GAME });
  }

  init(data: { variant?: VariantId }): void {
    this.variant = data?.variant ?? DEFAULT_VARIANT;
    this.variantSpec = VARIANTS[this.variant] ?? VARIANTS[DEFAULT_VARIANT];
  }

  create(): void {
    this.gameState = 'idle';
    this.enemies = [];
    this.decorEnemies = [];
    this.pickups = [];
    this.chests = [];
    this.pet = null;
    this.squad = null;
    this.petIntroActive = false;
    this.firstEnemy = null;
    this.firstChest = null;
    this.blockCooldowns = new WeakMap<Enemy, number>();
    this.bossDefeated = false;
    this.heroRoute = [];
    this.modalOpen = false;
    this.graph = new PathGraph(WAYPOINTS, GRAPH_EDGES);

    this.drawBackground();
    this.setupInput();
    this.spawnLevel();
    this.buildHud();
    this.setupCamera();
    // 驯兽师版：先播「获得宠物」演出，结束后再出开局教学
    if (this.variantSpec.petIntro && this.pet) {
      this.playPetIntro(() => this.showTutorial());
    } else {
      this.showTutorial();
    }
  }

  // ── 镜头：跟随英雄，限制在世界内（世界比屏更宽 → 横向也跟随，道路延伸出屏左右）──
  private setupCamera(): void {
    const cam = this.cameras.main;
    cam.setBounds(0, 0, M1_LEVEL.worldWidth, M1_LEVEL.worldHeight);
    cam.startFollow(this.hero, true, 0.12, 0.12);
    cam.setDeadzone(140, 170);
  }

  update(time: number, delta: number): void {
    if (!this.petIntroActive) this.pet?.follow(this.hero.x, this.hero.y);
    if (this.squad) {
      this.squad.setCount(soldierCountForPower(this.hero.power));
      this.squad.follow(this.hero.x, this.hero.y, this.hero.radius);
    }
    if (this.gameState !== 'playing') return;
    this.updateMovement(delta);
    this.resolveCombat();
    this.resolvePickups();
    this.resolveChests();
    this.resolveBoss();
    this.refreshThreats();
    this.updateGuide(time);
  }

  // ── 场景搭建：分段地表(不可行走) + 通道路网石道(唯一可行走) ──
  private drawBackground(): void {
    const W = M1_LEVEL.worldWidth;
    const H = M1_LEVEL.worldHeight;
    const cx = M1_LEVEL.boss.x; // 火山口/Boss 轴对齐世界中轴
    const g = this.add.graphics().setDepth(-10);

    // 分段地表色带（自底向上：草地→草甸→石原→火山口）——通道之外均不可行走
    const bands: Array<[number, number, number]> = [
      [1100, H, 0x3f6b32],
      [560, 1100, 0x5d6b34],
      [340, 560, 0x4d3c2b],
      [0, 340, 0x241a1a],
    ];
    for (const [y0, y1, color] of bands) {
      g.fillStyle(color, 1);
      g.fillRect(0, y0, W, y1 - y0);
    }

    // 火山口：熔岩洞穴 + 岩浆裂纹（Boss 所在的顶部）
    g.fillStyle(0x140a0a, 1);
    g.fillEllipse(cx, 280, 190, 190);
    g.lineStyle(5, 0xff6b1a, 0.85);
    g.lineBetween(cx, 150, cx - 55, 310);
    g.lineBetween(cx, 150, cx + 70, 300);

    // 装饰野怪所在角落的水塘/裂崖（视觉隔断，强调通道外不可达）
    g.fillStyle(0x2f6f9a, 0.85);
    for (const d of M1_LEVEL.decor) {
      g.fillEllipse(d.x, d.y, 140, 110);
    }

    // 通道路网：先画深色描边，再画石道填充，最后接缝纹理
    const lane = this.add.graphics().setDepth(-9);
    const edges = this.graph.edgeList;
    const LANE_W = 60;
    lane.lineStyle(LANE_W + 8, 0x7a6f52, 1);
    lane.beginPath();
    for (const e of edges) {
      const A = this.graph.node(e.a);
      const B = this.graph.node(e.b);
      lane.moveTo(A.x, A.y);
      lane.lineTo(B.x, B.y);
    }
    lane.strokePath();
    lane.lineStyle(LANE_W, 0xcabf9a, 1);
    lane.beginPath();
    for (const e of edges) {
      const A = this.graph.node(e.a);
      const B = this.graph.node(e.b);
      lane.moveTo(A.x, A.y);
      lane.lineTo(B.x, B.y);
    }
    lane.strokePath();

    // 节点处的圆形小广场（让岔路口/汇合点更清晰）
    lane.fillStyle(0xc2b78f, 1);
    for (const n of this.graph.nodeList) {
      if (n.id === 'boss') continue;
      lane.fillCircle(n.x, n.y, LANE_W / 2);
    }

    // 点缀植被/岩石（世界两侧边缘）
    g.fillStyle(0x294f22, 1);
    for (let i = 0; i < 18; i++) {
      const ty = 420 + i * 82;
      const side = i % 2 === 0 ? 22 : W - 22;
      g.fillCircle(side, ty, 12);
    }
  }

  private setupInput(): void {
    this.cursors = this.input.keyboard!.createCursorKeys();
    this.wasd = {
      W: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.W),
      A: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.A),
      S: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.S),
      D: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.D),
    };

    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      if (this.modalOpen) return; // 装备门/宝箱等模态弹窗期间屏蔽通道移动
      // 关窗同一次点击（部分设备 pointer+mouse 双发）不应顺势把英雄移走
      if (this.time.now - this.modalClosedAt < 220) return;
      if (this.isOverSoundButton(p)) return; // 喇叭按钮自行处理，不触发移动/开始
      if (this.isOverBackButton(p)) return; // 返回按钮自行处理，不触发移动/开始
      if (this.gameState === 'idle') this.startPlaying();
      if (this.gameState !== 'playing') return;
      // 点击已解锁的宝箱 → 开启（世界坐标判定）
      const chest = this.chestAt(p.worldX, p.worldY);
      if (chest) {
        this.openChest(chest);
        return;
      }
      this.routeHeroTo(p.worldX, p.worldY);
    });
  }

  /** 把点击点投影到通道，计算英雄沿通道前往的折线路径。 */
  private routeHeroTo(worldX: number, worldY: number): void {
    const from = this.graph.project(this.hero.x, this.hero.y);
    const to = this.graph.project(worldX, worldY);
    this.heroRoute = this.graph.route(from, to);
    clickMarker(this, to.x, to.y); // 标记落点在通道上的实际位置
  }

  private spawnLevel(): void {
    const { heroStart, heroStartPower, heroSpeed, enemies, decor, pickups, chests, boss, companion } = M1_LEVEL;
    this.hero = new Hero(this, heroStart.x, heroStart.y, heroStartPower, heroSpeed);
    this.hero.onEvolve = (name) => this.playEvolve(name);
    const withSoldiers = this.variantSpec.enemiesHaveSoldiers;
    for (const e of enemies) {
      const escort = withSoldiers ? escortCountForPower(e.power) : 0;
      this.enemies.push(new Enemy(this, e.x, e.y, e.power, e.texture, e.role ?? 'path', false, escort));
    }
    // 装饰野怪：不加入 this.enemies，仅渲染、不参与战斗/引导/清场
    for (const d of decor) {
      const escort = withSoldiers ? escortCountForPower(d.power) : 0;
      this.decorEnemies.push(new Enemy(this, d.x, d.y, d.power, d.texture, 'guard', true, escort));
    }
    for (const p of pickups) this.pickups.push(new Pickup(this, p.x, p.y, p.amount));
    // 宝箱：初始锁定（被守卫怪把守），击败对应守卫后解锁可开启
    for (const c of chests) this.chests.push(new Chest(this, c.x, c.y, c.guardPower));
    this.boss = new Boss(this, boss.x, boss.y, boss.power);
    this.companion = new Companion(this, companion.x, companion.y);

    // 宠物相关版本：
    //  · 宠物版 (petAvatar) → 主角本体即宠物（巨龙化身），隐藏人物精灵、龙居中。
    //  · 驯兽师版 (companion) → 主角仍是人物，宠物作伴随随从，二者同步进化。
    if (this.variantSpec.hasPet) {
      if (this.variantSpec.petAvatar) {
        this.hero.setBodyHidden(true);
        this.pet = new Pet(this, heroStart.x, heroStart.y, true);
      } else {
        this.pet = new Pet(this, heroStart.x - 42, heroStart.y + 8, false);
      }
      this.pet.setStage(this.hero.form);
    }
    // 士兵版：开局获得士兵小队，随战力增兵
    if (this.variantSpec.hasArmy) {
      this.squad = new ArmySquad(this, heroStart.x, heroStart.y);
      this.squad.setCount(soldierCountForPower(this.hero.power));
    }

    // 一次性教学引导目标：第一个野怪（战力最小的教学怪）+ 第一个宝箱
    this.firstEnemy = this.enemies.reduce<Enemy | null>(
      (best, e) => (best === null || e.power < best.power ? e : best),
      null,
    );
    this.firstChest = this.chests[0] ?? null;
  }

  /** 守卫怪被击败后，解锁对应（同战力）的宝箱。 */
  private unlockChestForGuard(power: number): void {
    for (const chest of this.chests) {
      if (!chest.ready && !chest.opened && chest.guardPower === power) chest.unlock();
    }
  }

  private buildHud(): void {
    const { WIDTH, HEIGHT } = GAME_VIEW;
    this.powerText = this.add
      .text(WIDTH / 2, 46, `战力 ${this.hero.power}`, {
        fontSize: '34px',
        color: '#ffffff',
        fontFamily: 'Arial Black, monospace',
        fontStyle: 'bold',
        stroke: '#08203a',
        strokeThickness: 6,
      })
      .setOrigin(0.5)
      .setDepth(900)
      .setScrollFactor(0);

    this.add
      .text(WIDTH / 2, 86, '点击移动 · 击败战力更低的敌人', {
        fontSize: '15px',
        color: '#e8f5e9',
        fontFamily: 'monospace',
      })
      .setOrigin(0.5)
      .setDepth(900)
      .setScrollFactor(0);

    // 引导箭头指向世界中的敌人，保持世界坐标（随镜头滚动）
    this.guideArrow = this.add
      .text(0, 0, '▼', {
        fontSize: '28px',
        color: '#ffe082',
        fontStyle: 'bold',
        stroke: '#5a4500',
        strokeThickness: 4,
      })
      .setOrigin(0.5)
      .setDepth(80)
      .setVisible(false);

    this.buildDragonButton(WIDTH / 2, HEIGHT - 70);
    this.buildSoundButton();
    this.buildBackButton();
  }

  /** 返回主界面按钮（三版共用，左上角）。 */
  private buildBackButton(): void {
    this.backBtn = this.add
      .text(14, 46, '↩ 返回', {
        fontSize: '19px',
        color: '#ffffff',
        backgroundColor: '#16213e',
        fontFamily: 'Arial Black, monospace',
        fontStyle: 'bold',
        padding: { x: 12, y: 7 },
      })
      .setOrigin(0, 0.5)
      .setDepth(2500)
      .setScrollFactor(0)
      .setInteractive({ useHandCursor: true });
    this.backBtn.on('pointerover', () => this.backBtn.setStyle({ backgroundColor: '#24345e' }));
    this.backBtn.on('pointerout', () => this.backBtn.setStyle({ backgroundColor: '#16213e' }));
    this.backBtn.on('pointerdown', () => this.returnToMenu());
  }

  private returnToMenu(): void {
    this.scene.start(GAME_CONSTANTS.SCENES.MAIN_MENU);
  }

  private isOverBackButton(p: Phaser.Input.Pointer): boolean {
    if (!this.backBtn) return false;
    return this.backBtn.getBounds().contains(p.x, p.y);
  }

  private buildSoundButton(): void {
    const { WIDTH } = GAME_VIEW;
    this.soundBtn = this.add
      .text(WIDTH - 16, 46, Sfx.isMuted() ? '🔇' : '🔊', { fontSize: '30px' })
      .setOrigin(1, 0.5)
      .setDepth(950)
      .setScrollFactor(0)
      .setInteractive({ useHandCursor: true });
    this.soundBtn.on('pointerdown', () => {
      const m = Sfx.toggleMuted();
      this.soundBtn.setText(m ? '🔇' : '🔊');
      if (!m) Sfx.absorb(1);
    });
  }

  private isOverSoundButton(p: Phaser.Input.Pointer): boolean {
    if (!this.soundBtn) return false;
    // 按钮固定屏幕(scrollFactor 0)，用屏幕坐标判定
    return this.soundBtn.getBounds().contains(p.x, p.y);
  }

  /**
   * 底部「巨龙之力」徽章：全程为锁定状态的目标提示（不可点击），
   * 击败最终 Boss 后由 unlockDragonSkill() 点亮，暗示"下载即可释放"。
   */
  private buildDragonButton(x: number, y: number): void {
    this.dragonBtn = this.add.container(x, y).setDepth(950).setScrollFactor(0);
    this.dragonBtnBg = this.add.graphics();
    this.dragonBtnLabel = this.add
      .text(0, 0, '🔒 巨龙之力 · 击败 Boss 解锁', {
        fontSize: '18px',
        color: '#cfcfcf',
        fontFamily: 'Arial Black, monospace',
        fontStyle: 'bold',
      })
      .setOrigin(0.5);
    this.dragonBtn.add([this.dragonBtnBg, this.dragonBtnLabel]);
    this.paintDragonButton(false);
  }

  private paintDragonButton(unlocked: boolean): void {
    const g = this.dragonBtnBg;
    g.clear();
    g.fillStyle(unlocked ? 0xe67e22 : 0x3a3a4a, unlocked ? 1 : 0.7);
    g.fillRoundedRect(-150, -30, 300, 60, 14);
    g.lineStyle(3, unlocked ? 0xffd54f : 0x555566, 1);
    g.strokeRoundedRect(-150, -30, 300, 60, 14);
    this.dragonBtnLabel.setText(unlocked ? '🐉 巨龙之力 · 已解锁！' : '🔒 巨龙之力 · 击败 Boss 解锁');
    this.dragonBtnLabel.setColor(unlocked ? '#ffffff' : '#cfcfcf');
  }

  // ── 开局手势教学 ──────────────────────────
  private showTutorial(): void {
    const { WIDTH, HEIGHT } = GAME_VIEW;
    const hand = this.add.text(0, 0, '👆', { fontSize: '44px' }).setOrigin(0.5);
    const tip = this.add
      .text(0, 56, '点击屏幕开始', {
        fontSize: '22px',
        color: '#ffffff',
        fontFamily: 'monospace',
        fontStyle: 'bold',
        stroke: '#000000',
        strokeThickness: 4,
      })
      .setOrigin(0.5);
    this.tutorialHint = this.add
      .container(WIDTH / 2, HEIGHT / 2 + 140, [hand, tip])
      .setDepth(1800)
      .setScrollFactor(0);
    this.tweens.add({
      targets: this.tutorialHint,
      scale: { from: 1, to: 1.12 },
      duration: 600,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.inOut',
    });
  }

  private startPlaying(): void {
    this.gameState = 'playing';
    this.tutorialHint?.destroy();
    this.tutorialHint = undefined;
  }

  // ── 驯兽师版开局演出：主角收服一只宠物伙伴（人宠并肩进化）──
  private playPetIntro(onDone: () => void): void {
    const pet = this.pet;
    if (!pet) {
      onDone();
      return;
    }
    this.petIntroActive = true;
    this.gameState = 'paused'; // 演出期间屏蔽点击移动/开始
    const { WIDTH, HEIGHT } = GAME_VIEW;
    const hx = this.hero.x;
    const hy = this.hero.y;

    // 宠物落位点（身侧后方）记录后，先把它移到主角上方高处、缩小淡入
    const destX = hx - 42;
    const destY = hy + 8;
    pet.setAlpha(0).setScale(0.2);
    pet.x = hx;
    pet.y = hy - 130;

    // 召唤闪光 + 金色光柱
    this.cameras.main.flash(240, 255, 248, 210);
    const beam = this.add.triangle(hx, hy, -42, 0, 42, 0, 0, -300, 0xffe082, 0.5).setDepth(150);
    this.tweens.add({
      targets: beam,
      alpha: { from: 0.5, to: 0 },
      scaleX: { from: 0.5, to: 1.3 },
      duration: 760,
      ease: 'Cubic.out',
      onComplete: () => beam.destroy(),
    });
    // 扩散光环
    for (let i = 0; i < 2; i++) {
      const ring = this.add.circle(hx, hy, 10, 0xffffff, 0).setStrokeStyle(5, 0xffd54f, 0.95).setDepth(151);
      this.tweens.add({
        targets: ring,
        scale: { from: 0.4, to: 3.2 },
        alpha: { from: 1, to: 0 },
        duration: 620,
        delay: i * 150,
        ease: 'Cubic.out',
        onComplete: () => ring.destroy(),
      });
    }

    // 宠物从光中飞入主角身侧
    this.tweens.add({
      targets: pet,
      x: destX,
      y: destY,
      alpha: 1,
      scale: 1,
      duration: 680,
      ease: 'Back.out',
      onStart: () => Sfx.evolve(),
      onComplete: () => pet.playEvolveFlourish(),
    });

    // 居中横幅
    const banner = this.add.container(WIDTH / 2, HEIGHT / 2 - 60).setDepth(1900).setScrollFactor(0);
    const t1 = this.add
      .text(0, -22, '🐾 收服宠物伙伴！', {
        fontSize: '30px',
        color: '#ffffff',
        fontFamily: 'Arial Black, monospace',
        fontStyle: 'bold',
        stroke: '#1b7a3d',
        strokeThickness: 6,
      })
      .setOrigin(0.5);
    const t2 = this.add
      .text(0, 22, '人宠并肩 · 越战越强', {
        fontSize: '20px',
        color: '#ffe082',
        fontFamily: 'Arial Black, monospace',
        fontStyle: 'bold',
        stroke: '#5a3d00',
        strokeThickness: 5,
      })
      .setOrigin(0.5);
    banner.add([t1, t2]);
    banner.setScale(0.4).setAlpha(0);
    this.tweens.add({
      targets: banner,
      scale: { from: 0.4, to: 1 },
      alpha: { from: 0, to: 1 },
      duration: 320,
      ease: 'Back.out',
    });
    this.tweens.add({
      targets: banner,
      y: banner.y - 50,
      alpha: 0,
      delay: 1100,
      duration: 460,
      ease: 'Cubic.in',
      onComplete: () => {
        banner.destroy();
        this.petIntroActive = false;
        this.gameState = 'idle';
        onDone();
      },
    });
  }

  // ── 移动：约束在通道路网上 ────────────────────
  private updateMovement(delta: number): void {
    const step = (this.hero.speed * delta) / 1000;
    const dir = this.getKeyboardDir();

    // 键盘：自由位移后吸附回最近通道点（不脱离通道）
    if (dir.x !== 0 || dir.y !== 0) {
      this.heroRoute = [];
      dir.normalize();
      this.moveHeroBy(dir.x * step, dir.y * step);
      this.snapHeroToGraph();
      return;
    }

    // 鼠标/触摸：沿计算好的通道折线逐段行走
    let budget = step;
    while (budget > 0 && this.heroRoute.length > 0) {
      const target = this.heroRoute[0];
      const dx = target.x - this.hero.x;
      const dy = target.y - this.hero.y;
      const dist = Math.hypot(dx, dy);
      if (dist <= STOP_DISTANCE) {
        this.heroRoute.shift();
        continue;
      }
      const lastLeg = this.heroRoute.length === 1;
      if (lastLeg && dist < ARRIVE_EASE) {
        // 末段缓停
        const move = Math.min(budget * Math.max(0.35, dist / ARRIVE_EASE), dist);
        this.moveHeroBy((dx / dist) * move, (dy / dist) * move);
        break;
      }
      const move = Math.min(budget, dist);
      this.moveHeroBy((dx / dist) * move, (dy / dist) * move);
      budget -= move;
    }
  }

  private getKeyboardDir(): Phaser.Math.Vector2 {
    const v = new Phaser.Math.Vector2(0, 0);
    if (this.cursors.left.isDown || this.wasd.A.isDown) v.x -= 1;
    if (this.cursors.right.isDown || this.wasd.D.isDown) v.x += 1;
    if (this.cursors.up.isDown || this.wasd.W.isDown) v.y -= 1;
    if (this.cursors.down.isDown || this.wasd.S.isDown) v.y += 1;
    return v;
  }

  private moveHeroBy(dx: number, dy: number): void {
    const r = this.hero.radius;
    this.hero.x = Phaser.Math.Clamp(this.hero.x + dx, r, M1_LEVEL.worldWidth - r);
    this.hero.y = Phaser.Math.Clamp(this.hero.y + dy, r, M1_LEVEL.worldHeight - r);
  }

  /** 把英雄吸附回最近通道点（键盘移动/被击退后保持在通道上）。 */
  private snapHeroToGraph(): void {
    const p = this.graph.project(this.hero.x, this.hero.y);
    this.hero.x = p.x;
    this.hero.y = p.y;
  }

  // ── 战斗：大吃小 ──────────────────────────
  private resolveCombat(): void {
    for (const enemy of this.enemies) {
      if (!enemy.active) continue;
      const dist = Phaser.Math.Distance.Between(this.hero.x, this.hero.y, enemy.x, enemy.y);
      if (dist > this.hero.radius + enemy.radius + TOUCH_PAD) continue;
      if (this.hero.power >= enemy.power) this.absorb(enemy);
      else this.blocked(enemy);
    }
  }

  private absorb(enemy: Enemy): void {
    const gained = enemy.power;
    const before = this.hero.power;
    this.enemies = this.enemies.filter((e) => e !== enemy);
    enemy.setGuided(false);
    if (enemy.role === 'guard') this.unlockChestForGuard(enemy.power);

    // 士兵版专属：把敌人的随行小兵吸收飞向主角小队（this.squad 仅士兵版存在）
    if (this.squad && enemy.escortCount > 0) {
      this.squad.absorbFrom(enemy.escortWorldPoints());
    }

    this.absorbBurst(enemy.x, enemy.y);
    floatingText(this, enemy.x, enemy.y - enemy.radius, `+${gained}`, '#2ecc71', 26);
    enemy.playDefeat(() => {});

    this.hero.setPower(before + gained);
    this.hero.playHitPop();
    this.powerText.setText(`战力 ${this.hero.power}`);

    const ratio = gained / Math.max(1, before);
    Sfx.absorb(Math.min(3, ratio));
    if (ratio >= 0.6) this.cameras.main.shake(110, 0.004);
  }

  private absorbBurst(x: number, y: number): void {
    const ring = this.add.circle(x, y, 8, 0xffffff, 0).setStrokeStyle(4, 0x2ecc71, 0.9).setDepth(120);
    this.tweens.add({
      targets: ring,
      scale: { from: 0.5, to: 2.4 },
      alpha: { from: 0.9, to: 0 },
      duration: 320,
      ease: 'Cubic.out',
      onComplete: () => ring.destroy(),
    });
  }

  private blocked(enemy: Enemy): void {
    // 物理阻挡（每帧执行，不受反馈节流影响）：把英雄挡回敌人外侧并清空路径，
    // 确保战力不足时绝不能穿过敌人（即使玩家在冷却期内反复点击）。
    const vx = this.hero.x - enemy.x;
    const vy = this.hero.y - enemy.y;
    const len = Math.hypot(vx, vy) || 1;
    const push = enemy.radius + this.hero.radius + 30;
    this.moveHeroBy((vx / len) * push, (vy / len) * push);
    this.heroRoute = [];
    this.snapHeroToGraph();

    // 反馈节流：冷却期内只阻挡、不重复播放闪烁/震屏/音效/提示。
    const now = this.time.now;
    const last = this.blockCooldowns.get(enemy) ?? -Infinity;
    if (now - last < BLOCK_COOLDOWN) return;
    this.blockCooldowns.set(enemy, now);

    enemy.playBlock();
    floatingText(this, enemy.x, enemy.y - enemy.radius, '✕ 太强', '#e74c3c', 20);
    Sfx.block();
    this.cameras.main.shake(160, 0.009);
  }

  // ── 拾取增益 ──────────────────────────────
  private resolvePickups(): void {
    for (const pickup of this.pickups) {
      if (!pickup.active) continue;
      const dist = Phaser.Math.Distance.Between(this.hero.x, this.hero.y, pickup.x, pickup.y);
      if (dist > this.hero.radius + pickup.radius + TOUCH_PAD) continue;
      this.collectPickup(pickup);
    }
  }

  private collectPickup(pickup: Pickup): void {
    const gained = pickup.amount;
    this.pickups = this.pickups.filter((p) => p !== pickup);
    floatingText(this, pickup.x, pickup.y - pickup.radius, `+${gained}`, '#ffe082', 24);
    pickup.playCollect(() => {});
    this.hero.setPower(this.hero.power + gained);
    this.powerText.setText(`战力 ${this.hero.power}`);
    Sfx.absorb(1);
  }

  // ── 宝箱：守卫死后解锁，走到/点击即开启 → 二选一 ──
  private resolveChests(): void {
    for (const chest of this.chests) {
      if (chest.opened) continue;
      // 兜底解锁：守卫怪已不在场上（无同战力 guard 存活）则解锁
      if (!chest.ready) {
        const guardAlive = this.enemies.some((e) => e.active && e.role === 'guard' && e.power === chest.guardPower);
        if (!guardAlive) chest.unlock();
        continue;
      }
      // 已解锁：英雄走到宝箱即开启（点击亦可，见 setupInput）
      const dist = Phaser.Math.Distance.Between(this.hero.x, this.hero.y, chest.x, chest.y);
      if (dist <= this.hero.radius + chest.radius + TOUCH_PAD) this.openChest(chest);
    }
  }

  /** 命中已解锁宝箱的点击判定（世界坐标）。 */
  private chestAt(worldX: number, worldY: number): Chest | null {
    for (const chest of this.chests) {
      if (!chest.ready || chest.opened) continue;
      if (Phaser.Math.Distance.Between(worldX, worldY, chest.x, chest.y) <= chest.radius + 16) return chest;
    }
    return null;
  }

  /** 开启宝箱：炫酷开箱演出 → 弹出二选一宝物（模态），选择后加战力。 */
  private openChest(chest: Chest): void {
    if (chest.opened || this.gameState !== 'playing') return;
    const cfg = M1_LEVEL.chests.find((c) => c.guardPower === chest.guardPower);
    if (!cfg) return;
    // 变体换皮：宝箱标题/选项文案按当前版本改写（数值不变）
    const chestIndex = M1_LEVEL.chests.indexOf(cfg);
    const spec = this.variantSpec;
    const title = spec.chestTitle ?? cfg.title;
    const options = spec.relabelChestOption
      ? cfg.options.map((o) => ({ ...o, label: spec.relabelChestOption!(o, chestIndex) }))
      : cfg.options;

    this.modalOpen = true;
    this.gameState = 'paused';
    this.heroRoute = [];
    this.guideArrow.setVisible(false);
    Sfx.chest();

    chest.playOpen(() => {
      let resolved = false;
      let overlay: EquipGateOverlay | undefined;
      const resolve = (choice: number) => {
        if (resolved) return;
        resolved = true;
        overlay?.destroy();
        const opt = cfg.options[choice];
        this.hero.setPower(this.hero.power + opt.bonus);
        this.powerText.setText(`战力 ${this.hero.power}`);
        floatingText(this, this.hero.x, this.hero.y - this.hero.radius - 10, `+${opt.bonus}`, '#ffd54f', 30);
        Sfx.absorb(2);
        this.modalOpen = false;
        this.modalClosedAt = this.time.now;
        this.gameState = 'playing';
      };
      overlay = new EquipGateOverlay(this, title, options, resolve);
    });
  }

  // ── Boss：战力达标即可"大吃小"击败；否则被弹开并提示再变强 ──
  private resolveBoss(): void {
    if (!this.boss.alive || this.bossDefeated) return;
    const dist = Phaser.Math.Distance.Between(this.hero.x, this.hero.y, this.boss.x, this.boss.y);
    if (dist > this.hero.radius + this.boss.radius + TOUCH_PAD) return;

    if (this.hero.power >= this.boss.power) {
      this.defeatBoss();
      return;
    }

    // 战力不足：弹开 + 提示
    const vx = this.hero.x - this.boss.x;
    const vy = this.hero.y - this.boss.y;
    const len = Math.hypot(vx, vy) || 1;
    const push = this.boss.radius + this.hero.radius + 30;
    this.moveHeroBy((vx / len) * push, (vy / len) * push);
    this.heroRoute = [];
    this.snapHeroToGraph();

    const now = this.time.now;
    if (now - this.bossNudgeAt > BLOCK_COOLDOWN) {
      this.bossNudgeAt = now;
      floatingText(this, this.boss.x, this.boss.y - this.boss.radius, '战力不足！', '#ff8a65', 20);
      this.cameras.main.shake(140, 0.008);
    }
  }

  private refreshThreats(): void {
    for (const enemy of this.enemies) enemy.refreshThreat(this.hero.power);
  }

  // ── 引导箭头：先指敌人，清完指 Boss ──────────
  private updateGuide(time: number): void {
    // 仅做「一次性教学引导」：
    //   ① 开局第一个野怪（未击败前）；② 第一个宝箱解锁后（未开启前）。
    // 其余时刻一律不出箭头——不向玩家暗示当前最优解。
    let target: Enemy | Chest | null = null;
    if (this.firstEnemy && this.firstEnemy.active) {
      target = this.firstEnemy;
    } else if (this.firstChest && this.firstChest.ready && !this.firstChest.opened) {
      target = this.firstChest;
    }

    // 不再高亮"推荐敌人"：仅在引导第一个野怪时让其脉冲，其余敌人均不脉冲
    for (const e of this.enemies) e.setGuided(e === target);

    if (!target) {
      this.guideArrow.setVisible(false);
      return;
    }
    this.guideArrow.setVisible(true);
    this.guideArrow.x = target.x;
    this.guideArrow.y = target.y - target.radius - 26 + Math.sin(time / 180) * 5;
  }

  // ── 形态进化演出（炫酷：光柱 + 多重金环 + 旋转射线 + 星屑 + 横幅）──
  private playEvolve(name: string): void {
    const { WIDTH, HEIGHT } = GAME_VIEW;
    const hx = this.hero.x;
    const hy = this.hero.y;
    const formIdx = formIndexForPower(this.hero.power);
    // 宠物版：宠物与主角同步进化（外形/翅膀/犄角升级 + 炫光）
    this.pet?.setStage(formIdx);
    // 进化文案按版本主题改写（宠物版 = 巨龙进化称号）
    const displayName = this.variantSpec.formName?.(formIdx) ?? name;
    const evolveTitle = this.variantSpec.evolveTitle ?? '⚡ 形态进化 ⚡';
    Sfx.evolve();
    this.cameras.main.flash(260, 255, 248, 210);
    this.cameras.main.shake(220, 0.006);

    // 金色光柱（从脚下冲天）
    const beam = this.add.triangle(hx, hy, -46, 0, 46, 0, 0, -320, 0xffe082, 0.55).setDepth(125);
    this.tweens.add({
      targets: beam,
      alpha: { from: 0.55, to: 0 },
      scaleX: { from: 0.5, to: 1.3 },
      duration: 720,
      ease: 'Cubic.out',
      onComplete: () => beam.destroy(),
    });

    // 多重扩散金环
    for (let i = 0; i < 3; i++) {
      const ring = this.add
        .circle(hx, hy, 10, 0xffffff, 0)
        .setStrokeStyle(5, i % 2 ? 0xffd54f : 0xffffff, 0.95)
        .setDepth(126);
      this.tweens.add({
        targets: ring,
        scale: { from: 0.4, to: 3.4 },
        alpha: { from: 1, to: 0 },
        duration: 560,
        delay: i * 130,
        ease: 'Cubic.out',
        onComplete: () => ring.destroy(),
      });
    }

    // 旋转金色射线
    const rays = this.add.graphics().setDepth(124);
    rays.x = hx;
    rays.y = hy;
    rays.lineStyle(4, 0xfff3c4, 0.9);
    for (let i = 0; i < 14; i++) {
      const a = (Math.PI * 2 * i) / 14;
      rays.lineBetween(Math.cos(a) * 20, Math.sin(a) * 20, Math.cos(a) * 90, Math.sin(a) * 90);
    }
    this.tweens.add({
      targets: rays,
      angle: 110,
      alpha: { from: 0.9, to: 0 },
      scale: { from: 0.5, to: 1.8 },
      duration: 720,
      ease: 'Cubic.out',
      onComplete: () => rays.destroy(),
    });

    // 星屑上冲
    for (let i = 0; i < 16; i++) {
      const a = Math.random() * Math.PI * 2;
      const dist = 50 + Math.random() * 80;
      const star = this.add.star(hx, hy, 4, 3, 8, 0xffd54f, 1).setDepth(127);
      this.tweens.add({
        targets: star,
        x: hx + Math.cos(a) * dist,
        y: hy + Math.sin(a) * dist - 40,
        alpha: { from: 1, to: 0 },
        scale: { from: 1.2, to: 0.2 },
        duration: 620 + Math.random() * 240,
        ease: 'Cubic.out',
        onComplete: () => star.destroy(),
      });
    }

    // 居中横幅「⚡ 进化 ⚡ + 称号」（固定屏幕，缩放弹入后上浮淡出）
    const banner = this.add.container(WIDTH / 2, HEIGHT / 2 - 40).setDepth(1700).setScrollFactor(0);
    const t1 = this.add
      .text(0, -22, evolveTitle, {
        fontSize: '30px',
        color: '#ffffff',
        fontFamily: 'Arial Black, monospace',
        fontStyle: 'bold',
        stroke: '#e67e22',
        strokeThickness: 6,
      })
      .setOrigin(0.5);
    const t2 = this.add
      .text(0, 22, displayName, {
        fontSize: '40px',
        color: '#ffd54f',
        fontFamily: 'Arial Black, monospace',
        fontStyle: 'bold',
        stroke: '#7a3d00',
        strokeThickness: 7,
      })
      .setOrigin(0.5);
    banner.add([t1, t2]);
    banner.setScale(0.4);
    banner.setAlpha(0);
    this.tweens.add({
      targets: banner,
      scale: { from: 0.4, to: 1 },
      alpha: { from: 0, to: 1 },
      duration: 320,
      ease: 'Back.out',
    });
    this.tweens.add({
      targets: banner,
      y: banner.y - 60,
      alpha: 0,
      delay: 760,
      duration: 460,
      ease: 'Cubic.in',
      onComplete: () => banner.destroy(),
    });
  }

  // ── 击败 Boss → 解锁巨龙之力（本关不可用）→ CTA ──
  private defeatBoss(): void {
    if (this.bossDefeated) return;
    this.bossDefeated = true;
    this.gameState = 'paused';
    this.heroRoute = [];
    this.guideArrow.setVisible(false);

    const cam = this.cameras.main;
    cam.stopFollow();
    floatingText(this, this.boss.x, this.boss.y - this.boss.radius, '最终一击！', '#ffd54f', 26);
    // 镜头平移到火山口居中，Boss 倒地后再演出龙技解锁
    cam.once(Phaser.Cameras.Scene2D.Events.PAN_COMPLETE, () => {
      this.boss.defeat(() => this.unlockDragonSkill());
    });
    cam.pan(this.boss.x, 440, 600, 'Sine.easeInOut');
  }

  /** 巨龙之力解锁演出：华丽巨龙登场 + 横幅，提示"本关不可用，下载即可释放"。 */
  private unlockDragonSkill(): void {
    const { WIDTH } = GAME_VIEW;
    this.companion.rescue();
    // 复用龙技特效作为"解锁登场"演出（不再用于击杀，Boss 已倒地）
    playDragonUltimate(this, this.boss.x, this.boss.y, () => {
      this.paintDragonButton(true);
      this.tweens.add({
        targets: this.dragonBtn,
        scale: { from: 1, to: 1.1 },
        duration: 460,
        yoyo: true,
        repeat: 3,
        ease: 'Sine.inOut',
      });

      // 屏幕中央华丽横幅
      const banner = this.add
        .text(WIDTH / 2, 300, '🐉 巨龙之力 觉醒！', {
          fontSize: '40px',
          color: '#ffe082',
          fontFamily: 'Arial Black, monospace',
          fontStyle: 'bold',
          stroke: '#7a3b00',
          strokeThickness: 8,
        })
        .setOrigin(0.5)
        .setDepth(2350)
        .setScrollFactor(0)
        .setScale(0.4)
        .setAlpha(0);
      const sub = this.add
        .text(WIDTH / 2, 350, '本关无法使用 · 下载游戏即可释放', {
          fontSize: '18px',
          color: '#ffffff',
          fontFamily: 'monospace',
          stroke: '#000000',
          strokeThickness: 4,
        })
        .setOrigin(0.5)
        .setDepth(2350)
        .setScrollFactor(0)
        .setAlpha(0);
      this.cameras.main.flash(240, 255, 220, 140);
      this.tweens.add({
        targets: banner,
        scale: 1,
        alpha: 1,
        duration: 460,
        ease: 'Back.out',
      });
      this.tweens.add({ targets: sub, alpha: 1, duration: 460, delay: 240 });

      this.time.delayedCall(1500, () => {
        this.tweens.add({
          targets: [banner, sub],
          alpha: 0,
          duration: 320,
          onComplete: () => {
            banner.destroy();
            sub.destroy();
            this.showCTA();
          },
        });
      });
    });
  }

  // ── 结尾 CTA ─────────────────────────────
  private showCTA(): void {
    this.gameState = 'gameover';
    const { WIDTH, HEIGHT } = GAME_VIEW;
    // 全部固定屏幕(scrollFactor 0)，因镜头此时停在火山口
    this.add.rectangle(WIDTH / 2, HEIGHT / 2, WIDTH, HEIGHT, 0x000000, 0.68).setDepth(2300).setScrollFactor(0);

    this.add
      .text(WIDTH / 2, HEIGHT / 2 - 180, CTA.title, {
        fontSize: '48px',
        color: '#f1c40f',
        fontFamily: 'Arial Black, monospace',
        fontStyle: 'bold',
        stroke: '#000000',
        strokeThickness: 7,
      })
      .setOrigin(0.5)
      .setDepth(2400)
      .setScrollFactor(0);

    this.add
      .text(WIDTH / 2, HEIGHT / 2 - 120, `战力 ${this.hero.power} · ${this.variantSpec.formName?.(this.hero.form) ?? this.hero.formName}`, {
        fontSize: '22px',
        color: '#ffffff',
        fontFamily: 'Arial Black, monospace',
        fontStyle: 'bold',
        stroke: '#000000',
        strokeThickness: 4,
      })
      .setOrigin(0.5)
      .setDepth(2400)
      .setScrollFactor(0);

    this.add
      .text(WIDTH / 2, HEIGHT / 2 - 70, CTA.tagline, {
        fontSize: '17px',
        color: '#e8f5e9',
        fontFamily: 'monospace',
        align: 'center',
        wordWrap: { width: WIDTH - 80 },
      })
      .setOrigin(0.5)
      .setDepth(2400)
      .setScrollFactor(0);

    // 立即下载（主按钮，呼吸脉冲）
    const download = this.add
      .text(WIDTH / 2, HEIGHT / 2 + 20, '⬇ 立即下载', {
        fontSize: '30px',
        color: '#ffffff',
        backgroundColor: '#2ecc71',
        fontStyle: 'bold',
        padding: { x: 40, y: 18 },
      })
      .setOrigin(0.5)
      .setDepth(2400)
      .setScrollFactor(0)
      .setInteractive({ useHandCursor: true });
    download.on('pointerdown', () => this.openStore());
    this.tweens.add({
      targets: download,
      scale: { from: 1, to: 1.07 },
      duration: 620,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.inOut',
    });

    const replay = this.add
      .text(WIDTH / 2, HEIGHT / 2 + 110, '重新开始', {
        fontSize: '22px',
        color: '#ffffff',
        backgroundColor: '#16213e',
        padding: { x: 24, y: 12 },
      })
      .setOrigin(0.5)
      .setDepth(2400)
      .setScrollFactor(0)
      .setInteractive({ useHandCursor: true });
    replay.on('pointerdown', () => this.scene.restart());
  }

  private openStore(): void {
    try {
      window.open(CTA.storeUrl, '_blank');
    } catch {
      /* ignore */
    }
  }
}
