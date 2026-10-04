const { test } = require("node:test");
const assert = require("node:assert");
const path = require("node:path");
const fs = require("node:fs");

const notes = require("../app/lib/notes.js");

test("saveNote → getNote roundtrip, then delete", () => {
  const created = notes.saveNote({ title: "Test note", body: "Hello **world**", tags: ["test"] });
  assert.ok(created.id.startsWith("note-"));
  assert.equal(created.title, "Test note");
  assert.ok(created.createdAt);
  assert.ok(created.updatedAt);

  const fetched = notes.getNote(created.id);
  assert.ok(fetched);
  assert.equal(fetched.body, "Hello **world**");

  assert.ok(notes.deleteNote(created.id));
  assert.equal(notes.getNote(created.id), null);
});

test("saveNote updates preserve id and createdAt", () => {
  const created = notes.saveNote({ title: "Before", body: "b" });
  const updated = notes.saveNote({ body: "after" }, { existing: created });
  try {
    assert.equal(updated.id, created.id);
    assert.equal(updated.title, "Before");
    assert.equal(updated.body, "after");
    assert.equal(updated.createdAt, created.createdAt);
  } finally {
    notes.deleteNote(created.id);
  }
});

test("path traversal in note ids is rejected", () => {
  assert.equal(notes.getNote("../secrets"), null);
  assert.equal(notes.deleteNote("../escape"), false);
  assert.equal(notes.getNote("..%2Fevil"), null);
  assert.equal(notes.deleteNote("../../outside"), false);
});

test("listNotes returns normalized notes sorted sensibly", () => {
  const a = notes.saveNote({ title: "AAA note", body: "x" });
  try {
    const list = notes.listNotes();
    assert.ok(Array.isArray(list));
    assert.ok(list.some((n) => n.id === a.id));
  } finally {
    notes.deleteNote(a.id);
  }
});

test("importNotes: JSON array creates notes and never touches knowledge", () => {
  const payload = {
    format: "json",
    fileName: "bulk.json",
    content: JSON.stringify([
      { title: "Imported one", body: "first", tags: ["import"] },
      { title: "Imported two", body: "second" },
      { noTitleNoBody: true },
    ]),
  };
  const { created, skipped } = notes.importNotes(payload);
  try {
    assert.equal(created.length, 2);
    assert.equal(skipped, 1);
    for (const n of created) {
      assert.equal(n.importedFrom, "bulk.json");
      assert.ok(n.id.startsWith("note-"));
    }
  } finally {
    for (const n of created) notes.deleteNote(n.id);
  }
});

test("importNotes: markdown with frontmatter and heading fallback", () => {
  const md = "---\ntags: debounce, remotes\n---\n# My debounce notes\n\nKeep the flag until task.delay clears it.";
  const { created } = notes.importNotes({ format: "text", content: md, fileName: "notes.md" });
  try {
    assert.equal(created.length, 1);
    const n = created[0];
    assert.equal(n.title, "My debounce notes");
    assert.deepEqual(n.tags, ["debounce", "remotes"]);
    assert.ok(n.body.includes("task.delay"));
  } finally {
    for (const n of created) notes.deleteNote(n.id);
  }
});

test("importNotes: plain text title fallback chain", () => {
  // fileName present → title comes from the file name
  const withFile = notes.importNotes({ format: "text", content: "Quick thought\nsecond line", fileName: "quick.txt" });
  // no fileName → title falls back to the first non-empty line
  const noFile = notes.importNotes({ format: "text", content: "Quick thought\nsecond line", fileName: null });
  try {
    assert.equal(withFile.created[0].title, "quick");
    assert.equal(noFile.created[0].title, "Quick thought");
  } finally {
    for (const n of [...withFile.created, ...noFile.created]) notes.deleteNote(n.id);
  }
});
