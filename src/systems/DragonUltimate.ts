import Phaser from 'phaser';
import { GAME_VIEW } from '../config/view';

/**
 * 巨龙觉醒龙技演出：巨龙破空飞向 Boss → 喷火横扫全屏 → 震屏闪光。
 * 全片最大特效，结束后回调 onComplete。M3 用占位 emoji + 火焰矩形表现。
 */
export function playDragonUltimate(
  scene: Phaser.Scene,
  targetX: number,
  targetY: number,
  onComplete: () => void,
): void {
  const { WIDTH, HEIGHT } = GAME_VIEW;

  scene.cameras.main.flash(260, 255, 230, 180);
  scene.cameras.main.shake(900, 0.012);

  // 巨龙破空（占位 emoji），从左上飞向 Boss
  const dragon = scene.add
    .text(-80, -60, '🐉', { fontSize: '120px' })
    .setOrigin(0.5)
    .setDepth(2200);
  scene.tweens.add({
    targets: dragon,
    x: targetX,
    y: targetY - 30,
    duration: 520,
    ease: 'Cubic.in',
    onComplete: () => {
      // 喷火横扫
      const fire = scene.add
        .ellipse(targetX, targetY, 40, 40, 0xff7a18, 0.9)
        .setDepth(2100);
      scene.tweens.add({
        targets: fire,
        scaleX: { from: 1, to: WIDTH / 8 },
        scaleY: { from: 1, to: HEIGHT / 10 },
        alpha: { from: 0.95, to: 0 },
        duration: 620,
        ease: 'Cubic.out',
        onComplete: () => fire.destroy(),
      });
      scene.cameras.main.flash(200, 255, 160, 60);

      // 巨龙盘旋离场
      scene.tweens.add({
        targets: dragon,
        x: WIDTH + 100,
        y: 80,
        angle: 20,
        duration: 700,
        delay: 320,
        ease: 'Cubic.out',
        onComplete: () => dragon.destroy(),
      });

      scene.time.delayedCall(640, onComplete);
    },
  });
}
