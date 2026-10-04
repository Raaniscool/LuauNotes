/**
 * Views — each function returns/renders one screen of the app.
 * All data comes from the API client + local user state; views are pure
 * presentation, so the knowledge data stays fully decoupled from the UI.
 */

import { api, getIndex, getEntry, quickSearch } from "./api.js";
import { userState } from "./state.js";
import {
  CATEGORY_META, CATEGORY_ORDER,
  renderEntryPage, entryCardHtml, gotchaCardHtml, categoryBadge, typeLabel,
} from "./render.js";
import { escapeHtml, truncate, markSnippet, renderRich } from "./text.js";

const $view = () => document.getElementById("view");

function loadingHtml(label = "Loading…") {
  return `<div class="loading"><div class="spinner"></div> ${escapeHtml(label)}</div>`;
}

function emptyHtml(icon, title, sub) {
  return `<div class="empty-state"><div class="empty-icon">${icon}</div><h2>${escapeHtml(title)}</h2><p>${escapeHtml(sub || "")}</p></div>`;
}

function entryTitle(id, index) {
  const item = index.find((e) => e.id === id);
  return item ? item.title : id;
}

function rowItemHtml(id, index, sub) {
  const item = index.find((e) => e.id === id);
  if (!item) return "";
  return `
  <a class="row-item" href="#/entry/${encodeURIComponent(id)}">
    <span>${CATEGORY_META[item.category] ? CATEGORY_META[item.category].icon : "•"}</span>
    <span class="row-title">${escapeHtml(item.title)}</span>
    <span class="row-sub" style="margin-left:auto">${escapeHtml(sub || typeLabel(item.type))}</span>
  </a>`;
}

/* ── Dashboard ─────────────────────────────────────────────────────── */

const SUGGESTED = [
  "unreliable-remote-event", "remote-event", "modulescript", "debounce",
  "tween-service", "datastore-service", "client-vs-server", "waitforchild-vs-findfirstchild",
  "metatables", "collection-service", "proximity-prompt", "startergui-vs-playergui",
];

