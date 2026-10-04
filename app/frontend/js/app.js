/**
 * LuauNotes app shell — routing, sidebar, global search, command palette,
 * keyboard shortcuts, toasts and global event delegation.
 */

import { api, getIndex } from "./api.js";
import { userState, applyTheme } from "./state.js";
import { CATEGORY_META, CATEGORY_ORDER, categoryBadge } from "./render.js";
import { escapeHtml, truncate } from "./text.js";
import {
  dashboardView, categoryView, entryView, searchView,
  favoritesView, notesView, noteEditorView, noteReaderView, helpView,
  updateEntryActionButtons,
} from "./views.js";

/* ── Toasts ────────────────────────────────────────────────────────── */

window.addEventListener("toast", (e) => {
  const box = document.getElementById("toasts");
  const el = document.createElement("div");
  el.className = "toast";
  el.textContent = e.detail;
  box.appendChild(el);
  setTimeout(() => {
    el.style.opacity = "0";
    el.style.transition = "opacity 0.3s";
    setTimeout(() => el.remove(), 320);
  }, 2600);
});

/* ── Copy buttons (event delegation) ───────────────────────────────── */

document.addEventListener("click", async (e) => {
  const btn = e.target.closest("[data-copy]");
  if (!btn) return;
  const block = btn.closest(".code-block");
  const source = block ? block.querySelector(".copy-source") : null;
  const text = source ? source.textContent : block.querySelector("pre")?.textContent || "";
  try {
    await navigator.clipboard.writeText(text);
    btn.classList.add("copied");
    btn.textContent = "✓ Copied";
    setTimeout(() => {
      btn.classList.remove("copied");
      btn.innerHTML = "📋 Copy";
    }, 1500);
  } catch {
    window.dispatchEvent(new CustomEvent("toast", { detail: "Copy failed — select the code manually." }));
  }
});

/* Entry action buttons (favorite/pin/learned/confusing) */
document.addEventListener("click", (e) => {
  const btn = e.target.closest(".action-btn[data-action]");
  if (!btn) return;
  const id = btn.dataset.id;
  const action = btn.dataset.action;
  let msg = "";
  if (action === "favorite") msg = userState.toggleFavorite(id) ? "Added to favorites ⭐" : "Removed from favorites";
  if (action === "pin") msg = userState.togglePin(id) ? "Pinned 📌" : "Unpinned";
  if (action === "learned") msg = userState.toggleLearned(id) ? "Marked as learned 🎓" : "Unmarked learned";
  if (action === "confusing") msg = userState.toggleConfusing(id) ? "Marked as confusing — future you will thank you ？" : "Unmarked confusing";
  window.dispatchEvent(new CustomEvent("toast", { detail: msg }));
  updateEntryActionButtons(id);
});

/* ── Router ────────────────────────────────────────────────────────── */

const routes = [
  { re: /^\/$/, view: () => dashboardView() },
  { re: /^\/category\/([\w-]+)$/, view: (m) => categoryView(m[1]) },
  { re: /^\/entry\/([^/]+)$/, view: (m) => entryView(decodeURIComponent(m[1])) },
  { re: /^\/search\/([^/]+)(?:\/([\w-]+))?$/, view: (m) => searchView(decodeURIComponent(m[1]), m[2] ? decodeURIComponent(m[2]) : "") },
  { re: /^\/favorites$/, view: () => favoritesView() },
  { re: /^\/notes$/, view: () => notesView() },
  { re: /^\/notes\/new$/, view: () => noteEditorView("new") },
  { re: /^\/note\/([^/]+)\/edit$/, view: (m) => noteEditorView(decodeURIComponent(m[1])) },
  { re: /^\/note\/([^/]+)$/, view: (m) => noteReaderView(decodeURIComponent(m[1])) },
  { re: /^\/help$/, view: () => helpView() },
];

