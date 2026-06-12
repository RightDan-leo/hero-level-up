import type { Plugin } from 'vite';
import fs from 'node:fs';
import path from 'node:path';

/**
 * 可视化地图编辑器（dev-only）。
 * 访问 http://localhost:5173/__mapedit/ —— 画布拖拽节点/怪物、内联改数值、一键保存。
 * 数据源 = src/config/level.map.json（与游戏共用）；保存即触发 Vite HMR，游戏热更新。
 */
const MAP_FILE = 'src/config/level.map.json';

export function mapEditor(): Plugin {
  return {
    name: 'map-editor',
    apply: 'serve',
    configureServer(server) {
      const root = server.config.root;
      const mapPath = path.resolve(root, MAP_FILE);
      const clientPath = path.resolve(root, 'tools/map-editor/client.html');

      server.middlewares.use((req, res, next) => {
        const url = (req.url || '').split('?')[0];
        if (!url.startsWith('/__mapedit')) return next();

        if (url === '/__mapedit/api/map') {
          if (req.method === 'GET') {
            res.setHeader('Content-Type', 'application/json; charset=utf-8');
            res.end(fs.readFileSync(mapPath, 'utf-8'));
            return;
          }
          if (req.method === 'PUT') {
            let body = '';
            req.on('data', (c) => (body += c));
            req.on('end', () => {
              try {
                const parsed = JSON.parse(body);
                fs.writeFileSync(mapPath, JSON.stringify(parsed, null, 2) + '\n', 'utf-8');
                res.setHeader('Content-Type', 'application/json; charset=utf-8');
                res.end(JSON.stringify({ ok: true }));
              } catch (err) {
                res.statusCode = 400;
                res.end(JSON.stringify({ ok: false, error: String(err) }));
              }
            });
            return;
          }
          res.statusCode = 405;
          res.end('method not allowed');
          return;
        }

        if (url === '/__mapedit' || url === '/__mapedit/') {
          res.setHeader('Content-Type', 'text/html; charset=utf-8');
          res.end(fs.readFileSync(clientPath, 'utf-8'));
          return;
        }
        next();
      });
    },
  };
}