export async function dashboardView() {
  $view().innerHTML = loadingHtml("Opening the library…");
  const [index, meta, notesData] = await Promise.all([getIndex(), api.meta(), api.notes()]);
  const st = userState.get();
  const notes = notesData.notes;

  const hour = new Date().getHours();
  const greeting = hour < 5 ? "Still coding" : hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  const recent = st.recent.slice(0, 6).map((r) => rowItemHtml(r.id, index)).join("");
  const favorites = st.favorites.slice(0, 8).map((id) => rowItemHtml(id, index)).join("");
  const pinned = st.pinned.slice(0, 8).map((id) => rowItemHtml(id, index)).join("");
  const continueItem = st.continueId ? index.find((e) => e.id === st.continueId) : null;

  // Suggested: from the curated list, skip ones already learned/recently viewed
  const seen = new Set([...st.learned, ...st.recent.map((r) => r.id)]);
  const suggested = SUGGESTED.filter((id) => !seen.has(id) && index.some((e) => e.id === id)).slice(0, 6);
  const extra = index.filter((e) => !seen.has(e.id) && !suggested.includes(e.id) && e.status === "verified");
  while (suggested.length < 6 && extra.length) {
    suggested.push(extra.splice(Math.floor(Math.random() * extra.length), 1)[0].id);
  }

  // Recently added (by added date)
  const recentlyAdded = index
    .filter((e) => e.added)
    .sort((a, b) => String(b.added).localeCompare(String(a.added)))
    .slice(0, 6);

  const learnedPct = index.length ? Math.round((st.learned.length / index.length) * 100) : 0;

  const catCards = CATEGORY_ORDER.filter((c) => (meta.counts[c] || 0) > 0)
    .map((c) => {
      const m = CATEGORY_META[c];
      return `
      <a class="cat-card c-${c}" href="#/category/${c}">
        <span class="cat-name">${m.icon} ${m.label}</span>
        <span class="cat-count">${meta.counts[c]} ${meta.counts[c] === 1 ? "entry" : "entries"}</span>
      </a>`;
    })
    .join("");

  const notePreviews = notes.slice(0, 4).map((n) => `
    <a class="row-item" href="#/note/${encodeURIComponent(n.id)}">
      <span>📝</span>
      <span class="row-title">${escapeHtml(n.title)}</span>
      <span class="row-sub" style="margin-left:auto">${n.pinned ? "📌 " : ""}${n.favorite ? "⭐" : ""}</span>
    </a>`).join("");

  $view().innerHTML = `
  <div class="dash-hero">
    <h1>${greeting} 👋</h1>
    <p>The complete Roblox / Luau knowledge encyclopedia — ${meta.totalEntries} entries, plus your personal notes.</p>
    <div class="dash-search-big">
      <span class="search-icon">🔎</span>
      <input id="dash-search" type="text" placeholder='Try "UnreliableRemoteEvent", "gui not showing", "player parameter"…' autocomplete="off" />
    </div>
  </div>

  <div class="dash-grid">
    ${continueItem ? `
    <div class="card dash-section" style="grid-column: span 2">
      <h3>▶️ Continue learning</h3>
      <a class="card clickable entry-card c-${continueItem.category}" href="#/entry/${encodeURIComponent(continueItem.id)}">
        <div class="ec-head"><h3>${escapeHtml(continueItem.title)}</h3>${categoryBadge(continueItem.category)}</div>
        <p>${escapeHtml(truncate(continueItem.summary, 160))}</p>
      </a>
    </div>` : `
    <div class="card dash-section" style="grid-column: span 2">
      <h3>🚀 Start here</h3>
      <p class="muted" style="font-size:13.5px">Open any topic to start building your learning history. The ${CATEGORY_META.concepts.icon} <a href="#/category/concepts">Concepts</a> section is a great place to begin — or search for anything you've seen in Studio.</p>
    </div>`}

    <div class="card dash-section">
      <h3>🕘 Recently viewed</h3>
      ${recent || `<p class="muted" style="font-size:13px">Nothing yet — topics you open will appear here.</p>`}
    </div>

    <div class="card dash-section">
      <h3>⭐ Favorites</h3>
      ${favorites || `<p class="muted" style="font-size:13px">Star topics you use constantly and they'll live here.</p>`}
    </div>

    <div class="card dash-section">
      <h3>📌 Pinned topics</h3>
      ${pinned || `<p class="muted" style="font-size:13px">Pin the topics you're working with right now.</p>`}
    </div>

    <div class="card dash-section">
      <h3>✨ Suggested for you</h3>
      ${suggested.map((id) => rowItemHtml(id, index, "suggested")).join("")}
    </div>

    <div class="card dash-section">
      <h3>🆕 Recently added</h3>
      ${recentlyAdded.map((e) => rowItemHtml(e.id, index, e.added)).join("")}
    </div>

    <div class="card dash-section">
      <h3>📝 My notes</h3>
      ${notePreviews || `<p class="muted" style="font-size:13px">No personal notes yet. <a href="#/notes">Create one →</a></p>`}
      <div style="margin-top:8px"><a class="btn small" href="#/notes">Open My Notes</a></div>
    </div>

    <div class="card dash-section">
      <h3>🎓 Learning progress</h3>
      <div style="font-size:13.5px"><b>${st.learned.length}</b> learned · <b>${st.confusing.length}</b> confusing · <b>${index.length}</b> total</div>
      <div class="progressbar"><div style="width:${learnedPct}%"></div></div>
      <div class="muted" style="font-size:12px;margin-top:6px">${learnedPct}% of the library marked as learned</div>
      ${st.confusing.length ? `<div style="margin-top:8px">${st.confusing.slice(0, 4).map((id) => `<a class="chip" href="#/entry/${encodeURIComponent(id)}">？ ${escapeHtml(entryTitle(id, index))}</a>`).join(" ")}</div>` : ""}
    </div>
  </div>

  <h3 style="margin-top:26px">📚 Browse the library</h3>
  <div class="cat-grid">${catCards}</div>`;

  const dashSearch = document.getElementById("dash-search");
  dashSearch.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && dashSearch.value.trim()) {
      location.hash = `#/search/${encodeURIComponent(dashSearch.value.trim())}`;
    }
  });
  dashSearch.focus();
}

/* ── Category view ─────────────────────────────────────────────────── */

