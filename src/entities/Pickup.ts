import Phaser from 'phaser';

const PICKUP_RADIUS = 16;
const SPRITE_PX = 16;

/**
 * 地图增益道具（+N 战力药水）。使用 Kenney Tiny Dungeon 精灵 + "+N"。
 * 英雄路过自动吸收，制造滚雪球的补充来源。
 */
export class Pickup extends Phaser.GameObjects.Container {
  readonly amount: number;

  private icon: Phaser.GameObjects.Image;
  private label: Phaser.GameObjects.Text;

  constructor(scene: Phaser.Scene, x: number, y: number, amount: number) {
    super(scene, x, y);
    this.amount = amount;
    const baseScale = (PICKUP_RADIUS * 2.2) / SPRITE_PX;

    const halo = scene.add.circle(0, 0, PICKUP_RADIUS * 1.1, 0xf1c40f, 0.18);
    this.icon = scene.add.image(0, 0, 'pickup_potion').setScale(baseScale);
    // 地面道具统一「蓝边白字」
    this.label = scene.add
      .text(0, -PICKUP_RADIUS - 12, `+${amount}`, {
        fontSize: '18px',
        color: '#ffffff',
        fontFamily: 'Arial Black, monospace',
        fontStyle: 'bold',
        stroke: '#1d6fd6',
        strokeThickness: 5,
      })
      .setOrigin(0.5);

    this.add([halo, this.icon, this.label]);
    this.setDepth(40);
    scene.add.existing(this);

    // 持续浮动 + 轻微脉冲，吸引注意
    scene.tweens.add({
      targets: this.icon,
      scale: { from: baseScale, to: baseScale * 1.15 },
      duration: 700,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.inOut',
    });
    scene.tweens.add({
      targets: this,
      y: y - 6,
      duration: 900,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.inOut',
    });
  }

  get radius(): number {
    return PICKUP_RADIUS;
  }

  /** 被拾取：放大淡出后销毁。 */
  playCollect(onDone: () => void): void {
    this.scene.tweens.killTweensOf(this);
    this.scene.tweens.add({
      targets: this,
      scale: { from: 1, to: 1.8 },
      alpha: { from: 1, to: 0 },
      duration: 220,
      ease: 'Cubic.out',
      onComplete: () => {
        onDone();
        this.destroy();
      },
    });
  }
}
