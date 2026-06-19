import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { promisify } from "node:util";
import type { GitStatus } from "../../../packages/shared/types";

const exec = promisify(execFile);

// Baz commit'ler için kimlik (depoda global ayar olmayabilir).
const IDENTITY = ["-c", "user.email=orkestra@local", "-c", "user.name=Orkestra"];

export type DiffFile = { path: string; adds: number; dels: number; diff: string; binary: boolean };

const blockedPatterns = [
  /^\.env($|\.)/i,
  /(^|[\\/])\.env($|\.)/i,
  /token/i,
  /secret/i,
  /credential/i,
  /private[-_]?key/i
];

export class GitService {
  constructor(private cwd: string) {}

  async status(): Promise<GitStatus> {
    const branch = await this.git(["branch", "--show-current"]).then((v) => v.trim()).catch(() => "unknown");
    const remote = await this.git(["remote"]).then((v) => v.trim()).catch(() => "");
    const porcelain = await this.git(["status", "--porcelain"]).catch(() => "");
    const diffStat = await this.git(["diff", "--stat"]).catch(() => "");

    return {
      branch,
      hasRemote: remote.length > 0,
      files: porcelain
        .split(/\r?\n/)
        .filter(Boolean)
        .map((line) => {
          const status = line.slice(0, 2).trim();
          const path = line.slice(3).trim();
          const reason = blockedReason(path);
          return {
            path,
            status,
            blocked: Boolean(reason),
            reason
          };
        }),
      diffStat
    };
  }

  // Run başında çağrılır: workspace'i git deposu yap ve mevcut (run öncesi) durumu
  // baz commit'le. Böylece sonradan `git diff HEAD` yalnızca bu run'ın değişikliklerini gösterir.
  async commitBaseline() {
    if (!existsSync(join(this.cwd, ".git"))) {
      await this.git(["init"]).catch(() => {});
    }
    await this.git(["add", "-A"]).catch(() => {});
    // Bir şey yoksa bile HEAD oluşsun (ilk run boş workspace olabilir).
    await this.git([...IDENTITY, "commit", "-m", "orkestra baseline", "--allow-empty"]).catch(() => {});
  }

  // Çalışma ağacının HEAD'e göre farkı — yeni dosyalar dahil, dosya başına unified diff.
  async workingDiff(): Promise<DiffFile[]> {
    if (!existsSync(join(this.cwd, ".git"))) return [];
    // Yeni (untracked) dosyaların da diff'e girmesi için indekse al, sonunda geri çek.
    await this.git(["add", "-A"]).catch(() => {});
    const numstat = await this.git(["diff", "--cached", "--numstat"]).catch(() => "");
    const files: DiffFile[] = [];
    for (const line of numstat.split(/\r?\n/).filter(Boolean)) {
      const cols = line.split("\t");
      const adds = cols[0];
      const dels = cols[1];
      const path = cols.slice(2).join("\t");
      if (!path || blockedReason(path)) continue; // gizli/secret dosyaları gösterme
      const binary = adds === "-" || dels === "-";
      const diff = binary ? "" : await this.git(["diff", "--cached", "--", path]).catch(() => "");
      files.push({ path, adds: binary ? 0 : Number(adds) || 0, dels: binary ? 0 : Number(dels) || 0, diff, binary });
    }
    await this.git(["reset"]).catch(() => {}); // indeksi geri al (çalışma ağacı diskte kalır)
    return files;
  }

  async createBranch(branch: string) {
    await this.git(["checkout", "-b", branch]);
  }

  async commit(files: string[], message: string) {
    const safeFiles = files.filter((file) => !blockedReason(file));
    if (safeFiles.length === 0) throw new Error("No safe files selected for commit.");
    await this.git(["add", "--", ...safeFiles]);
    await this.git(["commit", "-m", message]);
  }

  async push(branch: string) {
    await this.git(["push", "-u", "origin", branch]);
  }

  async createDraftPr(title: string, body: string) {
    return this.run("gh", ["pr", "create", "--draft", "--title", title, "--body", body]);
  }

  private async git(args: string[]) {
    return this.run("git", args);
  }

  private async run(command: string, args: string[]) {
    const { stdout, stderr } = await exec(command, args, {
      cwd: this.cwd,
      windowsHide: true,
      maxBuffer: 1024 * 1024 * 10
    });
    return stdout || stderr;
  }
}

function blockedReason(path: string) {
  if (blockedPatterns.some((pattern) => pattern.test(path))) {
    return "Looks like a secret or environment file.";
  }
  return undefined;
}
