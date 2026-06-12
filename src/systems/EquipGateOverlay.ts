import Phaser from 'phaser';
import { GAME_VIEW } from '../config/view';

export interface EquipOption {
  label: string;
  bonus: number;
  stars: number;
}

/**
 * 二选一装备门遮罩。冻结场景，弹出两张装备卡（低星 vs 高星），
 * 玩家点击其一 → 回调返回所选项索引，随后自毁。
 */
export class EquipGateOverlay {
  private container: Phaser.GameObjects.Container;

  constructor(
    scene: Phaser.Scene,
    title: string,
    options: EquipOption[],
    onPick: (index: number) => void,
  ) {
    const { WIDTH, HEIGHT } = GAME_VIEW;
    const cx = WIDTH / 2;
    const cy = HEIGHT / 2;

    // scrollFactor(0)：固定屏幕中心，不随滚动镜头偏移
    this.container = scene.add.container(0, 0).setDepth(2000).setScrollFactor(0);

    // 注意：scrollFactor 必须直接设在“可交互对象”上，否则相机滚动后
    // 渲染(随父容器 sf0 固定屏幕)与输入命中区(子对象 sf1 仍在世界坐标)
    // 会错位，导致点击卡牌无反应。dim 拦截穿透点击，同样固定屏幕。
    const dim = scene.add
      .rectangle(cx, cy, WIDTH, HEIGHT, 0x000000, 0.62)
      .setScrollFactor(0)
      .setInteractive();
    this.container.add(dim);

    const titleText = scene.add
      .text(cx, cy - 170, title, {
        fontSize: '26px',
        color: '#ffe082',
        fontFamily: 'Arial Black, monospace',
        fontStyle: 'bold',
        stroke: '#000000',
        strokeThickness: 5,
      })
      .setOrigin(0.5);
    this.container.add(titleText);

    const cardW = 200;
    const cardH = 240;
    const gap = 28;
    const totalW = options.length * cardW + (options.length - 1) * gap;
    const startX = cx - totalW / 2 + cardW / 2;

    options.forEach((opt, i) => {
      const x = startX + i * (cardW + gap);
      const card = this.buildCard(scene, x, cy, cardW, cardH, opt, () => {
        onPick(i);
        this.destroy();
      });
      this.container.add(card);
    });
  }

  private buildCard(
    scene: Phaser.Scene,
    x: number,
    y: number,
    w: number,
    h: number,
    opt: EquipOption,
    onClick: () => void,
  ): Phaser.GameObjects.Container {
    const card = scene.add.container(x, y);
    const strong = opt.stars >= 3;
    const border = strong ? 0xf1c40f : 0x9b59b6;

    const bg = scene.add.graphics();
    bg.fillStyle(0x1a1a3e, 0.98);
    bg.fillRoundedRect(-w / 2, -h / 2, w, h, 14);
    bg.lineStyle(4, border, 1);
    bg.strokeRoundedRect(-w / 2, -h / 2, w, h, 14);
    card.add(bg);

    // 占位装备图标
    const icon = scene.add
      .rectangle(0, -36, 76, 76, strong ? 0xe67e22 : 0x7f8c9b)
      .setStrokeStyle(3, 0xffffff)
      .setAngle(45);
    card.add(icon);

    const bonusText = scene.add
      .text(0, 48, `+${opt.bonus}`, {
        fontSize: '40px',
        color: strong ? '#f1c40f' : '#d6b3ff',
        fontFamily: 'Arial Black, monospace',
        fontStyle: 'bold',
        stroke: '#000000',
        strokeThickness: 5,
      })
      .setOrigin(0.5);
    card.add(bonusText);

    const stars = scene.add
      .text(0, 96, '★'.repeat(opt.stars), {
        fontSize: '22px',
        color: '#ffe082',
      })
      .setOrigin(0.5);
    card.add(stars);

    const labelText = scene.add
      .text(0, -h / 2 + 22, opt.label, {
        fontSize: '16px',
        color: '#ffffff',
        fontFamily: 'monospace',
        fontStyle: 'bold',
      })
      .setOrigin(0.5);
    card.add(labelText);

    const hit = scene.add
      .rectangle(0, 0, w, h, 0xffffff, 0)
      .setScrollFactor(0)
      .setInteractive({ useHandCursor: true });
    card.add(hit);

    hit.on('pointerover', () => card.setScale(1.05));
    hit.on('pointerout', () => card.setScale(1));
    hit.on('pointerdown', onClick);

    if (strong) {
      scene.tweens.add({
        targets: bg,
        alpha: { from: 1, to: 0.7 },
        duration: 600,
        yoyo: true,
        repeat: -1,
      });
    }
    return card;
  }

  destroy(): void {
    this.container.destroy();
  }
}
