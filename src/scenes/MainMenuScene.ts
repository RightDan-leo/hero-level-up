import Phaser from 'phaser';
import { GAME_CONSTANTS } from '../config/game.config';
import { VARIANTS, type VariantId } from '../config/variants';

export class MainMenuScene extends Phaser.Scene {
  constructor() {
    super({ key: GAME_CONSTANTS.SCENES.MAIN_MENU });
  }

  create(): void {
    const { width, height } = this.cameras.main;
    const cx = width / 2;

    this.add.text(cx, 96, '战力觉醒岛', {
      fontSize: '52px',
      color: '#f1c40f',
      fontFamily: 'Arial Black, monospace',
      fontStyle: 'bold',
      stroke: '#08203a',
      strokeThickness: 7,
    }).setOrigin(0.5);

    this.add.text(cx, 156, '击败弱敌 · 吸收战力 · 滚雪球变强', {
      fontSize: '17px',
      color: '#e8f5e9',
      fontFamily: 'monospace',
    }).setOrigin(0.5);

    this.add.text(cx, 226, '选择版本', {
      fontSize: '20px',
      color: '#ffffff',
      fontFamily: 'Arial Black, monospace',
      fontStyle: 'bold',
    }).setOrigin(0.5);

    const order: VariantId[] = ['classic', 'pet', 'army', 'tamer'];
    order.forEach((id, i) => this.buildVariantButton(cx, 296 + i * 98, VARIANTS[id].id));

    this.add.text(width - 10, height - 10, 'v0.2.0', {
      fontSize: '14px',
      color: '#888888',
    }).setOrigin(1, 1);
  }

  private buildVariantButton(cx: number, cy: number, id: VariantId): void {
    const spec = VARIANTS[id];
    const w = 340;
    const h = 86;
    const enabled = spec.available;

    const card = this.add.container(cx, cy);
    const bg = this.add.graphics();
    bg.fillStyle(enabled ? 0x16213e : 0x23232e, 0.96);
    bg.fillRoundedRect(-w / 2, -h / 2, w, h, 16);
    bg.lineStyle(3, enabled ? 0x2ecc71 : 0x555566, 1);
    bg.strokeRoundedRect(-w / 2, -h / 2, w, h, 16);
    card.add(bg);

    const title = this.add
      .text(-w / 2 + 24, -16, spec.menuTitle, {
        fontSize: '26px',
        color: enabled ? '#ffffff' : '#9a9aa6',
        fontFamily: 'Arial Black, monospace',
        fontStyle: 'bold',
      })
      .setOrigin(0, 0.5);
    card.add(title);

    const desc = this.add
      .text(-w / 2 + 24, 18, spec.menuDesc, {
        fontSize: '15px',
        color: enabled ? '#b9e6c9' : '#7d7d8a',
        fontFamily: 'monospace',
      })
      .setOrigin(0, 0.5);
    card.add(desc);

    const badge = this.add
      .text(w / 2 - 22, 0, enabled ? '▶' : '🔒', {
        fontSize: '26px',
        color: enabled ? '#2ecc71' : '#777',
      })
      .setOrigin(0.5);
    card.add(badge);

    if (!enabled) return;

    const hit = this.add.rectangle(0, 0, w, h, 0xffffff, 0).setInteractive({ useHandCursor: true });
    card.add(hit);
    hit.on('pointerover', () => card.setScale(1.04));
    hit.on('pointerout', () => card.setScale(1));
    hit.on('pointerdown', () => this.scene.start(GAME_CONSTANTS.SCENES.GAME, { variant: id }));
  }
}
