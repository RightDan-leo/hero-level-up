import type { EquipOption } from '../systems/EquipGateOverlay';
import type { GraphNode, GraphEdge } from '../systems/PathGraph';
import mapJson from './level.map.json';

/** 敌人在路线中的角色：path=主干挡路怪(计入清场)，optional=岔路可选敌，guard=死路守卫。 */
export type EnemyRole = 'path' | 'optional' | 'guard';

export interface BlockerSpec {
  power: number;
  texture?: string;
  role?: EnemyRole;
  /** 在边上的位置参数 0..1（默认 0.5 中点）。 */
  at?: number;
}

export interface LevelEdge {
  a: string;
  b: string;
  /** 该边隘口的挡路怪（占满通道、击败前不可通过）。 */
  blocker?: BlockerSpec;
}

export interface EnemySpawn {
  x: number;
  y: number;
  power: number;
  texture?: string;
  role: EnemyRole;
}

export interface DecorEnemySpawn {
  x: number;
  y: number;
  power: number;
  texture?: string;
}

export interface PickupSpawn {
  x: number;
  y: number;
  amount: number;
}

/** 宝箱：被守卫怪把守，击败守卫后点击开启 → 二选一获得宝物。 */
export interface ChestSpawn {
  x: number;
  y: number;
  /** 把守此宝箱的守卫怪战力（用于与已击败的 guard 敌人关联解锁）。 */
  guardPower: number;
  title: string;
  options: EquipOption[];
}

export interface BossSpawn {
  x: number;
  y: number;
  power: number;
}

export interface CompanionSpawn {
  x: number;
  y: number;
}

// 结尾转化配置
export const CTA = {
  storeUrl: 'https://play.google.com/store/apps/details?id=com.allstarunion.beneoutland',
  title: '巨龙之力 已解锁！',
  tagline: '下载游戏，释放觉醒巨龙，终结整个战场',
} as const;

// ── 地图数据：来源于 src/config/level.map.json ────────────────────────────────
// ⚠️ 该 JSON 是「地图」唯一事实来源（四个版本共用），可用可视化编辑器读写：
//    dev 模式下访问 http://localhost:5173/__mapedit/ 拖拽节点/怪物、改数值、一键保存回写。
// 数值链（纯「大吃小」滚雪球）：上行主路怪升序，满足 p_k ≤ 1+Σ_{i<k}p_i（起始 1），全程可解；
// 守卫/封死/装饰怪为可选或观感，不破坏主路解。修改后务必保持升序可解性。
interface MapData {
  world: { width: number; height: number };
  hero: { startWaypoint: string; startPower: number; speed: number };
  waypoints: { id: string; x: number; y: number }[];
  edges: { a: string; b: string; blocker?: { power: number; texture?: string; role?: string; at?: number } }[];
  decor: { x: number; y: number; power: number; texture?: string }[];
  chests: { waypoint: string; guardPower: number; title: string; options: EquipOption[] }[];
  boss: { waypoint: string; power: number };
  companion: { x: number; y: number };
}

const MAP = mapJson as MapData;

const WP: Record<string, GraphNode> = Object.fromEntries(
  MAP.waypoints.map((w) => [w.id, { id: w.id, x: w.x, y: w.y }]),
);

export const LEVEL_EDGES: LevelEdge[] = MAP.edges.map((e) => ({
  a: e.a,
  b: e.b,
  blocker: e.blocker
    ? { power: e.blocker.power, texture: e.blocker.texture, role: (e.blocker.role as EnemyRole) ?? 'path', at: e.blocker.at }
    : undefined,
}));

export const WAYPOINTS: GraphNode[] = Object.values(WP);
export const GRAPH_EDGES: GraphEdge[] = LEVEL_EDGES.map((e) => ({ a: e.a, b: e.b }));

/** 由边的 blocker 规格派生出敌人 spawn（定位在边上 at 处，默认中点）。 */
function deriveEnemies(): EnemySpawn[] {
  const out: EnemySpawn[] = [];
  for (const e of LEVEL_EDGES) {
    if (!e.blocker) continue;
    const A = WP[e.a];
    const B = WP[e.b];
    const t = e.blocker.at ?? 0.5;
    out.push({
      x: Math.round(A.x + (B.x - A.x) * t),
      y: Math.round(A.y + (B.y - A.y) * t),
      power: e.blocker.power,
      texture: e.blocker.texture,
      role: e.blocker.role ?? 'path',
    });
  }
  return out;
}

function wpXY(id: string): { x: number; y: number } {
  const w = WP[id];
  return { x: w.x, y: w.y };
}

export interface LevelConfig {
  worldHeight: number;
  worldWidth: number;
  heroStartPower: number;
  heroSpeed: number;
  heroStart: { x: number; y: number };
  enemies: EnemySpawn[];
  decor: DecorEnemySpawn[];
  pickups: PickupSpawn[];
  chests: ChestSpawn[];
  boss: BossSpawn;
  companion: CompanionSpawn;
}

export const M1_LEVEL: LevelConfig = {
  worldHeight: MAP.world.height,
  worldWidth: MAP.world.width,
  heroStartPower: MAP.hero.startPower,
  heroSpeed: MAP.hero.speed,
  heroStart: wpXY(MAP.hero.startWaypoint),

  enemies: deriveEnemies(),

  // 装饰野怪：通道之外（格子之间的绿地空洞），永久不可达，仅观感
  decor: MAP.decor.map((d) => ({ x: d.x, y: d.y, power: d.power, texture: d.texture })),

  // 通道上没有任何"白捡"增益；成长靠击败怪物吸收 + 守卫后宝箱。
  pickups: [],

  // 宝箱：被守卫怪把守，击败守卫后点击开启 → 二选一拿宝物（位于出屏的远端死路）。
  chests: MAP.chests.map((c) => ({ ...wpXY(c.waypoint), guardPower: c.guardPower, title: c.title, options: c.options })),

  boss: { ...wpXY(MAP.boss.waypoint), power: MAP.boss.power },
  companion: { x: MAP.companion.x, y: MAP.companion.y },
};
