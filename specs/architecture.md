# 项目框架与模块边界（三版本：共享 / 独立 指南）

> 单一事实来源。新增/修改任何功能前，先用本文件判断「通用修改」还是「某版本修改」，并落到正确的层，避免三版互相污染。

## 0. 三个版本

| 版本 | id | 成长爽点 | 专属内容 |
|------|----|----------|----------|
| 经典版 | `classic` | 主角外观 + 武器进化 | 无（基准） |
| 宠物版 | `pet` | 化身巨龙 · 越战越强进化 | 主角本体=`Pet`（巨龙化身，隐藏人物精灵）；进化称号/横幅换龙主题；宝箱=进化石文案 |
| 士兵版 | `army` | 随从数量越打越多 | `ArmySquad`（我方蓝兵）；敌人带红兵；宝箱=兵团文案 |
| 驯兽师版 | `tamer` | 人宠并肩 · 双线进化 | 主角=人物（经典精灵进化）+ 开局「收服宠物」演出 + `Pet` 伴随模式（与主角同步进化）；宝箱=驯兽符文文案 |

**三版共用同一套地图**（路网/守卫/Boss/数值链/CTA/龙技收尾），其余各自独立、互不影响。

> ⚠️ **已移除：二选一装备门（2026-06-11，通用修改）**——原「战力越阈值即自动弹二选一装备卡」的设计已全部删除（击败敌人本身不再触发二选一）。成长只来自「大吃小吸收」与「守卫死路宝箱」。`EquipGateOverlay` UI 保留，仅供**宝箱**二选一使用。

## 1. 顶层架构

- **单一 `GameScene`，按 `variant` 参数化**：`scene.start('GameScene', { variant })` → `GameScene.init()` 读取，`this.variantSpec` 决定差异。
- 入口流：`BootScene → PreloadScene → MainMenuScene（选版本三按钮）→ GameScene({variant})`。
- 差异通过**变体策略对象 `VariantSpec`** 暴露；`GameScene` 用少量 `variantSpec.hasX` 守卫接线 + 加载变体专属实体。

## 2. 模块分层（改动影响范围）

### A. 共享层 SHARED（改这里 = 同时影响三版 → 视为「通用修改」）

| 文件 | 职责 |
|------|------|
| `config/level.map.json` | **地图数据唯一事实来源**（四版共用）：world/hero、waypoints、edges(含 blocker 挡路怪)、decor、chests、boss、companion。可用可视化编辑器读写 |
| `config/level.config.ts` | 读取 `level.map.json` 派生类型化的 `WP`/`LEVEL_EDGES`/`M1_LEVEL`/敌人，并保留 `CTA`（导出形状不变） |
| `tools/map-editor/`（dev 工具） | 可视化地图编辑器（Vite 插件 `plugin.ts` + `client.html`），dev 时 `/__mapedit/` 拖拽节点/怪物、改数值、保存回写 JSON → 游戏 HMR |
| `config/forms.config.ts` | 主角形态阶梯（战力→形态索引）；宠物/士兵成长也复用此曲线 |
| `config/view.ts`、`config/game.config.ts` | 视图尺寸、Phaser 配置、场景注册、场景 key 常量 |
| `systems/PathGraph.ts` | 通道图（投影/Dijkstra），约束移动 |
| `systems/EquipGateOverlay.ts` | 二选一弹窗 UI（**仅宝箱**使用；装备门已移除） |
| `systems/DragonUltimate.ts` | 巨龙登场特效（M11 击败 Boss 后解锁演出复用） |
| `entities/Hero.ts` `Boss.ts` `Chest.ts` `Companion.ts` `Pickup.ts` | 三版通用实体 |
| `utils/sfx.ts` `feedback.ts` `ui.ts` | 音效、浮字/点击反馈、UI 工具 |
| `utils/soldier.ts` | 小兵画法（我方/敌方共用，仅士兵版调用，但本身与变体无关） |

### B. 变体配置层（差异的唯一声明处）

| 文件 | 职责 |
|------|------|
| `config/variants.ts` | `VariantId` / `VariantSpec` / `VARIANTS` 注册表。**所有版本差异的开关与文案都在这里声明**：`hasPet / hasArmy / enemiesHaveSoldiers / chestTitle / relabelChestOption / 菜单文案 / available` |

### C. 变体专属实体（只属于某一版本，SHARED 不得引用）

| 文件 | 属于 |
|------|------|
| `entities/Pet.ts` | 仅宠物版 |
| `entities/ArmySquad.ts`（含 `soldierCountForPower`） | 仅士兵版 |

### D. 编排层（读取 variantSpec，把差异接进流程）

