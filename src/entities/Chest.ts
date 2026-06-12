import Phaser from 'phaser';

const CHEST_R = 26;

/**
 * 守卫后宝箱。被 guard 怪把守，击败守卫后 unlock() → 闪光提示「点击开启」。
 * 点击调用 playOpen() 播放炫酷开箱特效，结束回调里由场景弹出「二选一」。
 * 纯 Graphics 绘制（无需额外美术资源）。
 */
export class Chest extends Phaser.GameObjects.Container {
  /** 把守此宝箱的守卫怪战力（场景用来在击败该守卫后解锁本箱）。 */
  readonly guardPower: number;
  ready = false;
  opened = false;

  private chestBody: Phaser.GameObjects.Graphics;
  private lid: Phaser.GameObjects.Graphics;
  private lock: Phaser.GameObjects.Graphics;
  private glow: Phaser.GameObjects.Arc;
  private hint: Phaser.GameObjects.Text;
  private bob?: Phaser.Tweens.Tween;
  private glowTween?: Phaser.Tweens.Tween;

  constructor(scene: Phaser.Scene, x: number, y: number, guardPower: number) {
    super(scene, x, y);
    this.guardPower = guardPower;

    const shadow = scene.add.ellipse(0, 18, 58, 16, 0x000000, 0.22);

    // 就绪时的金色光环（初始隐藏）
    this.glow = scene.add.circle(0, 0, CHEST_R + 14, 0xffd54f, 0).setVisible(false);

    this.chestBody = scene.add.graphics();
    this.lid = scene.add.graphics();
    this.lock = scene.add.graphics();
    this.drawChest();

    this.hint = scene.add
      .text(0, -CHEST_R - 20, '点击开启', {
        fontSize: '16px',
        color: '#fff3c4',
        fontFamily: 'Arial Black, monospace',
        fontStyle: 'bold',
        stroke: '#5a4500',
        strokeThickness: 4,
      })
      .setOrigin(0.5)
      .setVisible(false);

    this.add([shadow, this.glow, this.chestBody, this.lid, this.lock, this.hint]);
    this.setDepth(45);
    this.setAlpha(0.85); // 锁定态略暗
    scene.add.existing(this);
  }

  get radius(): number {
    return CHEST_R;
  }

  private drawChest(): void {
    const w = 50;
    const h = 34;
    // 箱体
    this.chestBody.clear();
    this.chestBody.fillStyle(0x6b3f1d, 1);
    this.chestBody.fillRoundedRect(-w / 2, -h / 2 + 8, w, h, 6);
    this.chestBody.lineStyle(3, 0x3d2410, 1);
    this.chestBody.strokeRoundedRect(-w / 2, -h / 2 + 8, w, h, 6);
    // 金色竖纹
    this.chestBody.fillStyle(0xf1c40f, 1);
    this.chestBody.fillRect(-4, -h / 2 + 8, 8, h);
    // 箱盖
    this.lid.clear();
    this.lid.fillStyle(0x8a5a2b, 1);
    this.lid.fillRoundedRect(-w / 2 - 2, -h / 2 - 6, w + 4, 18, 7);
    this.lid.lineStyle(3, 0x3d2410, 1);
    this.lid.strokeRoundedRect(-w / 2 - 2, -h / 2 - 6, w + 4, 18, 7);
    this.lid.fillStyle(0xf1c40f, 1);
    this.lid.fillRect(-4, -h / 2 - 6, 8, 18);
    // 锁扣
    this.lock.clear();
    this.lock.fillStyle(0xffd54f, 1);
    this.lock.fillRoundedRect(-7, -2, 14, 12, 3);
    this.lock.lineStyle(2, 0x6b4e00, 1);
    this.lock.strokeRoundedRect(-7, -2, 14, 12, 3);
  }

