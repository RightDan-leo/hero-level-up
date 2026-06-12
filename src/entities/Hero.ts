import Phaser from 'phaser';
import { HERO_FORMS, formIndexForPower } from '../config/forms.config';

const SPRITE_PX = 16;
/** 精灵显示直径相对形态半径的系数。 */
const DISPLAY_FACTOR = 2.6;

/**
 * 玩家英雄。使用 Kenney Tiny Dungeon 精灵，头顶蓝色战力数字。
 * 战力跨越阈值时自动进化形态（换精灵/变大 + "进化!" 反馈）。
 * 逻辑（战力/移动/形态）与表现分离。
 */
export class Hero extends Phaser.GameObjects.Container {
  power: number;
  speed: number;
  /** 当前点击移动目标，null 表示无目标（静止或键盘控制）。 */
  moveTarget: Phaser.Math.Vector2 | null = null;
  /** 形态进化回调（场景用于播放"进化!"演出）。 */
  onEvolve?: (formName: string) => void;

  private sprite: Phaser.GameObjects.Image;
  private label: Phaser.GameObjects.Text;
  private shadow: Phaser.GameObjects.Ellipse;
  private formIndex: number;
  private currentRadius: number;
  private baseScale: number;

  constructor(scene: Phaser.Scene, x: number, y: number, power: number, speed: number) {
    super(scene, x, y);
    this.power = power;
    this.speed = speed;
    this.formIndex = formIndexForPower(power);
    const form = HERO_FORMS[this.formIndex];
    this.currentRadius = form.radius;
    this.baseScale = (form.radius * DISPLAY_FACTOR) / SPRITE_PX;

    this.shadow = scene.add.ellipse(0, this.currentRadius - 2, this.currentRadius * 2.2, this.currentRadius * 0.7, 0x000000, 0.25);
    this.sprite = scene.add.image(0, 0, form.texture).setScale(this.baseScale);
    // 英雄统一「蓝边白字」
    this.label = scene.add
      .text(0, -this.currentRadius - 16, `${power}`, {
        fontSize: '26px',
        color: '#ffffff',
        fontFamily: 'Arial Black, monospace',
        fontStyle: 'bold',
        stroke: '#1d6fd6',
        strokeThickness: 6,
      })
      .setOrigin(0.5);

    this.add([this.shadow, this.sprite, this.label]);
    this.setDepth(100);
    scene.add.existing(this);
  }

  get radius(): number {
    return this.currentRadius;
  }

  /**
   * 隐藏默认人物精灵与影子（保留头顶战力数字）。
   * 宠物版用：主角本体改由 `Pet` 实体（巨龙）作为化身呈现。
   */
  setBodyHidden(hidden: boolean): void {
    this.sprite.setVisible(!hidden);
    this.shadow.setVisible(!hidden);
  }

  get formName(): string {
    return HERO_FORMS[this.formIndex].name;
  }

  /** 当前形态索引（0..4）——变体（宠物/士兵）同步成长用。 */
  get form(): number {
    return this.formIndex;
  }

  /** 设置战力并刷新数字，带一次放大回弹反馈，并检查是否进化。 */
  setPower(value: number): void {
    this.power = value;
    this.label.setText(`${value}`);
    this.scene.tweens.add({
      targets: this.label,
      scale: { from: 1.6, to: 1 },
      duration: 260,
      ease: 'Back.out',
    });
    this.checkEvolve();
  }

  /** 命中弱敌时的轻微撞击反馈。 */
  playHitPop(): void {
    this.scene.tweens.add({
      targets: this.sprite,
      scale: { from: this.baseScale * 1.25, to: this.baseScale },
      duration: 180,
      ease: 'Quad.out',
    });
  }

  private checkEvolve(): void {
    const next = formIndexForPower(this.power);
    if (next <= this.formIndex) return;
    this.formIndex = next;
    const form = HERO_FORMS[next];
    this.currentRadius = form.radius;
    this.baseScale = (form.radius * DISPLAY_FACTOR) / SPRITE_PX;

    this.sprite.setTexture(form.texture);
    this.shadow.setSize(form.radius * 2.2, form.radius * 0.7);
    this.shadow.y = form.radius - 2;
    this.label.y = -form.radius - 16;

    this.scene.tweens.add({
      targets: this.sprite,
      scale: { from: this.baseScale * 1.5, to: this.baseScale },
      duration: 360,
      ease: 'Back.out',
    });
    this.onEvolve?.(form.name);
  }
}
