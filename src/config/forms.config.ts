// 英雄形态进化阶梯：随战力跨越阈值，外观（精灵/体型）与称号升级。
// 对应脚本：新兵→蓝刃→重甲→龙骑→巨龙战神。texture 为 Kenney Tiny Dungeon 精灵键。
export interface HeroForm {
  minPower: number;
  name: string;
  /** 进化光环/标识用主题色。 */
  color: number;
  radius: number;
  /** 精灵纹理键（PreloadScene 加载）。 */
  texture: string;
}

export const HERO_FORMS: HeroForm[] = [
  { minPower: 0, name: '新兵', color: 0x3b82f6, radius: 20, texture: 'hero_0' },
  { minPower: 15, name: '蓝刃剑士', color: 0x2980b9, radius: 22, texture: 'hero_1' },
  { minPower: 60, name: '重甲战将', color: 0x8e44ad, radius: 25, texture: 'hero_2' },
  { minPower: 150, name: '龙骑', color: 0xf39c12, radius: 28, texture: 'hero_3' },
  { minPower: 400, name: '巨龙战神', color: 0xe74c3c, radius: 32, texture: 'hero_4' },
];

/** 返回给定战力对应的最高形态索引。 */
export function formIndexForPower(power: number): number {
  let idx = 0;
  for (let i = 0; i < HERO_FORMS.length; i++) {
    if (power >= HERO_FORMS[i].minPower) idx = i;
  }
  return idx;
}
