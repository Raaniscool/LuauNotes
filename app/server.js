"use strict";
/**
 * LuauNotes server — zero-dependency Node.js.
 *
 * Serves the frontend and a small JSON API used by the UI (and, later,
 * by AI assistants such as DukeOTR — see docs/API.md):
 *
 *   GET  /api/meta              app info + library statistics
 *   GET  /api/knowledge         lightweight index of every entry
 *   GET  /api/entry/:id         one full knowledge entry
 *   GET  /api/search?q=         scored search across knowledge + notes
 *   GET  /api/notes             list personal notes
 *   POST /api/notes             create a note
 *   PUT  /api/notes/:id         update a note
 *   DELETE /api/notes/:id       delete a note
 *   POST /api/notes/import      import pasted text / files into My Notes
 *   POST /api/reload            re-read the knowledge base from disk
 */

const http = require("http");
const fs = require("fs");
const path = require("path");
const { URL } = require("url");

const { KnowledgeStore, CATEGORIES, ROOT } = require("./lib/knowledge");
const { searchKnowledge, searchNotes } = require("./lib/search");
const notes = require("./lib/notes");

const PORT = parseInt(process.env.PORT || "4330", 10);
const HOST = process.env.HOST || "0.0.0.0";
const FRONTEND_DIR = path.join(__dirname, "frontend");

const store = new KnowledgeStore();

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".txt": "text/plain; charset=utf-8",
  ".woff2": "font/woff2",
};

function sendJSON(res, status, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  res.end(body);
}

function sendError(res, status, message) {
  sendJSON(res, status, { error: message });
}