export async function categoryView(category) {
  const meta = CATEGORY_META[category];
  if (!meta) {
    $view().innerHTML = emptyHtml("🤷", "Unknown category", `There is no category called "${category}".`);
    return;
  }
  $view().innerHTML = loadingHtml();
  const index = await getIndex();
  const items = index.filter((e) => e.category === category).sort((a, b) => a.title.localeCompare(b.title));

  let body;
  if (category === "gotchas") {
    body = `<div class="gotcha-grid">${items.map(gotchaCardHtml).join("")}</div>`;
  } else {
    // group alphabetically for scannability
    let html = "";
    let letter = null;
    for (const item of items) {
      const L = item.title[0].toUpperCase();
      if (L !== letter) {
        letter = L;
        html += `<div class="letter-header">${escapeHtml(letter)}</div><div class="entry-grid">`;
      }
      html += entryCardHtml(item);
    }
    body = html ? html.replace(/<div class="entry-grid">(?![\s\S]*$)/g, "") : "";
    // simpler, safer: rebuild with proper closing
    html = "";
    letter = null;
    let open = false;
    for (const item of items) {
      const L = item.title[0].toUpperCase();
      if (L !== letter) {
        if (open) html += `</div>`;
        letter = L;
        html += `<div class="letter-header">${escapeHtml(letter)}</div><div class="entry-grid">`;
        open = true;
      }
      html += entryCardHtml(item);
    }
    if (open) html += `</div>`;
    body = html || emptyHtml("📭", "No entries yet", "This category is waiting for content.");
  }

  $view().innerHTML = `
  <div class="breadcrumbs"><a href="#/">Home</a><span class="sep">/</span><span class="crumb-current">${meta.icon} ${escapeHtml(meta.label)}</span></div>
  <div class="entry-header">
    <h1>${meta.icon} ${escapeHtml(meta.label)}</h1>
    <p class="entry-summary" style="font-size:14.5px">${escapeHtml(meta.blurb)} <span class="muted">· ${items.length} entries</span></p>
  </div>
  ${body}`;
}

/* ── Entry view ────────────────────────────────────────────────────── */

