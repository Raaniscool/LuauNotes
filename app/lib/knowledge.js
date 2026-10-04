"use strict";
/**
 * Knowledge store — loads the file-based knowledge base from disk,
 * validates the shape of entries, and builds the in-memory search index.
 *
 * The knowledge base is intentionally decoupled from the UI: every entry is
 * a JSON file under knowledge/<category>/<id>.json, so content can be
 * edited, versioned, validated and extended without touching app code.
 */

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..", "..");
const KNOWLEDGE_DIR = path.join(ROOT, "knowledge");

const CATEGORIES = [
  "luau",
  "services",
  "classes",
  "methods",
  "events",
  "properties",
  "datatypes",
  "concepts",
  "patterns",
  "gotchas",
  "debugging",
];

const TYPES = [
  "concept",
  "class",
  "service",
  "method",
  "event",
  "property",
  "datatype",
  "pattern",
  "gotcha",
  "function",
  "keyword",
  "library",
  "overview",
];

const VERIFICATION_STATUSES = ["verified", "review", "pending"];

/** Categories describing Roblox engine APIs — verified entries must cite a source URL. */
const API_CATEGORIES = ["services", "classes", "methods", "events", "properties", "datatypes"];

/**
 * Walk knowledge/ recursively and return all .json file paths (including
 * knowledge/_pending/ proposals).
 */
function listKnowledgeFiles(dir = KNOWLEDGE_DIR) {
  const out = [];
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) out.push(...listKnowledgeFiles(full));
    else if (name.endsWith(".json")) out.push(full);
  }
  return out;
}

/**
 * Load every knowledge entry.
 * @param {{ lenient?: boolean }} opts  lenient=true skips malformed files (used by the app so one
 *                                      broken file can't take the whole library down); the CLI
 *                                      validator uses lenient=false.
 * @returns {{ entries: Map<string,object>, errors: Array<{file:string,message:string}> }}
 */
function loadKnowledge({ lenient = true } = {}) {
  const entries = new Map();
  const errors = [];

  for (const file of listKnowledgeFiles()) {
    const rel = path.relative(ROOT, file);
    let raw;
    try {
      raw = fs.readFileSync(file, "utf8");
    } catch (err) {
      errors.push({ file: rel, message: `unreadable: ${err.message}` });
      continue;
    }

    let entry;
    try {
      entry = JSON.parse(raw);
    } catch (err) {
      errors.push({ file: rel, message: `invalid JSON: ${err.message}` });
      continue;
    }

    if (!entry || typeof entry !== "object" || typeof entry.id !== "string") {
      errors.push({ file: rel, message: "missing or invalid `id` field" });
      continue;
    }

    // Files under knowledge/_pending/ are proposals: force pending status so
    // AI-generated content can never present itself as verified.
    const inPendingDir = rel.split(path.sep).includes("_pending");
    if (inPendingDir) {
      entry.verification = Object.assign({}, entry.verification, { status: "pending" });
    }
    if (!entry.verification) entry.verification = { status: "pending" };
    if (!VERIFICATION_STATUSES.includes(entry.verification.status)) {
      entry.verification.status = "pending";
    }

    entry._file = rel;
    entry._pending = inPendingDir;

    if (entries.has(entry.id)) {
      errors.push({ file: rel, message: `duplicate id "${entry.id}" (also in ${entries.get(entry.id)._file})` });
      if (!lenient) continue;
    }
    entries.set(entry.id, entry);
  }

  return { entries, errors };
}

/** Lightweight projection used for lists, navigation and client-side search. */
function toIndexItem(entry) {
  return {
    id: entry.id,
    title: entry.title || entry.id,
    category: entry.category || "concepts",
    type: entry.type || "concept",
    summary: entry.summary || "",
    tags: Array.isArray(entry.tags) ? entry.tags : [],
    keywords: Array.isArray(entry.keywords) ? entry.keywords : [],
    status: entry.verification ? entry.verification.status : "pending",
    pending: !!entry._pending,
    deprecated: !!(entry.deprecated && entry.deprecated.isDeprecated),
    added: entry.added || null,
  };
}

/** Concatenate every piece of searchable text for an entry (lowercased). */
function buildSearchText(entry) {
  const parts = [entry.title, entry.summary];
  const kw = Array.isArray(entry.keywords) ? entry.keywords : [];
  const tags = Array.isArray(entry.tags) ? entry.tags : [];
  parts.push(...kw, ...tags);

  const ex = entry.explanation || {};
  for (const k of ["whatItIs", "whyItExists", "mentalModel"]) {
    if (typeof ex[k] === "string") parts.push(ex[k]);
  }
  for (const k of ["whenToUse", "whenNotToUse", "tips", "commonMistakes"]) {
    if (Array.isArray(ex[k])) parts.push(...ex[k]);
  }

  const ref = entry.reference || {};
  if (ref.signature) parts.push(ref.signature);
  if (Array.isArray(ref.syntax)) parts.push(...ref.syntax);
  if (typeof ref.returns === "string") parts.push(ref.returns);
  for (const k of ["parameters", "methods", "properties", "events"]) {
    if (Array.isArray(ref[k])) {
      for (const m of ref[k]) {
        if (m && typeof m === "object") {
          if (m.name) parts.push(m.name);
          if (m.signature) parts.push(m.signature);
          if (m.description) parts.push(m.description);
        }
      }
    }
  }
  if (Array.isArray(ref.details)) {
    for (const d of ref.details) {
      parts.push(d.heading || "", d.body || "");
    }
  }

  if (Array.isArray(entry.examples)) {
    for (const e of entry.examples) {
      if (!e) continue;
      if (e.title) parts.push(e.title);
      if (e.description) parts.push(e.description);
      if (e.code) parts.push(e.code);
    }
  }
  return parts.filter(Boolean).join("\n").toLowerCase();
}

/** Knowledge store singleton used by the server. */
class KnowledgeStore {
  constructor() {
    this.entries = new Map();
    this.errors = [];
    this.searchText = new Map(); // id -> lowercased full text
    this.index = []; // index items sorted by title
    this.reload();
  }

  reload() {
    const { entries, errors } = loadKnowledge({ lenient: true });
    this.entries = entries;
    this.errors = errors;
    this.searchText = new Map();
    for (const [id, entry] of entries) {
      this.searchText.set(id, buildSearchText(entry));
    }
    this.index = [...entries.values()].map(toIndexItem).sort((a, b) => a.title.localeCompare(b.title));
  }

  get(id) {
    return this.entries.get(id) || null;
  }

  countsByCategory() {
    const counts = {};
    for (const c of CATEGORIES) counts[c] = 0;
    for (const entry of this.entries.values()) {
      if (counts[entry.category] !== undefined) counts[entry.category] += 1;
    }
    return counts;
  }
}

module.exports = {
  ROOT,
  KNOWLEDGE_DIR,
  CATEGORIES,
  TYPES,
  VERIFICATION_STATUSES,
  API_CATEGORIES,
  listKnowledgeFiles,
  loadKnowledge,
  toIndexItem,
  buildSearchText,
  KnowledgeStore,
};
