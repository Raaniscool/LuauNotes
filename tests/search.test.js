const { test } = require("node:test");
const assert = require("node:assert");

const { KnowledgeStore } = require("../app/lib/knowledge.js");
const { tokenize, searchKnowledge, searchNotes } = require("../app/lib/search.js");

const store = new KnowledgeStore();

test("tokenize lowercases, splits and drops empties", () => {
  assert.deepEqual(tokenize("  FireServer  (Remote) "), ["fireserver", "remote"]);
  assert.deepEqual(tokenize(""), []);
});

test("search: exact API name surfaces the right entry first", () => {
  const results = searchKnowledge(store, "UnreliableRemoteEvent");
  assert.ok(results.length > 0, "should find results");
  assert.equal(results[0].id, "unreliable-remote-event");
});

test("search: related-term query 'player parameter' finds remote events", () => {
  const results = searchKnowledge(store, "player parameter");
  const ids = results.map((r) => r.id);
  assert.ok(
    ids.includes("on-server-event") || ids.includes("fire-server"),
    `expected remote entries for 'player parameter', got: ${ids.slice(0, 5).join(", ")}`
  );
});

test("search: problem-style query 'gui not showing' finds the StarterGui gotcha", () => {
  const results = searchKnowledge(store, "gui not showing");
  const ids = results.map((r) => r.id);
  assert.ok(ids.includes("startergui-vs-playergui"), `got: ${ids.slice(0, 6).join(", ")}`);
});

test("search: category filter restricts results", () => {
  const all = searchKnowledge(store, "remote");
  const gotchas = searchKnowledge(store, "remote", { category: "gotchas" });
  assert.ok(all.length >= gotchas.length);
  for (const r of gotchas) assert.equal(r.category, "gotchas");
});

test("search: empty/whitespace query returns nothing", () => {
  assert.deepEqual(searchKnowledge(store, ""), []);
  assert.deepEqual(searchKnowledge(store, "   "), []);
});

test("search: results carry verification status", () => {
  const results = searchKnowledge(store, "touched");
  assert.ok(results.length > 0);
  for (const r of results.slice(0, 3)) {
    assert.ok(["verified", "review", "pending"].includes(r.status));
  }
});

test("searchNotes matches title and body", () => {
  const notes = [
    { id: "note-1", title: "Debounce idea", body: "use a busy flag on the lava pad", tags: [] },
    { id: "note-2", title: "Shopping list", body: "milk and eggs", tags: [] },
  ];
  const hits = searchNotes(notes, "lava");
  assert.equal(hits.length, 1);
  assert.equal(hits[0].note.id, "note-1");
  assert.ok(hits[0].score > 0);
});
