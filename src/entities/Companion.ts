import Phaser from 'phaser';

/**
 * 被掳同伴。开局在火山口带"!"求救（情感钩子），
 * Boss 被击败后获救，切换为爱心气泡并升起飘心。
 */
export class Companion extends Phaser.GameObjects.Container {
  private bubble: Phaser.GameObjects.Text;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y);

    const shadow = scene.add.ellipse(0, 18, 30, 10, 0x000000, 0.25);
    const body = scene.add.image(0, 0, 'companion').setScale(34 / 16);
    this.bubble = scene.add
      .text(0, -34, '!', {
        fontSize: '24px',
        color: '#ffd54f',
        fontFamily: 'Arial Black, monospace',
        fontStyle: 'bold',
        stroke: '#000000',
        strokeThickness: 4,
      })
      .setOrigin(0.5);

    this.add([shadow, body, this.bubble]);
    this.setDepth(55);
    scene.add.existing(this);

    scene.tweens.add({
      targets: this.bubble,
      y: -40,
      duration: 700,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.inOut',
    });
  }

  /** 获救：切换爱心气泡并升起几颗飘心。 */
  rescue(): void {
    this.scene.tweens.killTweensOf(this.bubble);
    this.bubble.setText('♥').setColor('#ff6b9d').setY(-34);
    this.scene.tweens.add({
      targets: this.bubble,
      scale: { from: 1.6, to: 1 },
      duration: 300,
      ease: 'Back.out',
    });
    for (let i = 0; i < 4; i++) {
      const heart = this.scene.add
        .text(this.x + Phaser.Math.Between(-16, 16), this.y - 10, '♥', {
          fontSize: '18px',
          color: '#ff6b9d',
        })
        .setOrigin(0.5)
        .setDepth(120);
      this.scene.tweens.add({
        targets: heart,
        y: heart.y - Phaser.Math.Between(50, 90),
        alpha: { from: 1, to: 0 },
        duration: 900,
        delay: i * 120,
        ease: 'Cubic.out',
        onComplete: () => heart.destroy(),
      });
    }
  }
}
