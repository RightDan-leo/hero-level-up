import Phaser from 'phaser';
import { BootScene } from '../scenes/BootScene';
import { PreloadScene } from '../scenes/PreloadScene';
import { MainMenuScene } from '../scenes/MainMenuScene';
import { GameScene } from '../scenes/GameScene';
import { GAME_VIEW } from './view';

export { GAME_VIEW };

export const GAME_CONFIG: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  width: GAME_VIEW.WIDTH,
  height: GAME_VIEW.HEIGHT,
  parent: 'game-container',
  backgroundColor: '#3a5a40',
  pixelArt: true,
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    min: { width: 270, height: 480 },
    max: { width: 1080, height: 1920 },
  },
  scene: [BootScene, PreloadScene, MainMenuScene, GameScene],
};

export const GAME_CONSTANTS = {
  SCENES: {
    BOOT: 'BootScene',
    PRELOAD: 'PreloadScene',
    MAIN_MENU: 'MainMenuScene',
    GAME: 'GameScene',
  },
  ASSETS: {
    BASE_PATH: '/assets/',
    IMAGES: '/assets/images/',
    AUDIO: '/assets/audio/',
    FONTS: '/assets/fonts/',
  },
} as const;
