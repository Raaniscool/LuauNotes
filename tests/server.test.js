const { test, before, after } = require("node:test");
const assert = require("node:assert");
const { spawn } = require("node:child_process");
const path = require("node:path");

const PORT = 4377;
const BASE = `http://127.0.0.1:${PORT}`;
let proc;

async function waitForServer(timeoutMs = 10000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(`${BASE}/api/meta`);
      if (res.ok) return;
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 150));
  }
  throw new Error("server did not start in time");
}

before(async () => {
  proc = spawn(process.execPath, [path.join(__dirname, "..", "app", "server.js")], {
    env: { ...process.env, PORT: String(PORT), HOST: "127.0.0.1" },
    stdio: "pipe",
  });
  proc.stderr.on("data", (d) => process.stderr.write(`[srv] ${d}`));
  await waitForServer();
});

after(() => {
  if (proc) proc.kill("SIGTERM");
});

test("GET /api/meta reports app info and knowledge counts", async () => {
  const res = await fetch(`${BASE}/api/meta`);
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.ok(body.app || body.name || body.version, "meta should describe the app");
  assert.ok(body.knowledge || body.entries !== undefined || body.counts, "meta should report knowledge stats");
});

test("GET /api/knowledge returns the index with all entries", async () => {
  const res = await fetch(`${BASE}/api/knowledge`);
  assert.equal(res.status, 200);
  const body = await res.json();
  const items = Array.isArray(body) ? body : body.entries;
  assert.ok(Array.isArray(items) && items.length >= 150);
  const ids = new Set(items.map((e) => e.id));
  assert.ok(ids.has("unreliable-remote-event"));
});

test("GET /api/entry/:id returns a full entry", async () => {
  const res = await fetch(`${BASE}/api/entry/unreliable-remote-event`);
  assert.equal(res.status, 200);
  const entry = await res.json();
  assert.equal(entry.id, "unreliable-remote-event");
  assert.ok(entry.verification);
  assert.ok(entry.examples && entry.examples.length > 0);
});

test("GET /api/entry/:id 404s for unknown ids", async () => {
  const res = await fetch(`${BASE}/api/entry/definitely-not-a-real-entry`);
  assert.equal(res.status, 404);
});

test("GET /api/search finds related entries", async () => {
  const res = await fetch(`${BASE}/api/search?q=${encodeURIComponent("player parameter")}`);
  assert.equal(res.status, 200);
  const body = await res.json();
  const results = Array.isArray(body) ? body : body.results || body.knowledge;
  assert.ok(Array.isArray(results) && results.length > 0, "expected search results");
  const ids = results.map((r) => r.id);
  assert.ok(ids.includes("on-server-event") || ids.includes("fire-server"));
});

test("notes CRUD over the API", async () => {
  // create
  let res = await fetch(`${BASE}/api/notes`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ title: "API test note", body: "created by tests", tags: ["api-test"] }),
  });
  assert.ok(res.status === 200 || res.status === 201, `create status ${res.status}`);
  const created = await res.json();
  assert.ok(created.id);

  // read back
  res = await fetch(`${BASE}/api/notes`);
  const list = await res.json();
  const items = Array.isArray(list) ? list : list.notes;
  assert.ok(items.some((n) => n.id === created.id));

  // delete
  res = await fetch(`${BASE}/api/notes/${created.id}`, { method: "DELETE" });
  assert.ok(res.ok);

  res = await fetch(`${BASE}/api/notes`);
  const after = await res.json();
  const afterItems = Array.isArray(after) ? after : after.notes;
  assert.ok(!afterItems.some((n) => n.id === created.id));
});

test("notes import endpoint imports markdown into My Notes only", async () => {
  const res = await fetch(`${BASE}/api/notes/import`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ format: "text", content: "# Imported via API\nBody text.", fileName: "api.md" }),
  });
  assert.ok(res.ok);
  const body = await res.json();
  const created = body.created || [];
  assert.equal(created.length, 1);
  // cleanup
  await fetch(`${BASE}/api/notes/${created[0].id}`, { method: "DELETE" });
});

test("static frontend is served with SPA fallback", async () => {
  const res = await fetch(`${BASE}/`);
  assert.equal(res.status, 200);
  const html = await res.text();
  assert.ok(html.toLowerCase().includes("<!doctype html"));
});
