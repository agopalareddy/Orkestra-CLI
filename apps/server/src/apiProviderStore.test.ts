import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ApiProviderStore } from "./apiProviderStore";
import { configFromInput } from "./apiProviders";

test("ApiProviderStore: save, list, public-hides-key, get, remove", async () => {
  const dir = mkdtempSync(join(tmpdir(), "orkestra-api-"));
  try {
    const store = new ApiProviderStore(dir);
    assert.deepEqual(store.listPublic(), []);

    // Anahtarlı sağlayıcı (OpenRouter) ekle
    const cfg = configFromInput({ provider: "openrouter", role: "planner", model: "openai/gpt-4o-mini", apiKey: "sk-secret-123" });
    await store.save(cfg);

    // listPublic anahtarı sızdırmamalı ama hasApiKey=true demeli
    const pub = store.listPublic();
    assert.equal(pub.length, 1);
    assert.equal(pub[0].hasApiKey, true);
    assert.equal((pub[0] as Record<string, unknown>).apiKey, undefined);
    assert.equal((pub[0] as Record<string, unknown>).apiKeyEnc, undefined);

    // list() anahtarı çözüp geri vermeli (şifreleme round-trip)
    const full = await store.list();
    assert.equal(full[0].apiKey, "sk-secret-123");
    assert.equal(full[0].kind, "openai-compatible");

    // get() id ile bulmalı (api- ön ekiyle de)
    const got = await store.get(`api-${cfg.id}`);
    assert.ok(got);
    assert.equal(got?.apiKey, "sk-secret-123");

    // remove() silmeli
    store.remove(cfg.id);
    assert.deepEqual(store.listPublic(), []);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("ApiProviderStore: anahtarsız sağlayıcı (ollama) saklanır", async () => {
  const dir = mkdtempSync(join(tmpdir(), "orkestra-api-"));
  try {
    const store = new ApiProviderStore(dir);
    const cfg = configFromInput({ provider: "ollama", role: "reviewer", model: "llama3.1" });
    await store.save(cfg);
    const pub = store.listPublic();
    assert.equal(pub.length, 1);
    assert.equal(pub[0].hasApiKey, false);
    const full = await store.list();
    assert.equal(full[0].kind, "ollama");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