async function route() {
  const hash = location.hash.replace(/^#/, "") || "/";
  for (const r of routes) {
    const m = hash.match(r.re);
    if (m) {
      try {
        await r.view(m);
      } catch (err) {
        console.error(err);
        document.getElementById("view").innerHTML = `
          <div class="empty-state"><div class="empty-icon">💥</div>
          <h2>Something went wrong</h2><p>${escapeHtml(err.message)}</p>
          <p><a class="btn" href="#/">← Back to dashboard</a></p></div>`;
      }
      document.getElementById("view").scrollTop = 0;
      window.scrollTo({ top: 0 });
      updateActiveNav();
      return;
    }
  }
  document.getElementById("view").innerHTML = `
    <div class="empty-state"><div class="empty-icon">🧭</div>
    <h2>Page not found</h2><p>No route matches <code class="ic">${escapeHtml(hash)}</code></p>
    <p><a class="btn" href="#/">← Back to dashboard</a></p></div>`;
}

window.addEventListener("hashchange", route);

/* ── Sidebar ───────────────────────────────────────────────────────── */

const NAV_ICONS = {
  luau: "🧩", services: "⚙️", classes: "📦", methods: "ƒ", events: "⚡",
  properties: "◈", datatypes: "🔢", concepts: "💡", patterns: "🔁",
  gotchas: "⚠️", debugging: "🐞",
};

async function buildSidebar() {
  const nav = document.getElementById("sidebar-nav");
  const [meta, index] = await Promise.all([api.meta(), getIndex()]);
  document.getElementById("sidebar-version").textContent = `v${meta.version} · ${meta.totalEntries} entries`;

  const item = (href, icon, label, count = null, extra = "") => `
    <button class="nav-item" data-href="${href}" ${extra}>
      <span class="nav-icon">${icon}</span>
      <span class="nav-label">${label}</span>
      ${count !== null ? `<span class="nav-count">${count}</span>` : ""}
    </button>`;

  nav.innerHTML = `
    ${item("#/", "🏠", "Dashboard")}
    <div class="nav-section">
      <div class="nav-section-title">📚 Knowledge</div>
      ${CATEGORY_ORDER.filter((c) => (meta.counts[c] || 0) > 0)
        .map((c) => item(`#/category/${c}`, NAV_ICONS[c] || "•", CATEGORY_META[c].label, meta.counts[c]))
        .join("")}
    </div>
    <div class="nav-section">
      <div class="nav-section-title">👤 Personal</div>
      ${item("#/notes", "📝", "My Notes", meta.noteCount)}
      ${item("#/favorites", "⭐", "Favorites", userState.get().favorites.length)}
    </div>
    <div class="nav-section">
      <div class="nav-section-title">⚙</div>
      ${item("#/help", "⌨️", "Shortcuts & Help")}
    </div>`;

  nav.querySelectorAll(".nav-item").forEach((btn) => {
    btn.addEventListener("click", () => {
      location.hash = btn.dataset.href.replace(/^#/, "");
      closeMobileSidebar();
    });
  });
  updateActiveNav();
}

function updateActiveNav() {
  const hash = location.hash || "#/";
  document.querySelectorAll(".nav-item").forEach((btn) => {
    const href = btn.dataset.href;
    let active = false;
    if (href === "#/") active = hash === "#/" || hash === "";
    else if (href.startsWith("#/category/")) active = hash.startsWith(href);
    else if (href === "#/notes") active = hash.startsWith("#/note");
    else active = hash.startsWith(href);
    btn.classList.toggle("active", active);
  });
}

/* sidebar collapse */
function setSidebarCollapsed(collapsed) {
  document.body.classList.toggle("sidebar-collapsed", collapsed);
  try { localStorage.setItem("luaunotes:sidebar", collapsed ? "1" : "0"); } catch { /* noop */ }
}
document.getElementById("sidebar-open").addEventListener("click", () => {
  if (window.innerWidth <= 860) document.body.classList.add("sidebar-open");
  else setSidebarCollapsed(false);
});
document.getElementById("sidebar-close").addEventListener("click", () => {
  if (window.innerWidth <= 860) document.body.classList.remove("sidebar-open");
  else setSidebarCollapsed(true);
});
document.getElementById("sidebar-scrim").addEventListener("click", closeMobileSidebar);
function closeMobileSidebar() { document.body.classList.remove("sidebar-open"); }
document.querySelector(".sidebar-brand").addEventListener("click", () => { location.hash = "#/"; });

try {
  if (localStorage.getItem("luaunotes:sidebar") === "1") setSidebarCollapsed(true);
} catch { /* noop */ }

/* ── Theme ─────────────────────────────────────────────────────────── */

document.getElementById("theme-toggle").addEventListener("click", () => {
  userState.setTheme(userState.theme === "dark" ? "light" : "dark");
  applyTheme();
});

/* ── Global search box with live dropdown ──────────────────────────── */

const searchInput = document.getElementById("global-search");
const dropdown = document.getElementById("search-dropdown");
let ddSelected = -1;
let ddItems = [];
let searchTimer = null;

function renderDropdown() {
  if (!ddItems.length) {
    dropdown.classList.add("hidden");
    return;
  }
  dropdown.innerHTML =
    ddItems.map((item, i) => `
    <button class="dd-item ${i === ddSelected ? "selected" : ""}" data-dd="${i}">
      <span>${NAV_ICONS[item.category] || "•"}</span>
      <span class="dd-title">${escapeHtml(item.title)}</span>
      <span class="dd-summary">${escapeHtml(truncate(item.summary, 90))}</span>
      ${categoryBadge(item.category)}
    </button>`).join("") +
    `<div class="dd-footer">↵ full search · esc close · ${ddItems.length} quick matches</div>`;
  dropdown.classList.remove("hidden");
  dropdown.querySelectorAll("[data-dd]").forEach((b) => {
    b.addEventListener("click", () => {
      location.hash = `#/entry/${ddItems[Number(b.dataset.dd)].id}`;
      closeDropdown();
    });
  });
}