export async function entryView(id) {
  $view().innerHTML = loadingHtml(`Loading "${id}"…`);
  let entry;
  try {
    entry = await getEntry(id);
  } catch {
    $view().innerHTML = emptyHtml("🔍", "Entry not found", `No knowledge entry with id "${id}". It may have been renamed — try searching.`) +
      `<div style="text-align:center"><a class="btn" href="#/">← Back to dashboard</a></div>`;
    return;
  }

  userState.touchRecent(id);
  document.title = `${entry.title} — LuauNotes`;

  const [index, notesData] = await Promise.all([getIndex(), api.notes()]);
  const linkedNotes = notesData.notes.filter((n) => (n.linkedEntries || []).includes(id));

  // resolve related titles
  const relatedResolved = (entry.related || []).map((r) => ({ id: r, item: index.find((e) => e.id === r) }));

  $view().innerHTML = renderEntryPage(entry, { linkedNotes });

  // rewrite related chips with proper titles
  for (const { id: rid, item } of relatedResolved) {
    const chip = $view().querySelector(`[data-related="${CSS.escape(rid)}"]`);
    if (chip && item) chip.innerHTML = `→ ${escapeHtml(item.title)}`;
    else if (chip) chip.classList.add("hidden"); // broken link: hide (validator catches it)
  }

  updateEntryActionButtons(entry.id);

  // tabs
  const setActiveTab = (name) => {
    $view().querySelectorAll(".tab-btn").forEach((b) => b.classList.toggle("active", b.dataset.tabBtn === name));
    $view().querySelectorAll(".tab-panel").forEach((p) => {
      if (p.dataset.tabPanel) p.hidden = p.dataset.tabPanel !== name;
    });
  };
  const defaultTab = $view().querySelector(".tab-panel:not([hidden])");
  setActiveTab(defaultTab ? defaultTab.dataset.tabPanel : "explanation");
  $view().querySelectorAll(".tab-btn").forEach((btn) => {
    btn.addEventListener("click", () => setActiveTab(btn.dataset.tabBtn));
  });

  // TOC: switch tab if needed, then scroll
  $view().querySelectorAll(".toc-link").forEach((link) => {
    link.addEventListener("click", () => {
      setActiveTab(link.dataset.tab === "shared" ? guessTabForShared() : link.dataset.tab);
      const target = document.getElementById(link.dataset.target);
      if (target) target.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  });
  function guessTabForShared() {
    const active = $view().querySelector(".tab-btn.active");
    return active ? active.dataset.tabBtn : "explanation";
  }

  // scroll-spy for TOC
  const tocLinks = [...$view().querySelectorAll(".toc-link")];
  const sectionsEls = [...$view().querySelectorAll(".entry-section")];
  const spy = new IntersectionObserver(
    (entries) => {
      for (const en of entries) {
        if (en.isIntersecting) {
          tocLinks.forEach((l) => l.classList.toggle("active", l.dataset.target === en.target.id));
          break;
        }
      }
    },
    { rootMargin: "-80px 0px -70% 0px" }
  );
  sectionsEls.forEach((s) => spy.observe(s));
}

export function updateEntryActionButtons(id) {
  const st = userState;
  $view().querySelectorAll(".action-btn").forEach((btn) => {
    if (btn.dataset.id !== id) return;
    const action = btn.dataset.action;
    btn.classList.remove("on", "on-green", "on-red");
    if (action === "favorite") {
      const on = st.isFavorite(id);
      btn.classList.toggle("on", on);
      btn.innerHTML = on ? "★ Favorited" : "☆ Favorite";
    } else if (action === "pin") {
      const on = st.isPinned(id);
      btn.classList.toggle("on", on);
      btn.innerHTML = on ? "📌 Pinned" : "📌 Pin";
    } else if (action === "learned") {
      const on = st.isLearned(id);
      btn.classList.toggle("on-green", on);
      btn.innerHTML = on ? "✓ Learned" : "✓ Mark learned";
    } else if (action === "confusing") {
      const on = st.isConfusing(id);
      btn.classList.toggle("on-red", on);
      btn.innerHTML = on ? "？ Confusing" : "？ Confusing";
    }
  });
}

/* ── Search view ───────────────────────────────────────────────────── */

export async function searchView(query, category = "") {
  $view().innerHTML = loadingHtml(`Searching “${truncate(query, 40)}”…`);
  const [index, results] = await Promise.all([getIndex(), api.search(query, category || undefined)]);

  const filterChips = [
    `<button class="chip ${!category ? "active" : ""}" data-filter="">All</button>`,
    ...CATEGORY_ORDER.filter((c) => (results.knowledge.some((r) => r.category === c))).map(
      (c) => `<button class="chip ${category === c ? "active" : ""}" data-filter="${c}">${CATEGORY_META[c].icon} ${CATEGORY_META[c].label}</button>`
    ),
    results.notes.length ? `<button class="chip ${category === "notes" ? "active" : ""}" data-filter="notes">📝 My Notes</button>` : "",
  ].join("");

  const knowledgeResults = results.knowledge
    .filter((r) => !category || category === "notes" || r.category === category)
    .map((r) => `
    <a class="card clickable result-item c-${r.category}" href="#/entry/${encodeURIComponent(r.id)}">
      <div class="ri-top">
        <h3>${escapeHtml(r.title)}</h3>
        ${categoryBadge(r.category)}
        <span class="badge outline">${escapeHtml(typeLabel(r.type))}</span>
        ${r.pending ? `<span class="badge pending">pending</span>` : ""}
        ${r.deprecated ? `<span class="badge deprecated">deprecated</span>` : ""}
      </div>
      <div class="ri-snippet">${markSnippet(r.snippet || r.summary, query)}</div>
    </a>`)
    .join("");

  const noteResults = category === "notes" || !category
    ? results.notes.map((n) => `
      <a class="card clickable result-item" href="#/note/${encodeURIComponent(n.id)}">
        <div class="ri-top">
          <h3>📝 ${escapeHtml(n.title)}</h3>
          <span class="result-note-tag">My Note</span>
          ${n.pinned ? "<span>📌</span>" : ""}${n.favorite ? "<span>⭐</span>" : ""}
        </div>
        <div class="ri-snippet">${markSnippet(n.snippet, query)}</div>
      </a>`).join("")
    : "";

  const total = results.knowledge.filter((r) => !category || category === "notes" || r.category === category).length + (category === "notes" || !category ? results.notes.length : 0);

  $view().innerHTML = `
  <div class="breadcrumbs"><a href="#/">Home</a><span class="sep">/</span><span class="crumb-current">Search</span></div>
  <div class="search-page-head">
    <h1>Results for “${escapeHtml(query)}”</h1>
    <span class="muted" style="font-size:13px">${total} result${total === 1 ? "" : "s"} across the knowledge base and your notes</span>
  </div>
  <div class="filter-chips">${filterChips}</div>
  <div style="display:flex;flex-direction:column;gap:10px">
    ${knowledgeResults}
    ${noteResults ? `<div class="section-label" style="margin-top:14px">📝 From My Notes</div>${noteResults}` : ""}
  </div>
  ${total === 0 ? emptyHtml("🔎", "Nothing found", "Try different words — or a broader term. Search covers names, explanations, examples, mistakes, tips and your notes.") : ""}`;

  $view().querySelectorAll("[data-filter]").forEach((chip) => {
    chip.addEventListener("click", () => {
      const f = chip.dataset.filter;
      location.hash = f ? `#/search/${encodeURIComponent(query)}/${encodeURIComponent(f)}` : `#/search/${encodeURIComponent(query)}`;
    });
  });
}

/* ── Favorites view ────────────────────────────────────────────────── */

export async function favoritesView() {
  $view().innerHTML = loadingHtml();
  const index = await getIndex();
  const st = userState.get();
  const items = st.favorites.map((id) => index.find((e) => e.id === id)).filter(Boolean);
  $view().innerHTML = `
  <div class="breadcrumbs"><a href="#/">Home</a><span class="sep">/</span><span class="crumb-current">⭐ Favorites</span></div>
  <div class="entry-header"><h1>⭐ Favorites</h1>
  <p class="entry-summary" style="font-size:14.5px">Topics you've starred for quick access.</p></div>
  ${items.length ? `<div class="entry-grid">${items.map(entryCardHtml).join("")}</div>` : emptyHtml("⭐", "No favorites yet", "Open any topic and press “Favorite” (or the F key) to keep it here.")}`;
}

/* ── Notes list ────────────────────────────────────────────────────── */

export async function notesView() {
  $view().innerHTML = loadingHtml("Loading your notes…");
  const [index, notesData, meta] = await Promise.all([getIndex(), api.notes(), api.meta()]);
  const notes = notesData.notes;

  const noteCards = notes.map((n) => {
    const linked = (n.linkedEntries || [])
      .map((id) => index.find((e) => e.id === id))
      .filter(Boolean)
      .slice(0, 3);
    return `
    <a class="card clickable entry-card" href="#/note/${encodeURIComponent(n.id)}">
      <div class="ec-head">
        <h3>${n.pinned ? "📌 " : ""}${n.favorite ? "⭐ " : ""}${escapeHtml(n.title)}</h3>
      </div>
      <p>${escapeHtml(truncate((n.body || "").replace(/[#`>*]/g, "").replace(/\s+/g, " "), 170)) || "<i>Empty note</i>"}</p>
      <div class="ec-tags">
        ${(n.tags || []).slice(0, 4).map((t) => `<span class="chip">${escapeHtml(t)}</span>`).join("")}
        ${linked.map((e) => `<span class="chip" style="color:var(--accent)">→ ${escapeHtml(e.title)}</span>`).join("")}
      </div>
    </a>`;
  }).join("");

  $view().innerHTML = `
  <div class="breadcrumbs"><a href="#/">Home</a><span class="sep">/</span><span class="crumb-current">📝 My Notes</span></div>
  <div class="entry-header">
    <h1>📝 My Notes</h1>
    <p class="entry-summary" style="font-size:14.5px">
      Your personal learning layer — ${notes.length} note${notes.length === 1 ? "" : "s"}. Notes live on top of the official library, never inside it.
      Stored as JSON in <code class="ic">my-notes/</code>, versioned with the repo.
    </p>
  </div>
  <div class="notes-toolbar">
    <input type="text" id="notes-filter" placeholder="Filter notes by text or tag…" />
    <button class="btn" id="import-notes-btn">📥 Import</button>
    <a class="btn primary" href="#/notes/new">＋ New note</a>
  </div>
  ${notes.length ? `<div class="entry-grid" id="notes-grid">${noteCards}</div>` :
    emptyHtml("📝", "No notes yet", "Create your first personal note, or import your old Notes-app dumps with the Import button.")}`;

  // filter
  document.getElementById("notes-filter").addEventListener("input", (e) => {
    const q = e.target.value.trim().toLowerCase();
    document.querySelectorAll("#notes-grid .entry-card").forEach((card, i) => {
      const n = notes[i];
      const text = [n.title, n.body, (n.tags || []).join(" ")].join(" ").toLowerCase();
      card.style.display = !q || text.includes(q) ? "" : "none";
    });
  });

  document.getElementById("import-notes-btn").addEventListener("click", () => openImportModal(meta));
}

async function openImportModal(meta) {
  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";
  overlay.innerHTML = `
  <div class="modal">
    <h2>📥 Import notes</h2>
    <p class="muted" style="font-size:13px">Paste text/Markdown, or choose files (.txt, .md, .json). Imported notes go into <b>My Notes</b> — they never touch the official reference library.</p>
    <div class="field">
      <label for="import-file">Files</label>
      <input type="file" id="import-file" multiple accept=".txt,.md,.markdown,.json" />
    </div>
    <div class="field" style="margin-top:12px">
      <label for="import-text">Or paste content</label>
      <textarea id="import-text" style="min-height:140px" placeholder="# My old note&#10;&#10;Paste anything here…"></textarea>
    </div>
    <div class="modal-actions">
      <button class="btn" data-close>Cancel</button>
      <button class="btn primary" id="do-import">Import</button>
    </div>
  </div>`;
  document.body.appendChild(overlay);
  overlay.addEventListener("click", (e) => { if (e.target === overlay || e.target.dataset.close !== undefined) overlay.remove(); });

  document.getElementById("do-import").addEventListener("click", async () => {
    const files = [...document.getElementById("import-file").files];
    const text = document.getElementById("import-text").value;
    let created = 0;
    try {
      if (text.trim()) {
        const r = await api.importNotes({ format: "text", content: text });
        created += r.created.length;
      }
      for (const f of files) {
        const content = await f.text();
        const format = f.name.endsWith(".json") ? "json" : "text";
        const r = await api.importNotes({ format, content, fileName: f.name });
        created += r.created.length;
      }
      overlay.remove();
      window.dispatchEvent(new CustomEvent("toast", { detail: `Imported ${created} note${created === 1 ? "" : "s"} into My Notes 🎉` }));
      notesView();
    } catch (err) {
      window.dispatchEvent(new CustomEvent("toast", { detail: `Import failed: ${err.message}` }));
    }
  });
}

/* ── Note editor ───────────────────────────────────────────────────── */

export async function noteEditorView(noteId) {
  const isNew = noteId === "new" || !noteId;
  $view().innerHTML = loadingHtml();
  const [index, notesData] = await Promise.all([getIndex(), api.notes()]);
  const note = isNew
    ? { id: null, title: "", body: "", tags: [], favorite: false, pinned: false, linkedEntries: [], warnings: [] }
    : notesData.notes.find((n) => n.id === noteId);

  if (!note) {
    $view().innerHTML = emptyHtml("📝", "Note not found", "It may have been deleted.");
    return;
  }
  document.title = `${isNew ? "New note" : note.title} — LuauNotes`;

  const linkedChips = () => {
    const el = document.getElementById("linked-chips");
    if (!el) return;
    el.innerHTML = (note.linkedEntries || []).map((id) => {
      const item = index.find((e) => e.id === id);
      return `<span class="chip" data-linked="${escapeHtml(id)}">→ ${escapeHtml(item ? item.title : id)} <b style="cursor:pointer" data-unlink="${escapeHtml(id)}">✕</b></span>`;
    }).join("") || `<span class="muted" style="font-size:12.5px">No linked topics yet — search below to attach this note to API pages.</span>`;
    el.querySelectorAll("[data-unlink]").forEach((x) => {
      x.addEventListener("click", (e) => {
        e.preventDefault();
        note.linkedEntries = note.linkedEntries.filter((i) => i !== x.dataset.unlink);
        linkedChips();
      });
    });
  };

  $view().innerHTML = `
  <div class="breadcrumbs">
    <a href="#/">Home</a><span class="sep">/</span>
    <a href="#/notes">My Notes</a><span class="sep">/</span>
    <span class="crumb-current">${isNew ? "New note" : escapeHtml(note.title || "Edit")}</span>
  </div>
  <div class="entry-header">
    <h1>${isNew ? "📝 New personal note" : "📝 Edit note"}</h1>
    <p class="muted" style="font-size:13px">Personal layer — stored in my-notes/, kept separate from the verified reference library.</p>
  </div>

  <div class="note-editor">
    <div class="field">
      <label for="note-title">Title</label>
      <input type="text" id="note-title" value="${escapeHtml(note.title)}" placeholder="e.g. ModuleScripts finally make sense" />
    </div>

    <div class="field">
      <label for="note-tags">Tags <span class="muted" style="text-transform:none;font-weight:400">(comma separated)</span></label>
      <input type="text" id="note-tags" value="${escapeHtml((note.tags || []).join(", "))}" placeholder="remotes, gui, learning" />
    </div>

    <div class="field">
      <label>Linked knowledge topics</label>
      <div class="linked-entry-picker">
        <div id="linked-chips" style="display:flex;gap:7px;flex-wrap:wrap"></div>
        <input type="text" id="link-search" placeholder="Search the library to link a topic… (e.g. 'remote')" autocomplete="off" />
        <div id="link-results" class="picker-results hidden"></div>
      </div>
    </div>

    <div class="field">
      <label for="note-body">Note</label>
      <textarea id="note-body" placeholder="Write freely. Supports **bold**, \`inline code\`, - bullets and \`\`\`lua code fences.">${escapeHtml(note.body)}</textarea>
      <div class="hint">Markdown-lite supported: **bold**, \`code\`, - bullets, 1. lists, &gt; quotes, \`\`\`lua fences.</div>
    </div>

    <div class="toggle-row">
      <button class="toggle-chip ${note.favorite ? "on" : ""}" id="tg-favorite">⭐ Favorite</button>
      <button class="toggle-chip ${note.pinned ? "on" : ""}" id="tg-pinned">📌 Pin</button>
    </div>

    <div style="display:flex;gap:10px;flex-wrap:wrap">
      <button class="btn primary" id="save-note">💾 Save note</button>
      <a class="btn" href="#/notes">Cancel</a>
      ${!isNew ? `<button class="btn danger" id="delete-note" style="margin-left:auto">🗑 Delete</button>` : ""}
    </div>

    ${!isNew && note.importedFrom ? `<p class="muted" style="font-size:12px">Imported from: ${escapeHtml(note.importedFrom)} · created ${escapeHtml(String(note.createdAt || "").slice(0, 10))}</p>` : ""}
  </div>`;

  linkedChips();

  // favorite/pinned toggles
  const tgFav = document.getElementById("tg-favorite");
  const tgPin = document.getElementById("tg-pinned");
  tgFav.addEventListener("click", () => { note.favorite = !note.favorite; tgFav.classList.toggle("on", note.favorite); });
  tgPin.addEventListener("click", () => { note.pinned = !note.pinned; tgPin.classList.toggle("on", note.pinned); });

  // link picker
  const linkInput = document.getElementById("link-search");
  const linkResults = document.getElementById("link-results");
  linkInput.addEventListener("input", () => {
    const q = linkInput.value.trim().toLowerCase();
    if (!q) { linkResults.classList.add("hidden"); return; }
    const matches = index.filter((e) =>
      e.title.toLowerCase().includes(q) || e.tags.join(" ").toLowerCase().includes(q)
    ).slice(0, 8);
    linkResults.innerHTML = matches.map((m) =>
      `<button class="row-item" data-link="${escapeHtml(m.id)}">${CATEGORY_META[m.category].icon} <span class="row-title">${escapeHtml(m.title)}</span><span class="row-sub" style="margin-left:auto">${CATEGORY_META[m.category].label}</span></button>`
    ).join("") || `<div style="padding:10px" class="muted">No matches.</div>`;
    linkResults.classList.remove("hidden");
    linkResults.querySelectorAll("[data-link]").forEach((btn) => {
      btn.addEventListener("click", () => {
        if (!note.linkedEntries.includes(btn.dataset.link)) note.linkedEntries.push(btn.dataset.link);
        linkInput.value = "";
        linkResults.classList.add("hidden");
        linkedChips();
      });
    });
  });

  document.getElementById("save-note").addEventListener("click", async () => {
    const payload = {
      title: document.getElementById("note-title").value || "Untitled",
      tags: document.getElementById("note-tags").value.split(",").map((t) => t.trim()).filter(Boolean),
      body: document.getElementById("note-body").value,
      favorite: note.favorite,
      pinned: note.pinned,
      linkedEntries: note.linkedEntries,
    };
    try {
      if (isNew) {
        const created = await api.createNote(payload);
        window.dispatchEvent(new CustomEvent("toast", { detail: "Note saved 📝" }));
        location.hash = `#/note/${created.id}`;
      } else {
        await api.updateNote(note.id, payload);
        window.dispatchEvent(new CustomEvent("toast", { detail: "Note updated ✓" }));
        noteEditorView(note.id);
      }
    } catch (err) {
      window.dispatchEvent(new CustomEvent("toast", { detail: `Save failed: ${err.message}` }));
    }
  });

  if (!isNew) {
    document.getElementById("delete-note").addEventListener("click", async () => {
      if (!confirm(`Delete note "${note.title}"? This cannot be undone.`)) return;
      await api.deleteNote(note.id);
      window.dispatchEvent(new CustomEvent("toast", { detail: "Note deleted" }));
      location.hash = "#/notes";
    });
  }
}

