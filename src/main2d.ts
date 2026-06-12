import Phaser from 'phaser';
import { GAME_CONFIG } from './config/game.config';

// 2D 四版本（经典/宠物/士兵/驯兽师）独立入口 —— 主菜单可选版本。
// 与 3D 版共用 src/config/level.map.json 同一张地图，互不干扰，各自独立打包。
new Phaser.Game(GAME_CONFIG);