function closeDropdown() {
  dropdown.classList.add("hidden");
  ddSelected = -1;
}

searchInput.addEventListener("input", () => {
  clearTimeout(searchTimer);
  const q = searchInput.value;
  searchTimer = setTimeout(async () => {
    if (!q.trim()) return closeDropdown();
    await getIndex();
    const { quickSearch } = await import("./api.js");
    ddItems = quickSearch(q, 8);
    ddSelected = -1;
    renderDropdown();
  }, 90);
});

searchInput.addEventListener("keydown", (e) => {
  if (e.key === "ArrowDown") {
    e.preventDefault();
    ddSelected = Math.min(ddSelected + 1, ddItems.length - 1);
    renderDropdown();
  } else if (e.key === "ArrowUp") {
    e.preventDefault();
    ddSelected = Math.max(ddSelected - 1, 0);
    renderDropdown();
  } else if (e.key === "Enter") {
    e.preventDefault();
    const q = searchInput.value.trim();
    if (!q) return;
    if (ddSelected >= 0 && ddItems[ddSelected]) {
      location.hash = `#/entry/${ddItems[ddSelected].id}`;
    } else {
      location.hash = `#/search/${encodeURIComponent(q)}`;
    }
    closeDropdown();
    searchInput.blur();
  } else if (e.key === "Escape") {
    closeDropdown();
    searchInput.blur();
  }
});

document.addEventListener("click", (e) => {
  if (!e.target.closest("#search-wrap")) closeDropdown();
});

/* ── Command palette (Ctrl+K) ──────────────────────────────────────── */

const paletteOverlay = document.getElementById("palette-overlay");
const paletteInput = document.getElementById("palette-input");
const paletteResults = document.getElementById("palette-results");
let palItems = [];
let palSelected = 0;

const ACTIONS = [
  { icon: "🏠", title: "Go to Dashboard", run: () => { location.hash = "#/"; } },
  { icon: "📝", title: "Open My Notes", run: () => { location.hash = "#/notes"; } },
  { icon: "＋", title: "Create a new note", run: () => { location.hash = "#/notes/new"; } },
  { icon: "⭐", title: "Open Favorites", run: () => { location.hash = "#/favorites"; } },
  { icon: "🌗", title: "Toggle dark / light theme", run: () => { userState.setTheme(userState.theme === "dark" ? "light" : "dark"); applyTheme(); } },
  { icon: "⌨️", title: "Shortcuts & Help", run: () => { location.hash = "#/help"; } },
];

