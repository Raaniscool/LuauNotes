const { test } = require("node:test");
const assert = require("node:assert");

const { validateKnowledgeBase } = require("../app/lib/validate.js");

test("the shipped knowledge base validates with zero errors", () => {
  const result = validateKnowledgeBase();
  assert.deepEqual(
    result.errors,
    [],
    `validation errors:\n${result.errors.map((e) => `  - [${e.file}] ${e.message}`).join("\n")}`
  );
  assert.ok(result.total >= 150, `expected >=150 entries, got ${result.total}`);
});

test("validator reports counts per category", () => {
  const { counts } = validateKnowledgeBase();
  assert.ok(counts.luau > 0);
  assert.ok(counts.concepts > 0);
  assert.ok(counts.gotchas > 0);
});