  /** 守卫被击败：解锁 → 金色脉冲 + 上下浮动 + 「点击开启」提示。 */
  unlock(): void {
    if (this.ready || this.opened) return;
    this.ready = true;
    this.setAlpha(1);
    this.glow.setVisible(true);
    this.hint.setVisible(true);

    this.glowTween = this.scene.tweens.add({
      targets: this.glow,
      alpha: { from: 0.5, to: 0.12 },
      scale: { from: 0.9, to: 1.25 },
      duration: 700,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.inOut',
    });
    this.bob = this.scene.tweens.add({
      targets: this,
      y: this.y - 6,
      duration: 760,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.inOut',
    });
    // 解锁瞬间的一次提示弹跳
    this.scene.tweens.add({
      targets: [this.chestBody, this.lid, this.lock],
      scaleX: { from: 1.25, to: 1 },
      scaleY: { from: 1.25, to: 1 },
      duration: 320,
      ease: 'Back.out',
    });
  }

  /** 炫酷开箱：箱盖弹飞 + 白光闪 + 金色光柱/射线 + 星屑爆发，结束回调。 */
  playOpen(onDone: () => void): void {
    if (this.opened) return;
    this.opened = true;
    this.ready = false;
    this.bob?.stop();
    this.glowTween?.stop();
    this.glow.setVisible(false);
    this.hint.setVisible(false);
    this.lock.setVisible(false);

    const scene = this.scene;
    const wx = this.x;
    const wy = this.y;

    // 箱体抖一下
    scene.tweens.add({ targets: this, angle: { from: -4, to: 4 }, duration: 70, yoyo: true, repeat: 3 });

    // 盖子弹飞 + 旋转淡出
    scene.tweens.add({
      targets: this.lid,
      y: -64,
      angle: -120,
      alpha: 0,
      duration: 460,
      ease: 'Back.out',
      delay: 220,
    });

    scene.time.delayedCall(240, () => {
      // 白光爆闪
      const flash = scene.add.circle(wx, wy, 12, 0xffffff, 0.95).setDepth(1500);
      scene.tweens.add({
        targets: flash,
        scale: { from: 0.6, to: 6 },
        alpha: { from: 0.95, to: 0 },
        duration: 460,
        ease: 'Cubic.out',
        onComplete: () => flash.destroy(),
      });

      // 金色光柱
      const beam = scene.add.triangle(wx, wy, -40, -10, 40, -10, 0, -260, 0xffe082, 0.5).setDepth(1490);
      scene.tweens.add({
        targets: beam,
        alpha: { from: 0.5, to: 0 },
        scaleX: { from: 0.4, to: 1.2 },
        duration: 620,
        ease: 'Cubic.out',
        onComplete: () => beam.destroy(),
      });

      // 旋转金色射线
      const rays = scene.add.graphics().setDepth(1488);
      rays.x = wx;
      rays.y = wy - 6;
      rays.lineStyle(4, 0xfff3c4, 0.9);
      for (let i = 0; i < 12; i++) {
        const a = (Math.PI * 2 * i) / 12;
        rays.lineBetween(Math.cos(a) * 18, Math.sin(a) * 18, Math.cos(a) * 70, Math.sin(a) * 70);
      }
      scene.tweens.add({
        targets: rays,
        angle: 90,
        alpha: { from: 0.9, to: 0 },
        scale: { from: 0.6, to: 1.5 },
        duration: 620,
        ease: 'Cubic.out',
        onComplete: () => rays.destroy(),
      });

      // 星屑爆发
      for (let i = 0; i < 14; i++) {
        const a = Math.random() * Math.PI * 2;
        const dist = 40 + Math.random() * 70;
        const star = scene.add
          .star(wx, wy - 4, 4, 3, 7, 0xffd54f, 1)
          .setDepth(1492);
        scene.tweens.add({
          targets: star,
          x: wx + Math.cos(a) * dist,
          y: wy - 4 + Math.sin(a) * dist - 30,
          alpha: { from: 1, to: 0 },
          scale: { from: 1, to: 0.2 },
          duration: 560 + Math.random() * 200,
          ease: 'Cubic.out',
          onComplete: () => star.destroy(),
        });
      }
      scene.cameras.main.flash(180, 255, 245, 200);
      scene.cameras.main.shake(160, 0.005);
    });

    scene.time.delayedCall(760, onDone);
  }
}
