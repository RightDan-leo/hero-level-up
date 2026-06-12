import Phaser from 'phaser';

/**
 * 上浮淡出的反馈文字（如吸收战力 "+N"、错选警告 "✕"）。
 * 用于"每次操作都有可见反馈"的即时正/负反馈。
 */
export function floatingText(
  scene: Phaser.Scene,
  x: number,
  y: number,
  text: string,
  color: string,
  fontSize = 24,
): void {
  const label = scene.add
    .text(x, y, text, {
      fontSize: `${fontSize}px`,
      color,
      fontFamily: 'Arial Black, monospace',
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 4,
    })
    .setOrigin(0.5)
    .setDepth(1000);

  scene.tweens.add({
    targets: label,
    y: y - 64,
    alpha: { from: 1, to: 0 },
    scale: { from: 0.8, to: 1.2 },
    duration: 760,
    ease: 'Cubic.out',
    onComplete: () => label.destroy(),
  });
}

/**
 * 点击落点标记：一圈快速扩散淡出的光环，强化点击移动的手感反馈。
 */
export function clickMarker(scene: Phaser.Scene, x: number, y: number): void {
  const ring = scene.add.circle(x, y, 6, 0xffffff, 0).setStrokeStyle(3, 0xffe082, 0.9).setDepth(5);
  scene.tweens.add({
    targets: ring,
    scale: { from: 0.4, to: 2.2 },
    alpha: { from: 0.9, to: 0 },
    duration: 420,
    ease: 'Cubic.out',
    onComplete: () => ring.destroy(),
  });
}
