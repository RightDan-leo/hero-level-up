import Phaser from 'phaser';
import { ALLY_TEAM, drawSoldier } from '../utils/soldier';
import { floatingText } from '../utils/feedback';

/** 战力 → 主角士兵数量（单调递增、有上限，增兵即爽点）。 */
const TIERS: Array<[number, number]> = [
  [1, 1], [4, 2], [10, 3], [20, 4], [40, 6], [70, 8],
  [110, 10], [170, 12], [280, 15], [450, 18], [700, 22],
];

const MAX_SOLDIERS = 22;

export function soldierCountForPower(power: number): number {
  let c = 1;
  for (const [p, n] of TIERS) if (power >= p) c = n;
  return Math.min(MAX_SOLDIERS, c);
}

/**
 * 士兵版：主角的成长以「随从数量」体现。小队以环形阵列平滑跟随主角，
 * 战力跨档时增兵（弹入 + "集结!"提示），强化越打越多的爽感。
 */
export class ArmySquad {
  private scene: Phaser.Scene;
  private soldiers: Phaser.GameObjects.Container[] = [];
  private count = 0;
  private anchorX: number;
  private anchorY: number;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    this.scene = scene;
    this.anchorX = x;
    this.anchorY = y;
  }

  get size(): number {
    return this.count;
  }

  /** 设定目标兵数（仅在增加时弹入新兵 + 提示）。 */
  setCount(n: number): void {
    const target = Phaser.Math.Clamp(Math.round(n), 0, MAX_SOLDIERS);
    if (target === this.count) return;
    const grew = target > this.count;
    while (this.count < target) {
      this.spawnSoldier();
      this.count++;
    }
    while (this.count > target) {
      this.soldiers.pop()?.destroy();
      this.count--;
    }
    if (grew) {
      floatingText(this.scene, this.anchorX, this.anchorY - 40, `集结! 士兵 x${this.count}`, '#9ad0ff', 22);
    }
  }

  private spawnSoldier(): void {
    const c = this.scene.add.container(this.anchorX, this.anchorY).setDepth(94);
    const g = this.scene.add.graphics();
    drawSoldier(g, 0, 0, 0.85, ALLY_TEAM);
    c.add(g);
    this.scene.tweens.add({ targets: c, scale: { from: 0, to: 1 }, duration: 320, ease: 'Back.out' });
    this.soldiers.push(c);
  }

  /**
   * 击败敌人时：把敌人的随行小兵"策反吸收"——从其世界坐标起飞、
   * 弧线汇聚到主角处并转为我方蓝色后并入队伍（兵数最终由 setCount 反映）。
   */
  absorbFrom(points: Array<{ x: number; y: number }>): void {
    for (let i = 0; i < points.length; i++) {
      const p = points[i];
      const c = this.scene.add.container(p.x, p.y).setDepth(118);
      const g = this.scene.add.graphics();
      drawSoldier(g, 0, 0, 0.7, ALLY_TEAM);
      c.add(g);
      const midY = Math.min(p.y, this.anchorY) - 28; // 起跳上拱
      const tx = this.anchorX + Phaser.Math.Between(-16, 16);
      const ty = this.anchorY + Phaser.Math.Between(-8, 8);
      // 起跳放大 → 上拱 → 汇聚到主角并缩小并队
      this.scene.tweens.add({
        targets: c,
        scale: { from: 1.15, to: 0.62 },
        duration: 460,
        delay: i * 55,
        ease: 'Sine.inOut',
        onComplete: () => {
          const spark = this.scene.add
            .text(tx, ty, '✦', { fontSize: '14px', color: '#9ad0ff' })
            .setOrigin(0.5)
            .setDepth(119);
          this.scene.tweens.add({
            targets: spark,
            y: ty - 18,
            alpha: { from: 1, to: 0 },
            duration: 280,
            onComplete: () => spark.destroy(),
          });
          c.destroy();
        },
      });
      // 位置走两段（上拱再下落汇聚），用独立 tween 控制 x/y 形成弧线
      this.scene.tweens.add({ targets: c, x: tx, duration: 460, delay: i * 55, ease: 'Quad.in' });
      this.scene.tweens.add({
        targets: c,
        y: midY,
        duration: 230,
        delay: i * 55,
        ease: 'Quad.out',
        onComplete: () => {
          this.scene.tweens.add({ targets: c, y: ty, duration: 230, ease: 'Quad.in' });
        },
      });
    }
  }

  /** 环形阵列跟随主角（双层环 + 轻微浮动）。 */
  follow(heroX: number, heroY: number, heroRadius: number): void {
    this.anchorX = heroX;
    this.anchorY = heroY;
    const t = this.scene.time.now / 1000;
    const inner = Math.min(8, this.count);
    for (let i = 0; i < this.soldiers.length; i++) {
      const onInner = i < inner;
      const ringIdx = onInner ? i : i - inner;
      const ringN = onInner ? inner : Math.max(1, this.count - inner);
      const radius = (onInner ? heroRadius + 22 : heroRadius + 42);
      const ang = (ringIdx / ringN) * Math.PI * 2 + (onInner ? 0 : 0.4) + t * 0.25;
      const tx = heroX + Math.cos(ang) * radius;
      const ty = heroY + Math.sin(ang) * radius * 0.62 + Math.sin(t * 2 + i) * 2;
      const s = this.soldiers[i];
      s.x = Phaser.Math.Linear(s.x, tx, 0.16);
      s.y = Phaser.Math.Linear(s.y, ty, 0.16);
      s.setDepth(ty >= heroY ? 102 : 94); // 在主角身前/身后正确遮挡
    }
  }

  destroy(): void {
    for (const s of this.soldiers) s.destroy();
    this.soldiers = [];
    this.count = 0;
  }
}
