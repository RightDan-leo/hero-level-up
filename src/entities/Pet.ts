import Phaser from 'phaser';

/** 宠物 5 阶进化（与主角形态索引同步）。纯 Graphics 绘制，无需美术依赖。 */
interface PetStage {
  name: string;
  bodyR: number;
  color: number;
  belly: number;
  wings: boolean;
  horns: boolean;
  spikes: boolean;
}

const STAGES: PetStage[] = [
  { name: '幼龙', bodyR: 10, color: 0x6cc24a, belly: 0xd9f2c0, wings: false, horns: false, spikes: false },
  { name: '翼龙', bodyR: 13, color: 0x3aa6e0, belly: 0xcdeffb, wings: true, horns: false, spikes: false },
  { name: '角龙', bodyR: 16, color: 0x9b59b6, belly: 0xe8d4f2, wings: true, horns: true, spikes: false },
  { name: '烈焰龙', bodyR: 19, color: 0xf39c12, belly: 0xffe6b0, wings: true, horns: true, spikes: true },
  { name: '远古真龙', bodyR: 23, color: 0xe74c3c, belly: 0xffd1c4, wings: true, horns: true, spikes: true },
];

/**
 * 跟随主角的进化宠物（宠物版）。随主角战力跨阶 → 体型/颜色/翅膀/犄角同步进化，
 * 强化"我也在变强"的成长爽感。始终平滑跟随在主角身侧后方。
 */
export class Pet extends Phaser.GameObjects.Container {
  private stageIdx = 0;
  private aura: Phaser.GameObjects.Graphics;
  private gfx: Phaser.GameObjects.Graphics;
  private inner: Phaser.GameObjects.Container;
  private shadow: Phaser.GameObjects.Ellipse;
  /** true = 作为主角化身（居中跟随、按移动方向朝向）；false = 身侧跟随的伙伴。 */
  private avatar: boolean;

  constructor(scene: Phaser.Scene, x: number, y: number, avatar = false) {
    super(scene, x, y);
    this.avatar = avatar;

    this.shadow = scene.add.ellipse(0, 14, 30, 9, 0x000000, 0.22);
    this.aura = scene.add.graphics();
    this.inner = scene.add.container(0, 0);
    this.gfx = scene.add.graphics();
    this.inner.add(this.gfx);

    this.add([this.shadow, this.aura, this.inner]);
    // 化身：与主角同层（敌人 50 / Boss 60 之上，主角数字 100 之下）。
    this.setDepth(avatar ? 99 : 96);
    scene.add.existing(this);

    // 悬浮呼吸
    scene.tweens.add({
      targets: this.inner,
      y: -6,
      duration: 760,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.inOut',
    });

    this.redraw();
  }

  get stageName(): string {
    return STAGES[this.stageIdx].name;
  }

  /** 跟随主角：化身模式紧贴主角并按移动方向朝向；伙伴模式平滑跟在身侧后方。 */
  follow(heroX: number, heroY: number): void {
    if (this.avatar) {
      const dx = heroX - this.x;
      if (Math.abs(dx) > 0.4) this.inner.scaleX = dx >= 0 ? 1 : -1; // 龙头默认朝右
      this.x = heroX;
      this.y = heroY;
      return;
    }
    const tx = heroX - 42;
    const ty = heroY + 8;
    this.x = Phaser.Math.Linear(this.x, tx, 0.14);
    this.y = Phaser.Math.Linear(this.y, ty, 0.14);
    // 朝向主角（在左侧时面向右）
    this.inner.scaleX = heroX >= this.x ? 1 : -1;
  }

  /** 进化到指定阶（与主角形态同步），带一次炫光回弹。 */
  setStage(index: number): void {
    const next = Phaser.Math.Clamp(index, 0, STAGES.length - 1);
    if (next <= this.stageIdx) return;
    this.stageIdx = next;
    this.redraw();
    this.playEvolveFlourish();
  }

