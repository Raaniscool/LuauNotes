/**
 * API client — talks to the LuauNotes server. Keeps a small client-side
 * cache of the knowledge index so navigation and search suggestions stay
 * instant; full entries are fetched lazily.
 */

async function request(path, opts = {}) {
  const res = await fetch(path, {
    headers: { "Content-Type": "application/json" },
    ...opts,
  });
  if (!res.ok) {
    let msg = `${res.status}`;
    try {
      const body = await res.json();
      msg = body.error || msg;
    } catch { /* ignore */ }
    throw new Error(msg);
  }
  return res.json();
}

export const api = {
  meta: () => request("/api/meta"),
  entry: (id) => request(`/api/entry/${encodeURIComponent(id)}`),
  search: (q, category) =>
    request(`/api/search?q=${encodeURIComponent(q)}${category ? `&category=${encodeURIComponent(category)}` : ""}`),

  notes: () => request("/api/notes"),
  createNote: (note) => request("/api/notes", { method: "POST", body: JSON.stringify(note) }),
  updateNote: (id, patch) => request(`/api/notes/${encodeURIComponent(id)}`, { method: "PUT", body: JSON.stringify(patch) }),
  deleteNote: (id) => request(`/api/notes/${encodeURIComponent(id)}`, { method: "DELETE" }),
  importNotes: (payload) => request("/api/notes/import", { method: "POST", body: JSON.stringify(payload) }),
};

/* ── Knowledge index cache ── */

let indexCache = null;
let indexPromise = null;

export async function getIndex() {
  if (indexCache) return indexCache;
  if (!indexPromise) {
    indexPromise = request("/api/knowledge").then((data) => {
      indexCache = data.entries;
      return indexCache;
    });
  }
  return indexPromise;
}

export function getCachedIndex() {
  return indexCache;
}

export function indexById(id) {
  return indexCache ? indexCache.find((e) => e.id === id) : null;
}

export function invalidateIndex() {
  indexCache = null;
  indexPromise = null;
}

/* ── Entry cache (lazy full entries) ── */
const entryCache = new Map();
export async function getEntry(id) {
  if (entryCache.has(id)) return entryCache.get(id);
  const entry = await api.entry(id);
  entryCache.set(id, entry);
  return entry;
}

/* ── Client-side quick search over the cached index (search-as-you-type). ── */
export function quickSearch(query, limit = 8) {
  if (!indexCache) return [];
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const tokens = q.split(/[^a-z0-9_]+/).filter(Boolean);
  const scored = [];
  for (const item of indexCache) {
    const title = item.title.toLowerCase();
    const tags = item.tags.join(" ").toLowerCase();
    const keywords = item.keywords.join(" ").toLowerCase();
    const summary = item.summary.toLowerCase();
    let score = 0;
    if (title.startsWith(q)) score += 140;
    else if (title.includes(q)) score += 100;
    if (keywords.includes(q)) score += 80;
    if (tags.includes(q)) score += 60;
    for (const t of tokens) {
      if (title.includes(t)) score += 24;
      if (keywords.includes(t)) score += 14;
      if (tags.includes(t)) score += 12;
      if (summary.includes(t)) score += 5;
    }
    if (score > 0) scored.push({ item, score });
  }
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit).map((s) => s.item);
}
