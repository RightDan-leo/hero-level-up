import armyData from './data/army.json';
import mapJson from './level.map.json';
import type { GraphNode } from '../game/PathGraph';

// ─────────────────────────────────────────────────────────────────────────
// 地图数据：复刻自 2D 版，读取共享的 src/config/level.map.json（唯一事实来源）。
// 2D 俯视坐标 (x,y) 直接映射到 3D 地面 (x,z)。可用 /__mapedit/ 编辑器读写。
// ─────────────────────────────────────────────────────────────────────────

export type EnemyRole = 'path' | 'optional' | 'guard';

export interface RewardOption {
  label: string;
  bonus: number;
  stars: number;
}

interface MapData {
  world: { width: number; height: number };
  hero: { startWaypoint: string; startPower: number; speed: number };
  waypoints: { id: string; x: number; y: number }[];
  edges: { a: string; b: string; blocker?: { power: number; texture?: string; role?: string; at?: number } }[];
  decor: { x: number; y: number; power: number; texture?: string }[];
  chests: { waypoint: string; guardPower: number; title: string; options: RewardOption[] }[];
  boss: { waypoint: string; power: number };
  companion: { x: number; y: number };
}

const MAP = mapJson as MapData;

const WP: Record<string, GraphNode> = Object.fromEntries(
  MAP.waypoints.map((w) => [w.id, { id: w.id, x: w.x, y: w.y }]),
);

export interface BlockerSpec {
  power: number;
  role: EnemyRole;
  at: number;
}

export interface MapEdge {
  a: string;
  b: string;
  blocker?: BlockerSpec;
}

export const WORLD = MAP.world;
export const MAP_WAYPOINTS: GraphNode[] = Object.values(WP);
export const MAP_EDGES: MapEdge[] = MAP.edges.map((e) => ({
  a: e.a,
  b: e.b,
  blocker: e.blocker
    ? { power: e.blocker.power, role: (e.blocker.role as EnemyRole) ?? 'path', at: e.blocker.at ?? 0.5 }
    : undefined,
}));
export const MAP_DECOR = MAP.decor.map((d) => ({ x: d.x, y: d.y, power: d.power }));
export const MAP_CHESTS = MAP.chests.map((c) => ({
  x: WP[c.waypoint].x,
  y: WP[c.waypoint].y,
  waypoint: c.waypoint,
  guardPower: c.guardPower,
  title: c.title,
  options: c.options,
}));
export const MAP_BOSS = { x: WP[MAP.boss.waypoint].x, y: WP[MAP.boss.waypoint].y, waypoint: MAP.boss.waypoint, power: MAP.boss.power };
export const MAP_HERO = { x: WP[MAP.hero.startWaypoint].x, y: WP[MAP.hero.startWaypoint].y, waypoint: MAP.hero.startWaypoint, startPower: MAP.hero.startPower, speed: MAP.hero.speed };
export const MAP_COMPANION = MAP.companion;

// ── 2D(px) → 3D(units) 坐标映射 ──────────────────────────────────────────
export const MAP_SCALE = 0.04;
const CX = MAP.world.width / 2;
const ZREF = MAP_HERO.y; // 让主角起点 z≈0
/** 把地图(x,y)映射到 3D 地面坐标 {x,z}。 */
export function toWorld(x: number, y: number): { x: number; z: number } {
  return { x: (x - CX) * MAP_SCALE, z: (y - ZREF) * MAP_SCALE };
}

// ── 士兵版成长曲线 ─────────────────────────────────────────────────────────
export interface ArmyConfig {
  startPower: number;
  maxSoldiers: number;
  countCurve: Array<[number, number]>;
  tierThresholds: number[];
  tierNames: string[];
}
export const ARMY = armyData as ArmyConfig;

export function soldierCountForPower(power: number): number {
  let c = 1;
  for (const [p, n] of ARMY.countCurve) if (power >= p) c = n;
  return Math.min(ARMY.maxSoldiers, c);
}
export function tierForPower(power: number): number {
  let t = 0;
  for (let i = 0; i < ARMY.tierThresholds.length; i++) if (power >= ARMY.tierThresholds[i]) t = i;
  return t;
}
/** 敌方编队战力 → 红兵数量（与我方同套映射，渲染上限更低以免拥挤）。 */
export function enemySoldierCount(power: number): number {
  return Math.min(12, soldierCountForPower(power));
}

export const COLORS = {
  ally: 0x3d7bdd,
  allyDark: 0x244e8f,
  enemy: 0xd0433a,
  enemyDark: 0x8f2a24,
  guard: 0x9b59b6,
  hero: 0x2f5fb0,
  heroAccent: 0xffd34d,
  boss: 0x6a2230,
  ground: 0x3c5a3a,
  groundPath: 0x9c8b63,
  sky: 0x0e1410,
};

export const CAMERA = {
  offset: { x: 0, y: 17, z: 14 },
  lookAhead: 6,
  lerp: 0.08,
  fov: 54,
};

export const CTA = {
  storeUrl: 'https://play.google.com/store/apps/details?id=com.allstarunion.beneoutland',
  title: '兵团觉醒 · 巨龙加冕！',
  tagline: '下载游戏，统领万军，释放觉醒巨龙！',
};
