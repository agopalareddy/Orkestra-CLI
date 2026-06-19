import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import type { ProxyOptions } from "vite";

// Backend (8787) tsx-watch ile yeniden başlarken kısa bir süre kapalı olur; bu sırada
// frontend'in /api yoklamaları ECONNREFUSED verir. Tam stack basmak yerine tek satır
// uyarı yazıp 503 dönüyoruz (gürültüyü azaltır; gerçek bir hata değil).
const backend = "http://127.0.0.1:8787";
const quietProxy = (): ProxyOptions => ({
  target: backend,
  changeOrigin: true,
  configure: (proxy) => {
    proxy.on("error", (err, _req, res) => {
      const code = (err as NodeJS.ErrnoException).code;
      if (code === "ECONNREFUSED" || code === "ECONNRESET") {
        if (res && "writeHead" in res && !(res as any).headersSent) {
          try { (res as any).writeHead(503); (res as any).end("backend restarting"); } catch {}
        }
        return; // stack basma
      }
      console.warn("[proxy]", err.message);
    });
  }
});

export default defineConfig({
  plugins: [react()],
  root: "apps/web",
  server: {
    port: 5173,
    proxy: {
      "/api": quietProxy(),
      "/preview": quietProxy(),
      "/preview-entry": quietProxy()
    }
  },
  build: {
    outDir: "../../dist/web",
    emptyOutDir: true
  }
});