  /** 进化/登场炫光（回弹 + 扩散光环 + 星屑）。 */
  playEvolveFlourish(): void {
    const color = STAGES[this.stageIdx].color;
    this.scene.tweens.add({
      targets: this.inner,
      scale: { from: 1.8, to: 1 },
      duration: 420,
      ease: 'Back.out',
    });
    // 扩散光环
    const ring = this.scene.add.circle(this.x, this.y, 8, color, 0).setStrokeStyle(4, color, 0.9).setDepth(130);
    this.scene.tweens.add({
      targets: ring,
      radius: 56,
      alpha: { from: 0.9, to: 0 },
      duration: 560,
      ease: 'Cubic.out',
      onComplete: () => ring.destroy(),
    });
    // 星屑上冲
    for (let i = 0; i < 6; i++) {
      const s = this.scene.add
        .text(this.x + Phaser.Math.Between(-14, 14), this.y, '✦', { fontSize: '14px', color: '#ffe082' })
        .setOrigin(0.5)
        .setDepth(131);
      this.scene.tweens.add({
        targets: s,
        y: s.y - Phaser.Math.Between(36, 64),
        alpha: { from: 1, to: 0 },
        duration: 620,
        delay: i * 40,
        onComplete: () => s.destroy(),
      });
    }
  }

  private redraw(): void {
    const st = STAGES[this.stageIdx];
    const r = st.bodyR;
    this.shadow.setSize(r * 2.6, r * 0.8);

    // 进化光环
    this.aura.clear();
    this.aura.fillStyle(st.color, 0.16);
    this.aura.fillCircle(0, 0, r * 1.9);
    this.scene.tweens.killTweensOf(this.aura);
    this.scene.tweens.add({
      targets: this.aura,
      alpha: { from: 0.55, to: 1 },
      duration: 900,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.inOut',
    });

    const g = this.gfx;
    g.clear();
    const dark = Phaser.Display.Color.IntegerToColor(st.color).darken(28).color;

    // 尾巴（左后方三角）
    g.fillStyle(dark, 1);
    g.fillTriangle(-r * 1.1, 2, -r * 1.9, -r * 0.5, -r * 1.0, r * 0.5);

    // 翅膀（后阶才有）
    if (st.wings) {
      g.fillStyle(dark, 0.95);
      g.fillTriangle(-r * 0.2, -r * 0.4, -r * 1.4, -r * 1.7, r * 0.3, -r * 0.9);
      g.fillTriangle(-r * 0.2, -r * 0.4, -r * 0.4, -r * 1.9, r * 0.6, -r * 0.8);
    }

    // 身体
    g.fillStyle(st.color, 1);
    g.fillEllipse(0, 0, r * 2.2, r * 1.9);
    // 肚皮
    g.fillStyle(st.belly, 1);
    g.fillEllipse(r * 0.1, r * 0.55, r * 1.2, r * 0.9);

    // 头（右前方）
    const hx = r * 0.95;
    const hy = -r * 0.65;
    g.fillStyle(st.color, 1);
    g.fillCircle(hx, hy, r * 0.78);
    // 吻部
    g.fillStyle(st.belly, 1);
    g.fillEllipse(hx + r * 0.55, hy + r * 0.2, r * 0.7, r * 0.5);

    // 犄角
    if (st.horns) {
      g.fillStyle(0xfff3c0, 1);
      g.fillTriangle(hx - r * 0.1, hy - r * 0.6, hx - r * 0.45, hy - r * 1.25, hx + r * 0.15, hy - r * 0.7);
      g.fillTriangle(hx + r * 0.4, hy - r * 0.55, hx + r * 0.25, hy - r * 1.2, hx + r * 0.7, hy - r * 0.6);
    }

    // 背脊棘刺
    if (st.spikes) {
      g.fillStyle(0xfff3c0, 1);
      for (let i = 0; i < 3; i++) {
        const sx = -r * 0.6 + i * r * 0.55;
        g.fillTriangle(sx, -r * 0.9, sx - r * 0.22, -r * 1.4, sx + r * 0.22, -r * 0.9);
      }
    }

    // 眼睛
    g.fillStyle(0xffffff, 1);
    g.fillCircle(hx + r * 0.2, hy - r * 0.1, r * 0.26);
    g.fillStyle(0x101018, 1);
    g.fillCircle(hx + r * 0.28, hy - r * 0.1, r * 0.13);
  }
}
