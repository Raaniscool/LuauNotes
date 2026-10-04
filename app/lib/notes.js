"use strict";
/**
 * Personal notes store — a separate layer on top of the canonical knowledge
 * base. Notes live as JSON files in my-notes/ so they are version-controlled
 * and portable, but they never modify verified reference content.
 */

const fs = require("fs");
const path = require("path");
const { ROOT } = require("./knowledge");

const NOTES_DIR = path.join(ROOT, "my-notes");

function ensureDir() {
  fs.mkdirSync(NOTES_DIR, { recursive: true });
}

function notePath(id) {
  const safe = String(id).replace(/[^a-z0-9-]/gi, "");
  if (!safe) throw new Error("invalid note id");
  const p = path.join(NOTES_DIR, `${safe}.json`);
  // path traversal guard
  if (path.dirname(p) !== NOTES_DIR) throw new Error("invalid note id");
  return p;
}

function newId() {
  return `note-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

function readNoteFile(file) {
  try {
    const raw = fs.readFileSync(file, "utf8");
    const note = JSON.parse(raw);
    if (note && typeof note.id === "string") return normalize(note);
  } catch {
    // ignore malformed personal files rather than crashing the app
  }
  return null;
}

function normalize(note) {
  return {
    id: note.id,
    title: String(note.title || "Untitled"),
    body: String(note.body || ""),
    tags: Array.isArray(note.tags) ? note.tags.map(String) : [],
    favorite: !!note.favorite,
    pinned: !!note.pinned,
    linkedEntries: Array.isArray(note.linkedEntries) ? note.linkedEntries.map(String) : [],
    warnings: Array.isArray(note.warnings) ? note.warnings.map(String) : [],
    createdAt: note.createdAt || new Date().toISOString(),
    updatedAt: note.updatedAt || note.createdAt || new Date().toISOString(),
    importedFrom: note.importedFrom || null,
  };
}

function listNotes() {
  ensureDir();
  const notes = [];
  for (const name of fs.readdirSync(NOTES_DIR)) {
    if (!name.endsWith(".json") || name === "README.md") continue;
    const note = readNoteFile(path.join(NOTES_DIR, name));
    if (note) notes.push(note);
  }
  notes.sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    if (a.favorite !== b.favorite) return a.favorite ? -1 : 1;
    return String(b.updatedAt).localeCompare(String(a.updatedAt));
  });
  return notes;
}

function getNote(id) {
  try {
    return readNoteFile(notePath(id));
  } catch {
    return null;
  }
}

function saveNote(input, { existing = null } = {}) {
  ensureDir();
  const id = existing ? existing.id : (input.id && /^note-/.test(input.id) ? input.id : newId());
  const now = new Date().toISOString();
  const note = normalize({
    id,
    title: input.title !== undefined ? input.title : existing && existing.title,
    body: input.body !== undefined ? input.body : existing && existing.body,
    tags: input.tags !== undefined ? input.tags : existing && existing.tags,
    favorite: input.favorite !== undefined ? input.favorite : existing && existing.favorite,
    pinned: input.pinned !== undefined ? input.pinned : existing && existing.pinned,
    linkedEntries: input.linkedEntries !== undefined ? input.linkedEntries : existing && existing.linkedEntries,
    warnings: input.warnings !== undefined ? input.warnings : existing && existing.warnings,
    createdAt: (existing && existing.createdAt) || now,
    updatedAt: now,
    importedFrom: existing ? existing.importedFrom : input.importedFrom || null,
  });
  if (!note.title.trim()) note.title = "Untitled";

  const file = notePath(note.id);
  const tmp = `${file}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(note, null, 2), "utf8");
  fs.renameSync(tmp, file);
  return note;
}

function deleteNote(id) {
  try {
    fs.unlinkSync(notePath(id));
    return true;
  } catch {
    return false;
  }
}

/** Minimal YAML-ish frontmatter parser: "key: value" lines, tags comma separated. */
function parseFrontmatter(text) {
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if (!m) return { meta: {}, body: text };
  const meta = {};
  for (const line of m[1].split(/\r?\n/)) {
    const kv = line.match(/^([A-Za-z][A-Za-z0-9_-]*):\s*(.*)$/);
    if (!kv) continue;
    const key = kv[1].toLowerCase();
    let value = kv[2].trim().replace(/^["']|["']$/g, "");
    if (key === "tags") value = value.split(",").map((t) => t.trim()).filter(Boolean);
    meta[key] = value;
  }
  return { meta, body: text.slice(m[0].length) };
}

/**
 * Import notes from pasted text or uploaded file content.
 * Formats:
 *  - JSON: a note object or array of note objects
 *  - Markdown/text: frontmatter (optional) + body; a `# Heading` becomes the title
 * @returns {{ created: Array, skipped: number }}
 */
function importNotes(payload) {
  const { format = "text", content = "", fileName = null } = payload || {};
  const created = [];
  let skipped = 0;

  const asText = String(content || "");
  if (format === "json" || asText.trim().startsWith("{") || asText.trim().startsWith("[")) {
    try {
      const parsed = JSON.parse(asText);
      const arr = Array.isArray(parsed) ? parsed : [parsed];
      for (const item of arr) {
        if (item && typeof item === "object" && (item.title || item.body)) {
          created.push(saveNote({ ...item, id: undefined, importedFrom: fileName || "json import" }));
        } else skipped++;
      }
      return { created, skipped };
    } catch {
      // fall through to text import
    }
  }

  const { meta, body } = parseFrontmatter(asText);
  let title = meta.title;
  let rest = body;
  if (!title) {
    const h = body.match(/^\s*#{1,3}\s+(.+)\s*$/m);
    if (h) title = h[1].trim();
  }
  if (!title && fileName) title = fileName.replace(/\.[a-z0-9]+$/i, "");
  if (!title) title = asText.split(/\r?\n/).find((l) => l.trim()) ? asText.split(/\r?\n/).find((l) => l.trim()).slice(0, 60) : "Imported note";

  const tags = Array.isArray(meta.tags) ? meta.tags : [];
  created.push(
    saveNote({
      title,
      body: rest.trim(),
      tags,
      linkedEntries: Array.isArray(meta.related) ? meta.related : [],
      importedFrom: fileName || "text import",
    })
  );
  return { created, skipped };
}

module.exports = { NOTES_DIR, listNotes, getNote, saveNote, deleteNote, importNotes };