function openPalette() {
  paletteOverlay.classList.remove("hidden");
  paletteInput.value = "";
  renderPalette("");
  paletteInput.focus();
}
function closePalette() {
  paletteOverlay.classList.add("hidden");
}
document.getElementById("palette-btn").addEventListener("click", openPalette);
paletteOverlay.addEventListener("click", (e) => { if (e.target === paletteOverlay) closePalette(); });

async function renderPalette(query) {
  const q = query.trim().toLowerCase();
  const index = await getIndex();
  palItems = [];

  if (!q) {
    palItems = ACTIONS.map((a) => ({ ...a, sub: "action" }));
  } else {
    for (const a of ACTIONS) {
      if (a.title.toLowerCase().includes(q)) palItems.push({ ...a, sub: "action" });
    }
    const matches = index
      .filter((e) =>
        e.title.toLowerCase().includes(q) ||
        e.tags.join(" ").toLowerCase().includes(q) ||
        e.keywords.join(" ").toLowerCase().includes(q)
      )
      .slice(0, 9);
    for (const m of matches) {
      palItems.push({
        icon: NAV_ICONS[m.category] || "•",
        title: m.title,
        sub: `${CATEGORY_META[m.category].label}`,
        run: () => { location.hash = `#/entry/${m.id}`; },
      });
    }
  }
  palSelected = 0;
  drawPalette();
}

function drawPalette() {
  paletteResults.innerHTML = palItems.length
    ? palItems.map((p, i) => `
      <button class="palette-item ${i === palSelected ? "selected" : ""}" data-pal="${i}">
        <span>${p.icon}</span>
        <span class="pi-title">${escapeHtml(p.title)}</span>
        <span class="pi-sub">${escapeHtml(p.sub || "")}</span>
      </button>`).join("")
    : `<div style="padding:14px" class="muted">No matches.</div>`;
  paletteResults.querySelectorAll("[data-pal]").forEach((b) => {
    b.addEventListener("click", () => {
      palItems[Number(b.dataset.pal)].run();
      closePalette();
    });
  });
}

paletteInput.addEventListener("input", () => renderPalette(paletteInput.value));
paletteInput.addEventListener("keydown", (e) => {
  if (e.key === "ArrowDown") { e.preventDefault(); palSelected = Math.min(palSelected + 1, palItems.length - 1); drawPalette(); }
  else if (e.key === "ArrowUp") { e.preventDefault(); palSelected = Math.max(palSelected - 1, 0); drawPalette(); }
  else if (e.key === "Enter" && palItems[palSelected]) { e.preventDefault(); palItems[palSelected].run(); closePalette(); }
  else if (e.key === "Escape") closePalette();
});

/* ── Global keyboard shortcuts ─────────────────────────────────────── */

document.addEventListener("keydown", (e) => {
  const typing = /^(input|textarea|select)$/i.test(document.activeElement?.tagName || "");

  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
    e.preventDefault();
    openPalette();
    return;
  }
  if (e.key === "Escape") {
    closePalette();
    closeDropdown();
    return;
  }
  if (e.altKey && e.key === "ArrowLeft") {
    e.preventDefault();
    history.back();
    return;
  }
  if (typing) return;

  if (e.key === "/") {
    e.preventDefault();
    searchInput.focus();
    searchInput.select();
    return;
  }
  // entry page shortcuts
  const onEntry = location.hash.startsWith("#/entry/");
  if (onEntry) {
    const id = decodeURIComponent(location.hash.replace("#/entry/", ""));
    if (e.key.toLowerCase() === "f") { userState.toggleFavorite(id); updateEntryActionButtons(id); }
    if (e.key.toLowerCase() === "p") { userState.togglePin(id); updateEntryActionButtons(id); }
    if (e.key.toLowerCase() === "l") { userState.toggleLearned(id); updateEntryActionButtons(id); }
  }
});

/* ── Boot ──────────────────────────────────────────────────────────── */

applyTheme();
buildSidebar().catch(console.error);
route();

// keep sidebar counts fresh when notes change (cheap poll on visibility)
document.addEventListener("visibilitychange", () => {
  if (!document.hidden) buildSidebar().catch(console.error);
});
