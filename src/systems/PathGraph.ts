import Phaser from 'phaser';

export interface GraphNode {
  id: string;
  x: number;
  y: number;
}

export interface GraphEdge {
  a: string;
  b: string;
}

/** 投影到图上某条边的最近点。 */
export interface ProjectedPoint {
  x: number;
  y: number;
  edge: number;
  t: number;
}

/**
 * 通道路网图：节点(waypoint) + 边(corridor)。
 * 提供「任意点投影到最近通道点」与「图上两点间最短折线路径」，
 * 用于把英雄移动约束在通道上（M6 核心）。
 */
export class PathGraph {
  private nodes = new Map<string, GraphNode>();
  private edges: GraphEdge[];
  private adj = new Map<string, Array<{ to: string; w: number }>>();

  constructor(nodes: GraphNode[], edges: GraphEdge[]) {
    for (const n of nodes) {
      this.nodes.set(n.id, n);
      this.adj.set(n.id, []);
    }
    this.edges = edges;
    for (const e of edges) {
      const A = this.nodes.get(e.a);
      const B = this.nodes.get(e.b);
      if (!A || !B) continue;
      const w = Math.hypot(A.x - B.x, A.y - B.y);
      this.adj.get(e.a)!.push({ to: e.b, w });
      this.adj.get(e.b)!.push({ to: e.a, w });
    }
  }

  node(id: string): GraphNode {
    return this.nodes.get(id)!;
  }

  /** 把任意点投影到最近的边上，返回边上最近点（约束移动用）。 */
  project(x: number, y: number): ProjectedPoint {
    let best: ProjectedPoint = { x, y, edge: 0, t: 0 };
    let bestD = Infinity;
    for (let i = 0; i < this.edges.length; i++) {
      const A = this.nodes.get(this.edges[i].a)!;
      const B = this.nodes.get(this.edges[i].b)!;
      const dx = B.x - A.x;
      const dy = B.y - A.y;
      const len2 = dx * dx + dy * dy || 1;
      let t = ((x - A.x) * dx + (y - A.y) * dy) / len2;
      t = Phaser.Math.Clamp(t, 0, 1);
      const px = A.x + dx * t;
      const py = A.y + dy * t;
      const d = Math.hypot(x - px, y - py);
      if (d < bestD) {
        bestD = d;
        best = { x: px, y: py, edge: i, t };
      }
    }
    return best;
  }

  private edgeLen(a: string, b: string): number {
    const A = this.nodes.get(a)!;
    const B = this.nodes.get(b)!;
    return Math.hypot(A.x - B.x, A.y - B.y);
  }

  /** Dijkstra：返回 from→to 的节点 id 序列（含端点）；不可达返回 []。 */
  private shortestNodes(from: string, to: string): string[] {
    const dist = new Map<string, number>();
    const prev = new Map<string, string>();
    const visited = new Set<string>();
    for (const id of this.nodes.keys()) dist.set(id, Infinity);
    dist.set(from, 0);

    while (true) {
      let u: string | null = null;
      let ud = Infinity;
      for (const [id, d] of dist) {
        if (!visited.has(id) && d < ud) {
          ud = d;
          u = id;
        }
      }
      if (u === null) break;
      visited.add(u);
      if (u === to) break;
      for (const { to: v, w } of this.adj.get(u)!) {
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

  /**
   * 从图上一点 from 到另一点 to 的世界折线路径（不含起点，含终点）。
   * 英雄沿返回的点序列逐段行走即被约束在通道上。
   */
  route(from: ProjectedPoint, to: ProjectedPoint): Array<{ x: number; y: number }> {
    if (from.edge === to.edge) {
      return [{ x: to.x, y: to.y }];
    }
    const fa = this.edges[from.edge].a;
    const fb = this.edges[from.edge].b;
    const ta = this.edges[to.edge].a;
    const tb = this.edges[to.edge].b;

    let bestPath: string[] = [];
    let bestCost = Infinity;
    for (const s of [fa, fb]) {
      for (const e of [ta, tb]) {
        const np = this.shortestNodes(s, e);
        if (np.length === 0) continue;
        const sNode = this.nodes.get(s)!;
        const eNode = this.nodes.get(e)!;
        let cost = Math.hypot(from.x - sNode.x, from.y - sNode.y);
        for (let i = 0; i + 1 < np.length; i++) cost += this.edgeLen(np[i], np[i + 1]);
        cost += Math.hypot(eNode.x - to.x, eNode.y - to.y);
        if (cost < bestCost) {
          bestCost = cost;
          bestPath = np;
        }
      }
    }

    const pts: Array<{ x: number; y: number }> = [];
    for (const id of bestPath) {
      const n = this.nodes.get(id)!;
      pts.push({ x: n.x, y: n.y });
    }
    pts.push({ x: to.x, y: to.y });
    return pts;
  }

  get edgeList(): GraphEdge[] {
    return this.edges;
  }

  get nodeList(): GraphNode[] {
    return [...this.nodes.values()];
  }
}
