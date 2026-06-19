import { spawn, type ChildProcess } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

export type PreviewType = "vite" | "static" | "none";
export type PreviewState = {
  runId: string;
  type: "vite";
  port: number;
  url: string;
  status: "installing" | "starting" | "ready" | "error";
  log: string;
};

// Workspace'in proje tipini algılar: package.json'da vite varsa "vite",
// herhangi bir HTML varsa "static", yoksa "none".
export function detectProjectType(workspacePath: string, hasHtml: boolean): PreviewType {
  const pkgPath = join(workspacePath, "package.json");
  if (existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(readFileSync(pkgPath, "utf8")) as {
        dependencies?: Record<string, string>;
        devDependencies?: Record<string, string>;
      };
      const deps = { ...pkg.dependencies, ...pkg.devDependencies };
      if (
        deps.vite ||
        existsSync(join(workspacePath, "vite.config.ts")) ||
        existsSync(join(workspacePath, "vite.config.js")) ||
        existsSync(join(workspacePath, "vite.config.mjs"))
      ) {
        return "vite";
      }
    } catch {
      // package.json bozuksa görmezden gel
    }
  }
  return hasHtml ? "static" : "none";
}

// Vite dev sunucularını run başına yönetir (npm install + vite dev).
export class PreviewManager {
  private servers = new Map<string, PreviewState & { proc: ChildProcess | null }>();
  private nextPort = 5180;

  get(runId: string): PreviewState | undefined {
    const s = this.servers.get(runId);
    if (!s) return undefined;
    const { proc: _proc, ...state } = s;
    return state;
  }

  // Vite dev sunucusunu başlat (zaten çalışıyorsa mevcut durumu döndür).
  start(runId: string, workspacePath: string): PreviewState {
    const existing = this.servers.get(runId);
    if (existing && existing.status !== "error") {
      const { proc: _p, ...state } = existing;
      return state;
    }
    if (existing) this.stop(runId);

    const port = this.nextPort++;
    const needInstall = !existsSync(join(workspacePath, "node_modules"));
    const entry: PreviewState & { proc: ChildProcess | null } = {
      runId,
      type: "vite",
      port,
      url: `http://127.0.0.1:${port}`,
      status: needInstall ? "installing" : "starting",
      log: "",
      proc: null
    };
    this.servers.set(runId, entry);

    const viteCmd = `npx --yes vite --port ${port} --host 127.0.0.1 --strictPort --clearScreen false`;
    const cmd = needInstall ? `npm install --no-audit --no-fund && ${viteCmd}` : viteCmd;
    const proc = spawn(cmd, {
      cwd: workspacePath,
      shell: true,
      windowsHide: true,
      env: { ...process.env, FORCE_COLOR: "0" }
    });
    entry.proc = proc;

    const onData = (chunk: Buffer) => {
      const s = chunk.toString();
      entry.log = (entry.log + s).slice(-8000);
      if (/ready in|Local:\s*http|VITE v.*ready/i.test(entry.log)) entry.status = "ready";
      else if (/added \d+ packages|vite\/|Local:/i.test(s) && entry.status === "installing") entry.status = "starting";
    };
    proc.stdout?.on("data", onData);
    proc.stderr?.on("data", onData);
    proc.on("exit", () => {
      if (entry.status !== "ready") entry.status = "error";
    });
    proc.on("error", () => {
      entry.status = "error";
    });

    const { proc: _p, ...state } = entry;
    return state;
  }

  stop(runId: string) {
    const s = this.servers.get(runId);
    if (s?.proc) {
      try {
        // Windows'ta alt süreç ağacını da kapat.
        if (process.platform === "win32" && s.proc.pid) {
          spawn("taskkill", ["/pid", String(s.proc.pid), "/T", "/F"], { windowsHide: true });
        } else {
          s.proc.kill();
        }
      } catch {
        // yoksay
      }
    }
    this.servers.delete(runId);
  }

  stopAll() {
    for (const id of [...this.servers.keys()]) this.stop(id);
  }
}