/* ── Note reader ───────────────────────────────────────────────────── */

export async function noteReaderView(noteId) {
  $view().innerHTML = loadingHtml();
  const [index, notesData] = await Promise.all([getIndex(), api.notes()]);
  const note = notesData.notes.find((n) => n.id === noteId);
  if (!note) {
    $view().innerHTML = emptyHtml("📝", "Note not found", "It may have been deleted.");
    return;
  }
  document.title = `${note.title} — My Notes`;

  const linked = (note.linkedEntries || []).map((id) => index.find((e) => e.id === id)).filter(Boolean);

  $view().innerHTML = `
  <div class="breadcrumbs">
    <a href="#/">Home</a><span class="sep">/</span>
    <a href="#/notes">My Notes</a><span class="sep">/</span>
    <span class="crumb-current">${escapeHtml(note.title)}</span>
  </div>
  <div class="entry-header">
    <div class="entry-title-row">
      <div style="min-width:0">
        <h1>${note.pinned ? "📌 " : ""}${note.favorite ? "⭐ " : ""}${escapeHtml(note.title)}</h1>
        <div class="entry-badges">
          <span class="badge cat c-notes">📝 Personal note</span>
          ${(note.tags || []).map((t) => `<span class="chip">${escapeHtml(t)}</span>`).join("")}
        </div>
      </div>
      <div class="entry-actions">
        <a class="action-btn" href="#/note/${encodeURIComponent(note.id)}/edit">✏️ Edit</a>
      </div>
    </div>
    <p class="muted" style="font-size:12.5px">Last updated ${escapeHtml(String(note.updatedAt || "").slice(0, 16).replace("T", " "))}</p>
  </div>

  <div class="entry-layout">
    <div class="entry-main">
      <div class="card" style="max-width:880px">
        ${renderRich(note.body || "*This note is empty.*")}
      </div>

      ${linked.length ? `
      <section class="entry-section" style="margin-top:22px">
        <h2><span class="sec-icon">🔗</span> Linked knowledge topics</h2>
        <div class="related-chips">
          ${linked.map((e) => `<a class="chip" href="#/entry/${encodeURIComponent(e.id)}">→ ${escapeHtml(e.title)}</a>`).join("")}
        </div>
      </section>` : ""}
    </div>
    <aside class="entry-rail">
      <div class="rail-card">
        <h4>Note status</h4>
        <div class="meta-list">
          <div>Favorite: <b>${note.favorite ? "yes ⭐" : "no"}</b></div>
          <div>Pinned: <b>${note.pinned ? "yes 📌" : "no"}</b></div>
          <div>Linked topics: <b>${linked.length}</b></div>
          <div>Tags: <b>${(note.tags || []).length}</b></div>
        </div>
      </div>
    </aside>
  </div>`;
}