| 文件 | 变体相关职责 |
|------|--------------|
| `scenes/GameScene.ts` | 读取 `variantSpec`；`hasPet/hasArmy` 时创建 `Pet`/`ArmySquad`；`enemiesHaveSoldiers` 时给敌人传 `escortCount`；宝箱用 `chestTitle/relabelChestOption` 换皮；进化时同步宠物 |
| `scenes/MainMenuScene.ts` | 读取 `VARIANTS` 渲染三按钮，`start('GameScene', { variant })` |

### E. 共享实体上的「opt-in 变体钩子」（唯一允许的例外）

| 钩子 | 说明 |
|------|------|
| `Enemy.escortCount`（构造参数，默认 0） | 士兵版传 >0 画红兵；经典/宠物版传 0 → 行为与原来完全一致。**派生逻辑 `escortCountForPower` 由 GameScene 调用，Enemy 本身不感知 variant** |

## 3. 安全边界规则（红线）

1. **SHARED 文件禁止 import 变体代码**：不得引用 `Pet` / `ArmySquad` / `variants.ts` 的具体分支。（`utils/soldier.ts` 是通用画法，不算变体代码。）
2. **变体差异只能经 `VariantSpec` 暴露**：新增差异点 → 先在 `VariantSpec` 加字段，再在 `GameScene` 用 `this.variantSpec.xxx` 守卫接线。禁止在 `GameScene` 里写 `if (this.variant === 'pet')` 这种硬编码分支（用能力位 `hasPet` 等）。
3. **变体专属实体不被 SHARED 引用**：`Pet`/`ArmySquad` 只能被 `GameScene` 在守卫内创建。
4. **共享数值/地图/数值链的任何改动 = 通用修改**，默认三版同时受影响；若只想改某一版的数值，必须新增 variant 覆盖机制（见下「待建机制」），不要直接改 `level.config.ts` 的共享数值。
5. **新增变体专属实体时**：放 `entities/`，由 `GameScene` 在 `spawnLevel/update` 的 `hasX` 守卫里管理生命周期（create/follow/destroy 配套）。

## 4. 当前隔离状态核查

- ✅ 共享层无任何对变体的依赖（grep 确认 `variant/Pet/ArmySquad` 仅出现在 `GameScene / variants / MainMenuScene / Pet / ArmySquad / Enemy(opt-in)`）。
- ✅ `GameScene` 中变体接触点共 ~8 处，均以 `variantSpec.hasX` 守卫，集中在 init/create/update/spawnLevel/openChest/playEvolve。
- ✅ `tsc`/`build` 通过；经典版传 escort=0、不建 Pet/Squad，行为与改造前一致。
- ⚠️ **已知「共享但未按版本换皮」项**（功能安全，仅观感）：
  - 装备门文案（铁甲/骑士铠）三版相同 —— 用户目前只要求宝箱换皮，保留。
  - 宝箱/守卫/Boss 的**数值**三版相同（共享数值链）。
  - 如需按版本区分以上内容，走「待建机制」，不要直接改共享文件。

## 5. 待建机制（按需再做，不提前过度设计）

- **per-variant 数值/文案覆盖**：在 `VariantSpec` 增加可选 `overrides`（如 `bossPower?`、`gateRelabel?`），`GameScene` 读取时 `variantSpec.bossPower ?? M1_LEVEL.boss.power`。届时再加。
- **变体逻辑膨胀时**：若 `GameScene` 内变体分支变多，抽出 `VariantController` 接口（`onSpawn/onUpdate/onEvolve/onChest`），每版一个实现，`GameScene` 只持有一个 controller。当前规模无需。

## 6. 如何新增一个版本（清单）

1. `variants.ts`：加一个 `VariantId` + `VARIANTS` 条目（能力位 + 文案 + `available`）。
2. 需要新随从/表现 → 在 `entities/` 加专属实体。
3. `GameScene`：在 `spawnLevel`/`update`/`playEvolve` 的 `hasX` 守卫里接入；宝箱/装备门换皮走 `variantSpec`。
4. 菜单自动出现按钮（`MainMenuScene` 遍历 `VARIANTS`）。
5. 共享地图/数值**不动**。

## 7. 协作流程：每次需求先定性

收到需求时，先判定并（必要时）与用户确认归类：

- **通用修改（SHARED）**：地图、路网、数值链、Boss/龙技、输入/镜头/背景、HUD（如返回/喇叭按钮）、音效、引导、宝箱机制。→ 改共享层，三版同步生效。
- **某版本修改（VARIANT）**：只动该版本的成长表现、随从、宝箱皮肤、专属演出。→ 改 `variants.ts` 能力位/文案 + 该版本专属实体 + `GameScene` 守卫接线；**不得**影响其他版本。
- 当一句话需求可能横跨两类（如"让宠物版的 Boss 更弱"= 变体数值覆盖），先确认归类，再决定是否需要「待建机制」。

> 约定：后续每次需求，我会先回一句「这是通用修改 / 还是某版本修改？」来确认落点，再动手。
