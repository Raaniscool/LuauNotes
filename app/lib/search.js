"use strict";
/**
 * Search engine for the knowledge base and personal notes.
 *
 * Design goals (from the product spec):
 *  - search across names, classes, services, methods, properties, events,
 *    concepts, explanations, examples, mistakes, tips, patterns and notes
 *  - understand related terminology via explicit `keywords` phrases on entries
 *    (e.g. searching "player parameter" surfaces OnServerEvent / InvokeServer)
 *  - fast: everything runs against a small in-memory index built at startup
 */

const { buildSearchText } = require("./knowledge");

const MAX_RESULTS = 60;

/** Tokenize a query or text into lowercase alphanumeric words. */
function tokenize(text) {
  return String(text || "")
    .toLowerCase()
    .split(/[^a-z0-9_]+/)
    .filter((t) => t.length > 0);
}

/**
 * Score one knowledge entry against a parsed query.
 * Field weights favour titles/keywords/tags so results stay scannable.
 */
function scoreEntry(entry, q) {
  const title = String(entry.title || "").toLowerCase();
  const keywords = (entry.keywords || []).map((k) => String(k).toLowerCase());
  const tags = (entry.tags || []).map((t) => String(t).toLowerCase());
  const summary = String(entry.summary || "").toLowerCase();
  const text = q.text; // full lowercased entry text

  let score = 0;
  const matched = [];

  // 1) Full-query phrase matches — the strongest signal.
  if (q.phrase.length >= 3) {
    if (title.includes(q.phrase)) score += 140;
    for (const k of keywords) {
      if (k.includes(q.phrase)) { score += 110; break; }
    }
    for (const t of tags) {
      if (t.includes(q.phrase)) { score += 95; break; }
    }
    if (summary.includes(q.phrase)) score += 45;
    if (text.includes(q.phrase)) score += 18;
  }

  // 2) Keyword/tag phrase matches per query token-combo ("player parameter").
  for (const k of keywords) {
    const ktokens = tokenize(k);
    const hit = q.tokens.every((t) => ktokens.some((kt) => kt.startsWith(t) || t.startsWith(kt) && t.length > 2));
    if (hit && q.tokens.length > 1) score += 60;
  }

  // 3) Per-token field matches.
  const titleTokens = tokenize(title);
  const summaryTokens = tokenize(summary);
  for (const t of q.tokens) {
    let tokenScore = 0;
    if (titleTokens.some((tt) => tt === t)) tokenScore += 60;
    else if (titleTokens.some((tt) => tt.startsWith(t))) tokenScore += 34;

    if (tags.some((tag) => tokenize(tag).some((tt) => tt === t))) tokenScore += 26;
    else if (tags.some((tag) => tag.includes(t))) tokenScore += 14;

    if (keywords.some((k) => tokenize(k).includes(t))) tokenScore += 20;

    if (summaryTokens.includes(t)) tokenScore += 12;
    else if (summary.includes(t)) tokenScore += 7;

    if (text.includes(t)) tokenScore += 3;

    score += tokenScore;
    if (tokenScore > 0) matched.push(t);
  }

  // A token that matched nothing penalizes multi-word queries that don't fit.
  if (q.tokens.length > 0 && matched.length < q.tokens.length) {
    score -= 25 * (q.tokens.length - matched.length);
  }

  // Deprecation and pending content sink slightly below equivalent results.
  if (entry.deprecated && entry.deprecated.isDeprecated) score -= 12;
  if (entry._pending) score -= 8;

  return score;
}

/**
 * Search knowledge entries.
 * @param {object} store KnowledgeStore
 * @param {string} query raw query string
 * @param {{ category?: string, limit?: number }} opts
 */
function searchKnowledge(store, query, opts = {}) {
  const phrase = String(query || "").trim().toLowerCase();
  const tokens = tokenize(query);
  if (tokens.length === 0) return [];
  const q = { phrase, tokens };

  const results = [];
  for (const entry of store.entries.values()) {
    if (opts.category && entry.category !== opts.category) continue;
    const score = scoreEntry(entry, q);
    if (score > 12) {
      results.push({ entry, score });
    }
  }
  results.sort((a, b) => b.score - a.score || a.entry.title.localeCompare(b.entry.title));

  const limit = Math.min(opts.limit || MAX_RESULTS, MAX_RESULTS);
  return results.slice(0, limit).map(({ entry, score }) => ({
    score,
    id: entry.id,
    title: entry.title,
    category: entry.category,
    type: entry.type,
    summary: entry.summary,
    tags: entry.tags || [],
    status: entry.verification ? entry.verification.status : "pending",
    pending: !!entry._pending,
    deprecated: !!(entry.deprecated && entry.deprecated.isDeprecated),
    snippet: snippetFor(entry, q),
  }));
}

/** Build a short human-readable snippet around the best match. */
function snippetFor(entry, q) {
  const sources = [entry.summary];
  const ex = entry.explanation || {};
  if (ex.whatItIs) sources.push(ex.whatItIs);
  for (const s of sources) {
    if (!s) continue;
    const lower = s.toLowerCase();
    const idx = q.phrase ? lower.indexOf(q.phrase) : -1;
    if (idx >= 0) return ellipsize(s, idx, q.phrase.length);
    for (const t of q.tokens) {
      const ti = lower.indexOf(t);
      if (ti >= 0) return ellipsize(s, ti, t.length);
    }
  }
  return entry.summary || "";
}

function ellipsize(text, idx, len) {
  const start = Math.max(0, idx - 60);
  const end = Math.min(text.length, idx + len + 120);
  return (start > 0 ? "…" : "") + text.slice(start, end).replace(/\s+/g, " ").trim() + (end < text.length ? "…" : "");
}

/** Search personal notes (small corpus — linear scan is fine). */
function searchNotes(notes, query) {
  const phrase = String(query || "").trim().toLowerCase();
  const tokens = tokenize(query);
  if (tokens.length === 0) return [];
  const out = [];
  for (const note of notes) {
    const text = [note.title, note.body, (note.tags || []).join(" "), (note.warnings || []).join(" ")]
      .filter(Boolean)
      .join("\n")
      .toLowerCase();
    let score = 0;
    if (phrase && text.includes(phrase)) score += 80;
    if (String(note.title || "").toLowerCase().includes(phrase)) score += 60;
    for (const t of tokens) {
      if (String(note.title || "").toLowerCase().includes(t)) score += 25;
      if (text.includes(t)) score += 8;
      if ((note.tags || []).some((tag) => tag.toLowerCase().includes(t))) score += 15;
    }
    if (score > 0) out.push({ note, score });
  }
  out.sort((a, b) => b.score - a.score);
  return out.slice(0, MAX_RESULTS).map(({ note, score }) => ({ score, note }));
}

module.exports = { tokenize, searchKnowledge, searchNotes };