/* ── Help view ─────────────────────────────────────────────────────── */

export function helpView() {
  $view().innerHTML = `
  <div class="breadcrumbs"><a href="#/">Home</a><span class="sep">/</span><span class="crumb-current">Help</span></div>
  <h1>⌨️ Keyboard shortcuts & how LuauNotes works</h1>
  <div class="card" style="max-width:760px;margin-top:14px">
    <table class="kbd-table">
      <tr><td><kbd class="k">/</kbd></td><td>Focus global search</td></tr>
      <tr><td><kbd class="k">Ctrl</kbd> + <kbd class="k">K</kbd></td><td>Command palette — jump anywhere instantly</td></tr>
      <tr><td><kbd class="k">Esc</kbd></td><td>Close search dropdown / palette</td></tr>
      <tr><td><kbd class="k">Alt</kbd> + <kbd class="k">←</kbd></td><td>Back</td></tr>
      <tr><td><kbd class="k">F</kbd></td><td>Favorite (on a topic page)</td></tr>
      <tr><td><kbd class="k">P</kbd></td><td>Pin (on a topic page)</td></tr>
      <tr><td><kbd class="k">L</kbd></td><td>Mark learned (on a topic page)</td></tr>
    </table>
  </div>
  <h2 style="margin-top:26px">🏛 Two layers, one library</h2>
  <div class="dash-grid" style="max-width:760px">
    <div class="card">
      <h3>🛡️ Verified reference</h3>
      <p class="muted" style="font-size:13.5px">The encyclopedia: ${"structured JSON entries"} in <code class="ic">knowledge/</code>, validated in CI, sourced from authoritative Roblox documentation. Badges tell you exactly how verified each page is.</p>
    </div>
    <div class="card">
      <h3>📝 Personal layer</h3>
      <p class="muted" style="font-size:13.5px">Your notes in <code class="ic">my-notes/</code>: thoughts, warnings, progress. They link onto official pages but never modify them.</p>
    </div>
  </div>`;
}
