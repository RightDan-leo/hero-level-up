import type { EquipOption } from '../systems/EquipGateOverlay';

/**
 * 可玩广告的三个版本变体。三版**共用同一套地图**（level.config 的路网 / 守卫 /
 * 装备门 / Boss / CTA / 数值链），仅通过本「变体策略」注入差异，互不影响：
 *  - classic 经典版：主角外观 + 武器进化（当前版本）。
 *  - pet     宠物版：开局获得宠物，随主角战力同步进化；宝箱 = 宠物进化石。
 *  - army    士兵版：开局 1 名士兵，战力越高随从越多；敌人也带兵。
 */
export type VariantId = 'classic' | 'pet' | 'army' | 'tamer';

export interface VariantSpec {
  id: VariantId;
  /** 主菜单按钮主标题。 */
  menuTitle: string;
  /** 主菜单按钮副标题。 */
  menuDesc: string;
  /** 是否已实现可玩（未实现的在菜单标注"即将上线"）。 */
  available: boolean;
  /** 是否带进化宠物实体。 */
  hasPet: boolean;
  /** 宠物是否作为主角化身（隐藏人物精灵、居中）；false=身侧伴随宠物（主角仍是人物）。 */
  petAvatar?: boolean;
  /** 开局是否播放「获得宠物」演出（驯兽师版）。 */
  petIntro?: boolean;
  /** 主角是否带可增长的士兵随从。 */
  hasArmy: boolean;
  /** 敌人是否携带随行小兵（仅士兵版观感）。 */
  enemiesHaveSoldiers: boolean;
  /** 宝箱弹窗标题（覆盖共享地图里的标题）。 */
  chestTitle?: string;
  /** 依据宝物（星级/索引）改写宝箱选项文案——数值不变，仅换皮。 */
  relabelChestOption?: (opt: EquipOption, chestIndex: number) => string;
  /** 进化称号改写：按形态索引（0..4）返回符合本版本主题的名称。 */
  formName?: (formIndex: number) => string;
  /** 进化横幅标题（覆盖默认「⚡ 形态进化 ⚡」）。 */
  evolveTitle?: string;
}

const PET_STONE_BY_STARS: Record<number, string> = {
  2: '幼龙进化石',
  3: '远古进化石',
};

// 宠物（巨龙化身）5 阶称号，与 entities/Pet.ts 的 STAGES 名称保持一致。
const PET_FORM_NAMES = ['幼龙', '翼龙', '角龙', '烈焰龙', '远古真龙'];

export const VARIANTS: Record<VariantId, VariantSpec> = {
  classic: {
    id: 'classic',
    menuTitle: '经典版',
    menuDesc: '主角外观 + 武器进化',
    available: true,
    hasPet: false,
    hasArmy: false,
    enemiesHaveSoldiers: false,
  },
  pet: {
    id: 'pet',
    menuTitle: '宠物版',
    menuDesc: '化身巨龙 · 越战越强进化',
    available: true,
    hasPet: true,
    petAvatar: true,
    hasArmy: false,
    enemiesHaveSoldiers: false,
    chestTitle: '宠物进化 · 二选一',
    relabelChestOption: (opt) => PET_STONE_BY_STARS[opt.stars] ?? '宠物进化石',
    formName: (i) => PET_FORM_NAMES[i] ?? PET_FORM_NAMES[PET_FORM_NAMES.length - 1],
    evolveTitle: '🐉 宠物进化 🐉',
  },
  tamer: {
    id: 'tamer',
    menuTitle: '驯兽师版',
    menuDesc: '收服宠物 · 人宠并肩进化',
    available: true,
    hasPet: true,
    petAvatar: false,
    petIntro: true,
    hasArmy: false,
    enemiesHaveSoldiers: false,
    chestTitle: '驯兽强化 · 二选一',
    relabelChestOption: (opt) => (opt.stars >= 3 ? '远古兽印' : '野性符文'),
  },
  army: {
    id: 'army',
    menuTitle: '士兵版',
    menuDesc: '随从越打越多 · 兵团碾压',
    available: true,
    hasPet: false,
    hasArmy: true,
    enemiesHaveSoldiers: true,
    chestTitle: '兵团扩编 · 二选一',
    relabelChestOption: (opt) => (opt.stars >= 3 ? '精锐兵团' : '新兵营帐'),
  },
};

export const DEFAULT_VARIANT: VariantId = 'classic';
