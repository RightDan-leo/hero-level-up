export interface GraphNode {
  id: string;
  x: number;
  y: number;
}

export interface GraphEdgeData {
  a: string;
  b: string;
}

/**
 * 通道路网图（俯视 2D 坐标，对应 3D 地面 x/z）。
 * 提供最短路（可避开"被挡路怪锁住"的边），用于把英雄移动约束在通道上。
 * 移植自 2D 版 systems/PathGraph，去 Phaser 依赖 + 增加边锁定状态。
 */
export class PathGraph {
  private nodes = new Map<string, GraphNode>();
  private edges: GraphEdgeData[];
  private locked: boolean[];
  private adj = new Map<string, Array<{ to: string; w: number; edge: number }>>();

  constructor(nodes: GraphNode[], edges: GraphEdgeData[]) {
    for (const n of nodes) {
      this.nodes.set(n.id, n);
      this.adj.set(n.id, []);
    }
    this.edges = edges;
    this.locked = edges.map(() => false);
    for (let i = 0; i < edges.length; i++) {
      const e = edges[i];
      const A = this.nodes.get(e.a);
      const B = this.nodes.get(e.b);
      if (!A || !B) continue;
      const w = Math.hypot(A.x - B.x, A.y - B.y);
      this.adj.get(e.a)!.push({ to: e.b, w, edge: i });
      this.adj.get(e.b)!.push({ to: e.a, w, edge: i });
    }
  }

  node(id: string): GraphNode {
    return this.nodes.get(id)!;
  }

  setLocked(edgeIndex: number, locked: boolean): void {
    if (edgeIndex >= 0 && edgeIndex < this.locked.length) this.locked[edgeIndex] = locked;
  }

  isLocked(edgeIndex: number): boolean {
    return this.locked[edgeIndex] ?? false;
  }

  /** 找包含两端点的边索引。 */
  edgeBetween(a: string, b: string): number {
    for (let i = 0; i < this.edges.length; i++) {
      const e = this.edges[i];
      if ((e.a === a && e.b === b) || (e.a === b && e.b === a)) return i;
    }
    return -1;
  }

  /** 最近的节点 id（用于把点击落点吸附到通道节点）。 */
  nearestNode(x: number, y: number): string {
    let best = '';
    let bestD = Infinity;
    for (const n of this.nodes.values()) {
      const d = Math.hypot(n.x - x, n.y - y);
      if (d < bestD) { bestD = d; best = n.id; }
    }
    return best;
  }

  /**
   * Dijkstra：from→to 的节点 id 序列（含端点）。
   * avoidLocked=true 时不穿过被锁的边；不可达返回 []。
   */
  shortestNodes(from: string, to: string, avoidLocked = true): string[] {
    if (from === to) return [from];
    const dist = new Map<string, number>();
    const prev = new Map<string, string>();
    const visited = new Set<string>();
    for (const id of this.nodes.keys()) dist.set(id, Infinity);
    dist.set(from, 0);

    while (true) {
      let u: string | null = null;
      let ud = Infinity;
      for (const [id, d] of dist) {
        if (!visited.has(id) && d < ud) { ud = d; u = id; }
      }
      if (u === null) break;
      visited.add(u);
      if (u === to) break;
      for (const { to: v, w, edge } of this.adj.get(u)!) {
        if (avoidLocked && this.locked[edge]) continue;
        const nd = ud + w;
        if (nd < (dist.get(v) ?? Infinity)) {
          dist.set(v, nd);
          prev.set(v, u);
        }
      }
    }

    const path: string[] = [];
    let cur: string | undefined = to;
    while (cur !== undefined) {
      path.unshift(cur);
      if (cur === from) break;
      cur = prev.get(cur);
    }
    return path[0] === from ? path : [];
  }

  get edgeList(): GraphEdgeData[] {
    return this.edges;
  }

  get nodeList(): GraphNode[] {
    return [...this.nodes.values()];
  }
}
