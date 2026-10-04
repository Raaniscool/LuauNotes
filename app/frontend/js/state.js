/**
 * Personal UI state — favorites, pins, learned/confusing markers, recently
 * viewed, continue-learning. Stored in localStorage so it survives reloads
 * without touching the knowledge base. Personal *notes* live on disk in
 * my-notes/ (server-side); this is just lightweight interaction state.
 */

const KEY = "luaunotes:state:v1";

const defaults = {
  theme: "dark",
  favorites: [],
  pinned: [],
  learned: [],
  confusing: [],
  recent: [], // [{id, at}]
  continueId: null,
};

let state = load();

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...defaults };
    return { ...defaults, ...JSON.parse(raw) };
  } catch {
    return { ...defaults };
  }
}

function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* storage may be unavailable — app still works */
  }
}

const listeners = new Set();
export function onStateChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
function emit() {
  save();
  for (const fn of listeners) fn(state);
}

function toggleIn(list, id) {
  const i = list.indexOf(id);
  if (i >= 0) list.splice(i, 1);
  else list.push(id);
  return i < 0; // true if now present
}

export const userState = {
  get: () => state,
  get theme() { return state.theme; },
  setTheme(t) { state.theme = t; emit(); },

  isFavorite: (id) => state.favorites.includes(id),
  toggleFavorite(id) { const on = toggleIn(state.favorites, id); emit(); return on; },

  isPinned: (id) => state.pinned.includes(id),
  togglePin(id) { const on = toggleIn(state.pinned, id); emit(); return on; },

  isLearned: (id) => state.learned.includes(id),
  toggleLearned(id) {
    const on = toggleIn(state.learned, id);
    if (on) {
      const i = state.confusing.indexOf(id);
      if (i >= 0) state.confusing.splice(i, 1);
    }
    emit();
    return on;
  },

  isConfusing: (id) => state.confusing.includes(id),
  toggleConfusing(id) {
    const on = toggleIn(state.confusing, id);
    if (on) {
      const i = state.learned.indexOf(id);
      if (i >= 0) state.learned.splice(i, 1);
    }
    emit();
    return on;
  },

  touchRecent(id) {
    state.recent = state.recent.filter((r) => r.id !== id);
    state.recent.unshift({ id, at: Date.now() });
    state.recent = state.recent.slice(0, 24);
    state.continueId = id;
    emit();
  },
};

export function applyTheme() {
  document.documentElement.dataset.theme = state.theme;
  const label = document.querySelector(".theme-label");
  if (label) label.textContent = state.theme === "dark" ? "Dark mode" : "Light mode";
}
