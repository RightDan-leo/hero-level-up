import Phaser from 'phaser';

const BOSS_RADIUS = 46;
const HP_W = 110;
const SPRITE_PX = 16;

/**
 * 火山口最终 Boss（巨型骷髅）。可被玩家以"大吃小"直接击败（战力达标即可）。
 * 击败后触发「巨龙之力解锁」演出（本关不可用，引导下载）。
 */
export class Boss extends Phaser.GameObjects.Container {
  readonly power: number;
  alive = true;

  private sprite: Phaser.GameObjects.Image;
  private hpFill: Phaser.GameObjects.Rectangle;
  private baseScale: number;

  constructor(scene: Phaser.Scene, x: number, y: number, power: number) {
    super(scene, x, y);
    this.power = power;
    this.baseScale = (BOSS_RADIUS * 2.2) / SPRITE_PX;

    const shadow = scene.add.ellipse(0, BOSS_RADIUS - 2, BOSS_RADIUS * 2.2, BOSS_RADIUS * 0.6, 0x000000, 0.3);
    const aura = scene.add.circle(0, 0, BOSS_RADIUS * 1.05, 0xff3b30, 0.12);
    this.sprite = scene.add.image(0, -4, 'boss_skull').setScale(this.baseScale);

    const hpBg = scene.add.rectangle(0, -BOSS_RADIUS - 24, HP_W, 12, 0x222222).setStrokeStyle(2, 0x000000);
    this.hpFill = scene.add.rectangle(-HP_W / 2, -BOSS_RADIUS - 24, HP_W, 10, 0xff3b30).setOrigin(0, 0.5);

    const label = scene.add
      .text(0, -BOSS_RADIUS - 46, `${power}`, {
        fontSize: '32px',
        color: '#ffffff',
        fontFamily: 'Arial Black, monospace',
        fontStyle: 'bold',
        stroke: '#c0392b',
        strokeThickness: 7,
      })
      .setOrigin(0.5);

    this.add([shadow, aura, this.sprite, hpBg, this.hpFill, label]);
    this.setDepth(60);
    scene.add.existing(this);

    scene.tweens.add({
      targets: this.sprite,
      scaleX: { from: this.baseScale, to: this.baseScale * 1.06 },
      scaleY: { from: this.baseScale, to: this.baseScale * 0.96 },
      duration: 700,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.inOut',
    });
  }

  get radius(): number {
    return BOSS_RADIUS;
  }

  /** 被玩家击败：抽空血条 + 受击闪烁后倒地。 */
  defeat(onDead: () => void): void {
    this.alive = false;
    this.scene.tweens.killTweensOf(this.sprite);
    this.scene.cameras.main.shake(220, 0.01);
    this.scene.tweens.add({
      targets: this.sprite,
      alpha: { from: 0.3, to: 1 },
      duration: 90,
      yoyo: true,
      repeat: 2,
    });
    this.scene.tweens.add({
      targets: this.hpFill,
      scaleX: { from: 1, to: 0 },
      duration: 600,
      ease: 'Quad.in',
      onComplete: () => this.playDeath(onDead),
    });
  }

  private playDeath(onDone: () => void): void {
    this.scene.tweens.add({
      targets: this,
      angle: 90,
      alpha: 0,
      y: this.y + 30,
      scale: 0.6,
      duration: 520,
      ease: 'Back.in',
      onComplete: () => {
        onDone();
        this.destroy();
      },
    });
  }
}