function readBody(req, limit = 2 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on("data", (c) => {
      size += c.length;
      if (size > limit) {
        reject(new Error("payload too large"));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

function serveStatic(req, res, urlPath) {
  let rel = decodeURIComponent(urlPath);
  if (rel === "/" || rel === "") rel = "/index.html";
  // SPA fallback: unknown non-file paths serve index.html (hash router mostly
  // avoids this, but it keeps deep links safe).
  const resolved = path.normalize(path.join(FRONTEND_DIR, rel));
  if (!resolved.startsWith(FRONTEND_DIR)) return sendError(res, 403, "forbidden");

  fs.stat(resolved, (err, stat) => {
    if (!err && stat.isDirectory()) {
      rel = path.posix.join(rel, "index.html");
      return serveStatic(req, res, rel);
    }
    if (err) {
      if (rel !== "/index.html" && !path.extname(rel)) {
        rel = "/index.html";
        return serveStatic(req, res, rel);
      }
      return sendError(res, 404, "not found");
    }
    const ext = path.extname(resolved).toLowerCase();
    res.writeHead(200, {
      "Content-Type": MIME[ext] || "application/octet-stream",
      "Cache-Control": ext === ".html" ? "no-cache" : "public, max-age=300",
    });
    fs.createReadStream(resolved).pipe(res);
  });
}

function metaPayload() {
  return {
    name: "LuauNotes",
    tagline: "Roblox / Luau knowledge encyclopedia + personal learning companion",
    version: require(path.join(ROOT, "package.json")).version,
    categories: CATEGORIES,
    counts: store.countsByCategory(),
    totalEntries: store.entries.size,
    noteCount: notes.listNotes().length,
    parseErrors: store.errors.length,
  };
}

async function handleApi(req, res, url) {
  const parts = url.pathname.split("/").filter(Boolean); // ["api", ...]
  const method = req.method;

  // /api/meta
  if (parts[1] === "meta" && method === "GET") {
    return sendJSON(res, 200, metaPayload());
  }

  // /api/reload — re-read knowledge base from disk (dev convenience)
  if (parts[1] === "reload" && method === "POST") {
    store.reload();
    return sendJSON(res, 200, { ok: true, totalEntries: store.entries.size });
  }

  // /api/knowledge
  if (parts[1] === "knowledge" && method === "GET") {
    return sendJSON(res, 200, { entries: store.index });
  }

  // /api/entry/:id
  if (parts[1] === "entry" && parts[2] && method === "GET") {
    const id = decodeURIComponent(parts[2]);
    const entry = store.get(id);
    if (!entry) return sendError(res, 404, `no knowledge entry with id "${id}"`);
    const clean = { ...entry };
    delete clean._file;
    return sendJSON(res, 200, clean);
  }

  // /api/search?q=...&category=...&notes=1
  if (parts[1] === "search" && method === "GET") {
    const q = url.searchParams.get("q") || "";
    const category = url.searchParams.get("category") || undefined;
    const limit = parseInt(url.searchParams.get("limit") || "60", 10);
    const knowledge = searchKnowledge(store, q, { category, limit });
    let noteResults = [];
    if (url.searchParams.get("notes") !== "0") {
      noteResults = searchNotes(notes.listNotes(), q).map((r) => ({
        score: r.score,
        id: r.note.id,
        title: r.note.title,
        tags: r.note.tags,
        favorite: r.note.favorite,
        pinned: r.note.pinned,
        updatedAt: r.note.updatedAt,
        snippet: (r.note.body || "").replace(/\s+/g, " ").slice(0, 160),
      }));
    }
    return sendJSON(res, 200, { q, knowledge, notes: noteResults });
  }

  // /api/notes CRUD
  if (parts[1] === "notes") {
    if (parts.length === 2) {
      if (method === "GET") return sendJSON(res, 200, { notes: notes.listNotes() });
      if (method === "POST") {
        const body = JSON.parse((await readBody(req)) || "{}");
        const note = notes.saveNote(body);
        return sendJSON(res, 201, note);
      }
    }
    if (parts[2] === "import" && method === "POST") {
      const body = JSON.parse((await readBody(req)) || "{}");
      const result = notes.importNotes(body);
      return sendJSON(res, 201, result);
    }
    if (parts[2]) {
      const id = decodeURIComponent(parts[2]);
      if (method === "GET") {
        const note = notes.getNote(id);
        return note ? sendJSON(res, 200, note) : sendError(res, 404, "note not found");
      }
      if (method === "PUT") {
        const existing = notes.getNote(id);
        if (!existing) return sendError(res, 404, "note not found");
        const body = JSON.parse((await readBody(req)) || "{}");
        const note = notes.saveNote(body, { existing });
        return sendJSON(res, 200, note);
      }
      if (method === "DELETE") {
        const ok = notes.deleteNote(id);
        return ok ? sendJSON(res, 200, { ok: true }) : sendError(res, 404, "note not found");
      }
    }
  }

  return sendError(res, 404, `unknown API route: ${url.pathname}`);
}

const server = http.createServer(async (req, res) => {
  let url;
  try {
    url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
  } catch {
    return sendError(res, 400, "bad request");
  }

  try {
    if (url.pathname.startsWith("/api/")) {
      await handleApi(req, res, url);
      return;
    }
    if (req.method !== "GET" && req.method !== "HEAD") {
      return sendError(res, 405, "method not allowed");
    }
    serveStatic(req, res, url.pathname);
  } catch (err) {
    console.error("[server] error:", err.message);
    sendError(res, err.message === "payload too large" ? 413 : 500, err.message);
  }
});

server.listen(PORT, HOST, () => {
  console.log("");
  console.log("  ╔══════════════════════════════════════════════╗");
  console.log("  ║  💻 LuauNotes — Roblox / Luau Knowledge Base   ║");
  console.log("  ╚══════════════════════════════════════════════╝");
  console.log("");
  console.log(`  ▸ Local:      http://localhost:${PORT}`);
  console.log(`  ▸ On network: http://${HOST === "0.0.0.0" ? "127.0.0.1" : HOST}:${PORT}`);
  console.log(`  ▸ Knowledge:  ${store.entries.size} entries across ${CATEGORIES.length} categories`);
  if (store.errors.length > 0) {
    console.log(`  ⚠ ${store.errors.length} knowledge file(s) had problems — run "npm run validate" for details.`);
  }
  console.log("");
});
