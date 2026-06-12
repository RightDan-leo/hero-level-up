# 项目状态

> 本文件由 AI 在每次 Session 结束时维护，用于跨 Session 恢复上下文。

## 项目信息

- **项目名称**：hero-level-up
- **技术栈**：Three.js + TypeScript + Vite（3D 重构；旧 2D Phaser 代码保留在 src/ 但入口已切换、不再引用）
- **游戏类型**：3D
- **当前产品**：士兵版 3D 可玩广告（spec：`specs/game-3d-army.spec.md`）
- **项目路径**：d:\Projects\Codex\hero-level-up
- **启动命令**：`npm run dev`

## 当前阶段

**阶段：3D 原型可玩 + 地图已复刻 2D 全图（M17.0–M17.3 + 图约束关卡已实现并验证）**

## 最近 Session

### 2026-06-12（Session 3：地图复刻 + 编辑器复用）

**完成内容**：
- **3D 地图复刻为 2D 全图**：3D 直接读取共享的 `src/config/level.map.json`（24 节点 / 27 边 / 16 挡路怪 / 5 装饰 / 3 宝箱 / Boss400），2D 俯视坐标 `(x,y)` 经 `toWorld`（scale 0.04）映射到 3D 地面 `(x,z)`。
- 移植 `src/game/PathGraph.ts`（去 Phaser，增边锁定 + 避锁最短路）；`gameConfig.ts` 改读地图 JSON 并派生 waypoints/edges/blockers/decor/chests/boss。
- 重写 `Game.ts` 为**图约束玩法**：路网地面带渲染（锁定边红色）、节点圆盘、隘口红编队（复用士兵模型，按战力派生兵数/阶级）、装饰怪（不可达）、宝箱实体（守卫清除→可达即开箱取较高奖励）、Boss。
- 移动改为**沿图路由**：点击编队→走到可达端点→交战；胜则解锁该边并跨越到对侧；点空地导航到最近可达节点；封死守卫（4000/6000）保持锁定不可通过。
- **地图编辑器 100% 复用**：3D 与 2D 共用同一份 `level.map.json`，现有 `/__mapedit/`（vite 插件）读写即对 3D 生效，保存触发 HMR。新增 `scripts/sim-map.mjs` 一键校验改图后仍可通关。
- 验证：`tsc`/`vite build` 通过（gzip 141KB）；Node 模拟 + 浏览器内 `window.game.debug` 双重确认——初始 16 边锁定、推图 1→1522、士兵 1→30、三阶进化、3 宝箱、仅余 2 封死守卫、Boss 可达可破；DOM 标签集合与 2D 全图战力一致。

### 2026-06-12（Session 2）

**完成内容**：
- 选定士兵版为唯一上线产品，产出 3D 版 spec（`game-3d-army.spec.md`）：模型种类 ≤5、士兵越打越多、蓝红兵团对撞、敌兵复用士兵模型换红材质。
- 2D→3D 重构：入口 `src/main.ts` 切 Three.js；新增 `src/game/`（Game/Hero/Squad/EnemyFormation/Boss/Hud/models/labels/sfx）+ `src/config/gameConfig.ts` + `src/config/data/{army,level}.json`。
- 实现核心循环：raycast 点击进攻、大吃小吸收、士兵数量 3→22 增长、3 阶换模型（新兵→重装→精锐）、敌军收编、相机跟随、DOM HUD + CSS2D 战力标签、程序化音效、Boss 决战 + 巨龙觉醒演出 + CTA。
- 战斗结算重构为「逻辑同步生效 + 动画仅表现」，更健壮且可确定性验证。
- `tsc`/`vite build` 通过（包体 gzip 138KB）；CDP 实测战力 5→215、士兵 3→22、阶级新兵→重装→精锐、Boss 可击败、CTA 弹出，全部与 spec 数值一致。

**未完成**：
- M17.4 art-browser 接入真实 GLB（≤5 角色模型 + 巨龙）替换程序化占位。
- M17.5 竖屏适配 + 性能优化（士兵转 InstancedMesh）+ 投放包构建。
- 吸收动画目前只缩放并队，红→蓝变色过渡待加。
- 路网/节点目前为简单地面带+圆盘，可进一步美化（隘口栅栏、封死路障等）。

## 下次要做

- [ ] M17.4：art-browser 下载 low-poly GLB（指挥官/士兵 3 阶/Boss/巨龙）替换占位
- [ ] M17.5：竖屏相机/UI 适配 + InstancedMesh + 投放包（必要时单文件内联）
- [ ] 吸收动画红→蓝材质过渡 + 隘口/封死路障美化

## 已知问题

- 嵌入式浏览器后台标签页会暂停 `requestAnimationFrame`（动画/相机/阵型不推进）——仅影响自动化测试，前台真机正常。
- 本机偶发：dev server 运行约 1 分钟后被外部进程结束（端口 5173），需要时重启 `npm run dev`。

## 里程碑

| 阶段 | 目标 | 状态 |
|------|------|------|
| 环境搭建 | 项目框架和工具链 | ✅ 完成 |
| 构思 | 确定游戏类型和核心玩法 | 🔲 未开始 |
| 设计 | 游戏设计 spec | 🔲 未开始 |
| 原型 | 最小可玩版本 | 🔲 未开始 |
| 迭代 | 核心玩法打磨 | 🔲 未开始 |
| 打磨 | 美术/音效/手感 | 🔲 未开始 |
| 发布 | 构建部署（说「部署游戏」启动） | 🔲 未开始 |
