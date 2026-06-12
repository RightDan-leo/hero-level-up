import Phaser from 'phaser';
import { GAME_CONSTANTS } from '../config/game.config';

export class PreloadScene extends Phaser.Scene {
  constructor() {
    super({ key: GAME_CONSTANTS.SCENES.PRELOAD });
  }

  preload(): void {
    const { width, height } = this.cameras.main;
    const cx = width / 2;
    const cy = height / 2;

    const box = this.add.graphics();
    box.fillStyle(0x222222, 0.8);
    box.fillRect(cx - 160, cy - 25, 320, 50);

    const bar = this.add.graphics();
    const text = this.add.text(cx, cy - 50, '加载中...', {
      fontSize: '20px',
      color: '#ffffff',
    }).setOrigin(0.5);

    this.load.on('progress', (v: number) => {
      bar.clear();
      bar.fillStyle(0x00ff00, 1);
      bar.fillRect(cx - 150, cy - 15, 300 * v, 30);
    });

    this.load.on('complete', () => {
      bar.destroy();
      box.destroy();
      text.destroy();
    });

    this.loadAssets();
  }

  create(): void {
    this.scene.start(GAME_CONSTANTS.SCENES.MAIN_MENU);
  }

  private loadAssets(): void {
    // Kenney Tiny Dungeon（CC0）2D 精灵
    const base = 'assets/sprites';
    this.load.image('hero_0', `${base}/hero_0.png`);
    this.load.image('hero_1', `${base}/hero_1.png`);
    this.load.image('hero_2', `${base}/hero_2.png`);
    this.load.image('hero_3', `${base}/hero_3.png`);
    this.load.image('hero_4', `${base}/hero_4.png`);
    this.load.image('enemy_ghost', `${base}/enemy_ghost.png`);
    this.load.image('enemy_crab', `${base}/enemy_crab.png`);
    this.load.image('enemy_beast', `${base}/enemy_beast.png`);
    this.load.image('enemy_beetle', `${base}/enemy_beetle.png`);
    this.load.image('enemy_spider', `${base}/enemy_spider.png`);
    this.load.image('enemy_ogre', `${base}/enemy_ogre.png`);
    this.load.image('boss_skull', `${base}/boss_skull.png`);
    this.load.image('companion', `${base}/companion.png`);
    this.load.image('pickup_potion', `${base}/pickup_potion.png`);
  }
}
