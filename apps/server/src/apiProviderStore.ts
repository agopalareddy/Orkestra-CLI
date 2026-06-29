import { spawn } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { ApiProviderConfig } from "./apiProviders";

// UI'dan (Ayarlar) eklenen API sağlayıcılarını data/api-providers.json'a yazar.
// API anahtarı düz metin DEĞİL saklanır: Windows'ta DPAPI (kullanıcıya özel), diğer
// platformlarda base64 (obfuscation). Bu modül github.ts'teki yaklaşımı taşır ama ona
// dokunmaz — birden çok anahtarı satır içi tuttuğu için kendi şifrelemesini kullanır.

type StoredEntry = Omit<ApiProviderConfig, "apiKey"> & { apiKeyEnc?: string };

function runPwsh(script: string, env: Record<string, string>): Promise<{ out: string; code: number }> {
  return new Promise((res) => {
    const ps = spawn("powershell", ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-Command", script], {
      windowsHide: true,
      env: { ...process.env, ...env }
    });
    let out = "";
    ps.stdout?.on("data", (d) => (out += d.toString()));
    ps.on("close", (code) => res({ out: out.trim(), code: code ?? 0 }));
    ps.on("error", () => res({ out: "", code: 1 }));
  });
}

async function encryptSecret(value: string): Promise<string> {
  if (!value) return "";
  if (process.platform === "win32") {
    const { out, code } = await runPwsh(
      "$s=ConvertTo-SecureString -String $env:ORK_SECRET -AsPlainText -Force; ConvertFrom-SecureString -SecureString $s",
      { ORK_SECRET: value }
    );
    if (code === 0 && out) return `dpapi:${out}`;
  }
  return `b64:${Buffer.from(value, "utf8").toString("base64")}`;
}

async function decryptSecret(enc: string): Promise<string> {
  if (!enc) return "";
  if (enc.startsWith("dpapi:")) {
    if (process.platform !== "win32") return "";
    const { out, code } = await runPwsh(
      "$s=ConvertTo-SecureString -String $env:ORK_ENC; $b=[Runtime.InteropServices.Marshal]::SecureStringToBSTR($s); [Runtime.InteropServices.Marshal]::PtrToStringBSTR($b)",
      { ORK_ENC: enc.slice(6) }
    );
    return code === 0 && out ? out : "";
  }
  if (enc.startsWith("b64:")) {
    try { return Buffer.from(enc.slice(4), "base64").toString("utf8"); } catch { return ""; }
  }
  return "";
}

function cleanId(id: string): string {
  return id.startsWith("api:") ? id.slice(4) : id.replace(/^api-/, "");
}

export class ApiProviderStore {
  private file: string;
  constructor(dataDir: string) {
    this.file = join(dataDir, "api-providers.json");
  }

  private readRaw(): StoredEntry[] {
    if (!existsSync(this.file)) return [];
    try {
      const parsed = JSON.parse(readFileSync(this.file, "utf8"));
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  private writeRaw(entries: StoredEntry[]) {
    writeFileSync(this.file, JSON.stringify(entries, null, 2), "utf8");
  }

  // Anahtarsız liste (UI/endpoint için): metadata + anahtar var mı bilgisi. Anahtarın
  // kendisi ASLA istemciye dönmez.
  listPublic(): Array<Omit<StoredEntry, "apiKeyEnc"> & { hasApiKey: boolean }> {
    return this.readRaw().map(({ apiKeyEnc, ...rest }) => ({ ...rest, hasApiKey: Boolean(apiKeyEnc) }));
  }

  // Tam liste (anahtar çözülmüş) — yalnızca çalıştırma anında sunucu içinde kullanılır.
  async list(): Promise<ApiProviderConfig[]> {
    const out: ApiProviderConfig[] = [];
    for (const entry of this.readRaw()) {
      const { apiKeyEnc, ...rest } = entry;
      out.push({ ...rest, apiKey: apiKeyEnc ? await decryptSecret(apiKeyEnc) : undefined });
    }
    return out;
  }

  async get(id: string): Promise<ApiProviderConfig | undefined> {
    const want = cleanId(id);
    return (await this.list()).find((c) => c.id === want);
  }

  // Yeni ekler veya günceller. apiKey verilmezse mevcut (şifreli) anahtar korunur —
  // böylece kullanıcı anahtarı tekrar girmeden adı/modeli düzenleyebilir.
  async save(config: ApiProviderConfig): Promise<void> {
    const entries = this.readRaw();
    const { apiKey, ...rest } = config;
    const apiKeyEnc = apiKey
      ? await encryptSecret(apiKey)
      : entries.find((e) => e.id === config.id)?.apiKeyEnc;
    const entry: StoredEntry = { ...rest, apiKeyEnc };
    const idx = entries.findIndex((e) => e.id === config.id);
    if (idx >= 0) entries[idx] = entry;
    else entries.push(entry);
    this.writeRaw(entries);
  }

  remove(id: string): void {
    const want = cleanId(id);
    this.writeRaw(this.readRaw().filter((e) => e.id !== want));
  }
}
