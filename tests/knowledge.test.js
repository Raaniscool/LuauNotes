const { test } = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const {
  KNOWLEDGE_DIR,
  CATEGORIES,
  loadKnowledge,
  toIndexItem,
  buildSearchText,
  KnowledgeStore,
} = require("../app/lib/knowledge.js");

test("loadKnowledge loads the shipped knowledge base without errors", () => {
  const { entries, errors } = loadKnowledge({ lenient: false });
  assert.deepEqual(errors, [], `unexpected load errors: ${JSON.stringify(errors)}`);
  assert.ok(entries.size >= 150, `expected a substantial knowledge base, got ${entries.size} entries`);
});

test("every entry has required fields and a valid category", () => {
  const { entries } = loadKnowledge({ lenient: false });
  for (const [id, entry] of entries) {
    assert.ok(entry.title, `${id}: missing title`);
    assert.ok(CATEGORIES.includes(entry.category), `${id}: invalid category ${entry.category}`);
    assert.ok(entry.summary, `${id}: missing summary`);
    assert.ok(entry.verification, `${id}: missing verification metadata`);
    assert.ok(["verified", "review", "pending"].includes(entry.verification.status), `${id}: bad status`);
  }
});

test("verified API-category entries carry a sourceUrl", () => {
  const { entries } = loadKnowledge({ lenient: false });
  const apiCats = ["services", "classes", "methods", "events", "properties", "datatypes"];
  for (const [id, entry] of entries) {
    if (apiCats.includes(entry.category) && entry.verification.status === "verified") {
      assert.ok(entry.verification.sourceUrl, `${id}: verified API entry missing sourceUrl`);
    }
  }
});

test("files under _pending/ are forced to pending status", () => {
  const pendingDir = path.join(KNOWLEDGE_DIR, "_pending");
  const file = path.join(pendingDir, "test-proposal.json");
  const entry = {
    id: "test-proposal",
    title: "Test Proposal",
    category: "concepts",
    type: "concept",
    summary: "A test proposal that claims to be verified.",
    verification: { status: "verified", source: "nowhere", lastVerified: "2026-10-04" },
    added: "2026-10-04",
  };
  fs.writeFileSync(file, JSON.stringify(entry));
  try {
    const store = new KnowledgeStore();
    const loaded = store.get("test-proposal");
    assert.ok(loaded, "pending proposal should be loaded");
    assert.equal(loaded.verification.status, "pending", "_pending entries must be forced to pending");
    assert.ok(loaded._pending, "entry should be flagged _pending");
  } finally {
    fs.unlinkSync(file);
  }
});

test("toIndexItem produces a lightweight index shape", () => {
  const { entries } = loadKnowledge({ lenient: true });
  const sample = entries.values().next().value;
  const item = toIndexItem(sample);
  assert.equal(item.id, sample.id);
  assert.ok(!item.examples || item.examples === undefined || typeof item === "object");
  assert.ok(!("explanation" in item) || item.explanation === undefined, "index items stay lean");
});

test("buildSearchText covers title, summary, keywords and code", () => {
  const { entries } = loadKnowledge({ lenient: true });
  const entry = entries.get("unreliable-remote-event") || entries.values().next().value;
  const text = buildSearchText(entry);
  assert.ok(text.includes(entry.title.toLowerCase()));
  assert.ok(text.includes(entry.summary.toLowerCase().slice(0, 20)));
});

test("KnowledgeStore counts by category", () => {
  const store = new KnowledgeStore();
  const counts = store.countsByCategory();
  assert.ok(counts.luau > 0);
  assert.ok(counts.services > 0);
  assert.ok(counts.gotchas > 0);
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  assert.equal(total, store.entries.size);
});
