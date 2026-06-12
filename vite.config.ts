import { defineConfig } from 'vite';
import { execSync } from 'child_process';
import { configEditor } from './.cursor/skills/config-editor/tool/plugin';
import { artBrowser } from './.cursor/skills/art-browser/tool/server/plugin';
import { mapEditor } from './tools/map-editor/plugin';
import { schemas } from './tools/config-editor/schemas';

const DEV_PORT = 5173;
const PREVIEW_PORT = 4173;

function killOnPort(port: number): void {
  try {
    if (process.platform === 'win32') {
      const raw = execSync(
        `(Get-NetTCPConnection -LocalPort ${port} -State Listen -ErrorAction Stop).OwningProcess`,
        { encoding: 'utf-8', shell: 'powershell.exe', timeout: 5000 },
      ).trim();
      for (const line of raw.split(/\r?\n/)) {
        const pid = parseInt(line.trim(), 10);
        if (pid && pid !== process.pid) {
          execSync(`taskkill /PID ${pid} /T /F`, { stdio: 'ignore', timeout: 5000 });
          console.log(`[vite] killed process on port ${port} (PID ${pid})`);
        }
      }
    } else {
      const raw = execSync(`lsof -ti:${port}`, { encoding: 'utf-8', timeout: 5000 }).trim();
      for (const pid of raw.split('\n').map(Number).filter(Boolean)) {
        if (pid !== process.pid) {
          process.kill(pid);
          console.log(`[vite] killed process on port ${port} (PID ${pid})`);
        }
      }
    }
  } catch {
    /* port not in use */
  }
}

export default defineConfig(async ({ command }) => {
  if (command === 'serve') {
    killOnPort(DEV_PORT);
    await new Promise((r) => setTimeout(r, 300));
  }

  return {
    plugins: [
      configEditor(schemas),
      artBrowser(),
      mapEditor(),
    ],
    server: { port: DEV_PORT, strictPort: true },
    preview: { port: PREVIEW_PORT, strictPort: true, host: true },
    build: {
      // 多页面：/ = 3D 士兵版（main.ts）；/2d.html = 2D 四版本选择（main2d.ts）。
      rollupOptions: {
        input: {
          main: 'index.html',
          twod: '2d.html',
        },
      },
    },
  };
});
