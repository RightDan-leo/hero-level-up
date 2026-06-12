import Phaser from 'phaser';
import { GAME_CONSTANTS } from '../config/game.config';

export class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: GAME_CONSTANTS.SCENES.BOOT });
  }

  create(): void {
    this.registry.set('score', 0);
    this.registry.set('level', 1);
    this.registry.set('lives', 3);
    this.scene.start(GAME_CONSTANTS.SCENES.PRELOAD);
  }
}
