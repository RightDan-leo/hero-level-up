import Phaser from 'phaser';

/** 队伍配色。 */
export const ALLY_TEAM = 0x2e74d6;
export const ENEMY_TEAM = 0xc0392b;

/**
 * 在给定 Graphics 上以 (x,y) 为脚底中心绘制一个小兵（s=1 约 18px 高）。
 * 主角士兵小队与敌人随行小兵共用此画法，仅队伍配色不同。
 */
export function drawSoldier(g: Phaser.GameObjects.Graphics, x: number, y: number, s: number, team: number): void {
  const dark = Phaser.Display.Color.IntegerToColor(team).darken(30).color;
  // 影子
  g.fillStyle(0x000000, 0.22);
  g.fillEllipse(x, y + 7 * s, 13 * s, 4 * s);
  // 长矛
  g.fillStyle(0xcfd2d6, 1);
  g.fillRect(x + 5.2 * s, y - 12 * s, 1.6 * s, 18 * s);
  g.fillStyle(0xe9edf2, 1);
  g.fillTriangle(x + 4.4 * s, y - 12 * s, x + 6.8 * s, y - 12 * s, x + 6 * s, y - 16 * s);
  // 身体
  g.fillStyle(team, 1);
  g.fillRoundedRect(x - 5 * s, y - 4 * s, 10 * s, 11 * s, 3 * s);
  // 头
  g.fillStyle(0xf3c98b, 1);
  g.fillCircle(x, y - 7 * s, 3.8 * s);
  // 头盔
  g.fillStyle(team, 1);
  g.fillRoundedRect(x - 4.6 * s, y - 11.5 * s, 9.2 * s, 4.4 * s, 2 * s);
  g.fillStyle(dark, 1);
  g.fillRect(x - 0.8 * s, y - 13.6 * s, 1.6 * s, 2.4 * s);
  // 盾牌
  g.fillStyle(dark, 1);
  g.fillCircle(x - 6.2 * s, y + 1 * s, 3.4 * s);
  g.fillStyle(0xffe082, 1);
  g.fillCircle(x - 6.2 * s, y + 1 * s, 1.2 * s);
}
