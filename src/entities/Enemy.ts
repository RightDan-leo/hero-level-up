import Phaser from 'phaser';
import type { EnemyRole } from '../config/level.config';
import { ENEMY_TEAM, drawSoldier } from '../utils/soldier';

const BASE_RADIUS = 16;
const SPRITE_PX = 16;

/** 士兵版：敌人按战力派生随行小兵数量（纯观感，封顶 6）。 */
export function escortCountForPower(power: number): number {
  return Phaser.Math.Clamp(Math.round(Math.log2(power + 1)), 1, 6);
}

/**
 * 怪物敌人。使用 Kenney Tiny Dungeon 精灵 + 头顶红色战力数字。
 * 体型随战力略微变大；脚下威胁环动态切换可击败(绿)/危险(红)。
 * decor=true 时为装饰野怪（地形隔断不可交战），略微淡化、不参与战斗/引导/清场。
 */
export class Enemy extends Phaser.GameObjects.Container {
  power: number;
  readonly role: EnemyRole;
  readonly decor: boolean;
  /** 随行小兵数量（仅士兵版 >0；用于击败时吸收演出）。 */
  readonly escortCount: number;
  /** 随行小兵相对敌人中心的局部坐标（吸收演出取世界坐标用）。 */
  private escortLocal: Array<{ x: number; y: number }> = [];

  private sprite: Phaser.GameObjects.Image;
  private ring: Phaser.GameObjects.Arc;
  private label: Phaser.GameObjects.Text;
  private shadow: Phaser.GameObjects.Ellipse;
  private size: number;
  private baseScale: number;
  private defeatable: boolean | null = null;
  private guided = false;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    power: number,
    texture = 'enemy_ghost',
    role: EnemyRole = 'path',
    decor = false,
    escortCount = 0,
  ) {
    super(scene, x, y);
    this.power = power;
    this.role = role;
    this.decor = decor;
    this.escortCount = Math.max(0, escortCount);
    this.size = BASE_RADIUS * 2 + Math.min(34, Math.log10(power + 1) * 20);
    this.baseScale = this.size / SPRITE_PX;

    this.shadow = scene.add.ellipse(0, this.size / 2 - 2, this.size * 1.05, this.size * 0.34, 0x000000, 0.22);
    // 士兵版：敌人随行小兵（红队），围绕敌人脚下环形列阵，纯观感
    const escort = this.buildEscort(scene, escortCount);
    this.ring = scene.add.circle(0, 0, this.size * 0.6, 0x000000, 0).setStrokeStyle(4, 0xe74c3c);
    this.sprite = scene.add.image(0, 0, texture).setScale(this.baseScale);
    // 敌人统一「红边白字」：无论战力是否低于英雄都显示红色边框（不再用绿色提示可击败）
    this.label = scene.add
      .text(0, -this.size / 2 - 14, `${power}`, {
        fontSize: '23px',
        color: '#ffffff',
        fontFamily: 'Arial Black, monospace',
        fontStyle: 'bold',
        stroke: '#c0392b',
        strokeThickness: 6,
      })
      .setOrigin(0.5);

    const children: Phaser.GameObjects.GameObject[] = [this.shadow];
    if (escort) children.push(escort);
    children.push(this.ring, this.sprite, this.label);
    this.add(children);
    this.setDepth(50);
    if (decor) this.setAlpha(0.82);
    scene.add.existing(this);
  }

  /** 绘制随行小兵环（仅士兵版传入 escortCount>0）。 */
  private buildEscort(scene: Phaser.Scene, count: number): Phaser.GameObjects.Graphics | null {
    if (count <= 0) return null;
    const g = scene.add.graphics();
    const radius = this.size * 0.55 + 12;
    const footY = this.size / 2 - 2;
    for (let i = 0; i < count; i++) {
      const ang = (i / count) * Math.PI * 2 + Math.PI / count;
      const sx = Math.cos(ang) * radius;
      const sy = footY + Math.sin(ang) * radius * 0.34;
      this.escortLocal.push({ x: sx, y: sy });
      drawSoldier(g, sx, sy, 0.62, ENEMY_TEAM);
    }
    return g;
  }

  /** 随行小兵的世界坐标（击败吸收演出用）。 */
  escortWorldPoints(): Array<{ x: number; y: number }> {
    return this.escortLocal.map((p) => ({ x: this.x + p.x, y: this.y + p.y }));
  }

  get radius(): number {
    return this.size / 2;
  }

  /**
   * 敌人始终保持「红边白字 + 红色威胁环」——不再用绿色提示可击败
   * （玩家通过引导箭头判断攻击目标，敌人统一呈现为危险红色）。
   * 保留方法签名以兼容场景每帧调用。
   */
  refreshThreat(_heroPower: number): void {
    if (this.defeatable !== null) return;
    this.defeatable = false;
    this.ring.setStrokeStyle(4, 0xe74c3c);
  }

  /** 推荐目标引导：被引导时持续轻微脉冲。 */
  setGuided(on: boolean): void {
    if (on === this.guided) return;
    this.guided = on;
    if (on) {
      this.scene.tweens.add({
        targets: this.sprite,
        scale: { from: this.baseScale, to: this.baseScale * 1.12 },
        duration: 420,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.inOut',
      });
    } else {
      this.scene.tweens.killTweensOf(this.sprite);
      this.sprite.setScale(this.baseScale);
    }
  }

  /** 被击败：缩小淡出后销毁，回调通知场景。 */
  playDefeat(onDone: () => void): void {
    this.scene.tweens.add({
      targets: this,
      scale: 0,
      alpha: 0,
      angle: 180,
      duration: 240,
      ease: 'Back.in',
      onComplete: () => {
        onDone();
        this.destroy();
      },
    });
  }

  /** 战力不足时被撞：快速闪烁警示（结束后恢复完全不透明，绝不留灰）。 */
  playBlock(): void {
    this.sprite.setAlpha(1);
    this.scene.tweens.add({
      targets: this.sprite,
      alpha: 0.4,
      duration: 90,
      yoyo: true,
      repeat: 1,
      onComplete: () => this.sprite.setAlpha(1),
    });
  }
}
