/**
 * Renderers — turn knowledge entries (plain JSON) into polished HTML.
 * The UI never needs to know the exact structure of any single entry:
 * everything is driven by optional fields, so new entries can be richer
 * without code changes.
 */

import { escapeHtml, renderRich, codeBlockHtml, truncate } from "./text.js";

/* ── Category metadata ─────────────────────────────────────────────── */

export const CATEGORY_META = {
  luau:       { label: "Luau",             icon: "🧩", blurb: "The language itself — variables, tables, functions, loops, metatables, type checking and more." },
  services:   { label: "Roblox Services",  icon: "⚙️", blurb: "The services you get via game:GetService(...) — what each one does and when to reach for it." },
  classes:    { label: "Classes & Objects",icon: "📦", blurb: "Instance classes: parts, GUIs, remotes, tools, sounds, animations and everything you put in the world." },
  methods:    { label: "Methods",          icon: "ƒ",  blurb: "Individual API methods — signatures, parameters, return values and how to use them." },
  events:     { label: "Events",           icon: "⚡", blurb: "Signals you connect to: when they fire, what arguments they pass, and how to handle them." },
  properties: { label: "Properties",       icon: "◈",  blurb: "Important Instance properties and the behaviors hiding behind them." },
  datatypes:  { label: "Data Types",       icon: "🔢", blurb: "Roblox value types: Vector3, CFrame, Color3, UDim2, Enum, TweenInfo…" },
  concepts:   { label: "Concepts",         icon: "💡", blurb: "The ideas behind the API: client vs server, replication, serialization, yielding…" },
  patterns:   { label: "Patterns",         icon: "🔁", blurb: "Reusable recipes: debounce, cooldowns, remote communication, save systems…" },
  gotchas:    { label: "Gotchas",          icon: "⚠️", blurb: "The classic mistakes — quick-reference cards for the things that trip everyone up." },
  debugging:  { label: "Debugging",        icon: "🐞", blurb: "Finding and fixing problems: the Output window, the debugger, error messages." },
};

export const CATEGORY_ORDER = Object.keys(CATEGORY_META);

const TYPE_LABEL = {
  concept: "Concept", class: "Class", service: "Service", method: "Method",
  event: "Event", property: "Property", datatype: "Data type", pattern: "Pattern",
  gotcha: "Gotcha", function: "Function", keyword: "Keyword", library: "Library", overview: "Overview",
};

export function typeLabel(t) { return TYPE_LABEL[t] || t; }

/* ── Badges ────────────────────────────────────────────────────────── */

export function categoryBadge(cat) {
  const meta = CATEGORY_META[cat] || { label: cat, icon: "•" };
  return `<span class="badge cat c-${cat}">${meta.icon} ${escapeHtml(meta.label)}</span>`;
}

export function typeBadge(type) {
  return `<span class="badge outline">${escapeHtml(typeLabel(type))}</span>`;
}

export function verificationBadge(entry) {
  const status = entry.verification ? entry.verification.status : "pending";
  if (status === "verified") return `<span class="badge verified" title="Checked against the cited authoritative source">✓ Verified</span>`;
  if (status === "review") return `<span class="badge review" title="Believed correct, awaiting a verification pass">◐ Needs review</span>`;
  return `<span class="badge pending" title="Unreviewed proposal — do not rely on this yet">⚠ Pending</span>`;
}

export function deprecatedBadge() {
  return `<span class="badge deprecated">⛔ Deprecated</span>`;
}

export function statusBadges(entry) {
  let html = verificationBadge(entry);
  if (entry.deprecated && entry.deprecated.isDeprecated) html += deprecatedBadge();
  return html;
}

/* ── Entry cards (lists, search, dashboard) ────────────────────────── */

export function entryCardHtml(item) {
  const tags = (item.tags || []).slice(0, 4);
  return `
  <a class="card clickable entry-card c-${item.category}" href="#/entry/${encodeURIComponent(item.id)}">
    <div class="ec-head">
      <h3>${escapeHtml(item.title)}</h3>
      ${categoryBadge(item.category)}
    </div>
    <p>${escapeHtml(truncate(item.summary, 150))}</p>
    <div class="ec-tags">
      ${tags.map((t) => `<span class="chip">${escapeHtml(t)}</span>`).join("")}
    </div>
  </a>`;
}

export function gotchaCardHtml(item) {
  return `
  <a class="card clickable gotcha-card" href="#/entry/${encodeURIComponent(item.id)}">
    <div class="gc-title">⚠️ ${escapeHtml(item.title.toUpperCase())}</div>
    <div class="gc-body">${escapeHtml(truncate(item.summary, 160))}</div>
  </a>`;
}

/* ── Small shared bits ─────────────────────────────────────────────── */

function memberList(members, kind) {
  if (!Array.isArray(members) || members.length === 0) return "";
  return `
  <div class="member-list">
    ${members
      .map((m) => `
      <div class="member">
        ${m.signature ? `<div class="member-sig">${escapeHtml(m.signature)}</div>` : `<div class="member-name">${escapeHtml(m.name)}</div>`}
        ${m.type ? `<span class="param-type">${escapeHtml(m.type)}</span>` : ""}
        <div class="member-desc">${renderRich(m.description)}</div>
      </div>`)
      .join("")}
  </div>`;
}

function paramsTable(params) {
  if (!Array.isArray(params) || params.length === 0) return "";
  return `
  <table class="ref-table">
    <thead><tr><th>Name</th><th>Type</th><th>Default</th><th>Description</th></tr></thead>
    <tbody>
      ${params
        .map(
          (p) => `
        <tr>
          <td><span class="param-name">${escapeHtml(p.name)}</span></td>
          <td><span class="param-type">${escapeHtml(p.type || "")}</span></td>
          <td><span class="param-default">${escapeHtml(p.default || "—")}</span></td>
          <td>${renderRich(p.description)}</td>
        </tr>`
        )
        .join("")}
    </tbody>
  </table>`;
}

/* ── Full entry page ───────────────────────────────────────────────── */

const REFERENCE_FIRST = new Set(["services", "classes", "methods", "events", "properties", "datatypes"]);

export function renderEntryPage(entry, { linkedNotes = [] } = {}) {
  const ex = entry.explanation || {};
  const ref = entry.reference || {};
  const cat = entry.category;

  /* Collect sections: {id, label, icon, tab, html} */
  const sections = [];
  const add = (id, label, icon, tab, html) => {
    if (html && html.trim()) sections.push({ id, label, icon, tab, html });
  };

  /* Explanation tab */
  add("what-it-is", "What it is", "📖", "explanation", ex.whatItIs ? renderRich(ex.whatItIs) : "");
  add("why-it-exists", "Why it exists", "🧭", "explanation", ex.whyItExists ? renderRich(ex.whyItExists) : "");
  if (Array.isArray(ex.whenToUse) && ex.whenToUse.length) {
    add("when-to-use", "When to use it", "✅", "explanation",
      `<ul class="use-list do">${ex.whenToUse.map((s) => `<li>${renderRich(s)}</li>`).join("")}</ul>`);
  }
  if (Array.isArray(ex.whenNotToUse) && ex.whenNotToUse.length) {
    add("when-not-to-use", "When NOT to use it", "🚫", "explanation",
      `<ul class="use-list dont">${ex.whenNotToUse.map((s) => `<li>${renderRich(s)}</li>`).join("")}</ul>`);
  }
  add("mental-model", "Mental model", "🧠", "explanation", ex.mentalModel ? renderRich(ex.mentalModel) : "");

  /* Reference tab */
  const syntaxCode = [ref.signature, ...(Array.isArray(ref.syntax) ? ref.syntax : [])].filter(Boolean);
  if (syntaxCode.length) {
    add("signature", cat === "concepts" || cat === "patterns" ? "Syntax" : "Signature & syntax", "⌨️", "reference",
      syntaxCode.map((s) => codeBlockHtml(s, { language: "lua" })).join(""));
  }
  add("parameters", "Parameters", "📥", "reference", paramsTable(ref.parameters));
  add("returns", "Return values", "📤", "reference", ref.returns ? renderRich(ref.returns) : "");
  add("methods", "Methods", "ƒ", "reference", memberList(ref.methods, "method"));
  add("events", "Events", "⚡", "reference", memberList(ref.events, "event"));
  add("properties", "Properties", "◈", "reference", memberList(ref.properties, "property"));
  if (Array.isArray(ref.details) && ref.details.length) {
    add("technical-details", "Technical details", "🔬", "reference",
      ref.details.map((d) => `<div class="entry-section-inner"><h3 style="font-size:14px;margin:14px 0 4px">${escapeHtml(d.heading)}</h3>${renderRich(d.body)}</div>`).join(""));
  }

  /* Shared sections (visible regardless of tab) */
  if (Array.isArray(entry.examples) && entry.examples.length) {
    add("examples", "Examples", "🧪", "shared", entry.examples.map((e) => exampleCardHtml(e)).join(""));
  }
  if (Array.isArray(ex.commonMistakes) && ex.commonMistakes.length) {
    add("common-mistakes", "Common mistakes", "⚠️", "shared",
      ex.commonMistakes.map((m) => `<div class="mistake-card"><span class="mk-icon">⚠️</span><div>${renderRich(m)}</div></div>`).join(""));
  }
  if (Array.isArray(ex.tips) && ex.tips.length) {
    add("tips", "Tips", "💡", "shared",
      ex.tips.map((t) => `<div class="tip-card"><span>💡</span><div>${renderRich(t)}</div></div>`).join(""));
  }
  if (Array.isArray(entry.related) && entry.related.length) {
    add("related", "Related", "🔗", "shared",
      `<div class="related-chips">${entry.related.map((r) => `<a class="chip" data-related="${escapeHtml(r)}" href="#/entry/${encodeURIComponent(r)}">→ ${escapeHtml(r)}</a>`).join("")}</div>`);
  }
  add("source", "Source & verification", "🛡️", "shared", sourceCardHtml(entry));
  if (linkedNotes.length) {
    add("my-notes", "My notes on this topic", "📝", "shared",
      linkedNotes.map((n) => `
        <a class="note-mini" href="#/note/${encodeURIComponent(n.id)}">
          <h5>📝 ${escapeHtml(n.title)}</h5>
          <p>${escapeHtml(truncate((n.body || "").replace(/[#`>*-]/g, ""), 120))}</p>
        </a>`).join(""));
  }

  const defaultTab = REFERENCE_FIRST.has(cat) ? "reference" : "explanation";
  const explSections = sections.filter((s) => s.tab === "explanation");
  const refSections = sections.filter((s) => s.tab === "reference");
  const sharedSections = sections.filter((s) => s.tab === "shared");

  const hasReference = refSections.length > 0;

  const sectionHtml = (s) => `
    <section class="entry-section" id="sec-${s.id}" data-tab="${s.tab}">
      <h2><span class="sec-icon">${s.icon}</span> ${s.label}</h2>
      <div class="sec-body">${s.html}</div>
    </section>`;

  const tocHtml = sections
    .map((s) => `<button class="toc-link" data-tab="${s.tab}" data-target="sec-${s.id}">${s.label}</button>`)
    .join("");

  const meta = CATEGORY_META[cat] || { label: cat };
  const v = entry.verification || {};

  return `
  <div class="breadcrumbs">
    <a href="#/">Home</a><span class="sep">/</span>
    <a href="#/category/${cat}">${escapeHtml(meta.label)}</a><span class="sep">/</span>
    <span class="crumb-current">${escapeHtml(entry.title)}</span>
  </div>

  <header class="entry-header">
    <div class="entry-title-row">
      <div style="min-width:0">
        <h1>${escapeHtml(entry.title)}</h1>
        <div class="entry-badges">
          ${categoryBadge(cat)} ${typeBadge(entry.type)} ${statusBadges(entry)}
        </div>
      </div>
      <div class="entry-actions">
        <button class="action-btn" data-action="favorite" data-id="${escapeHtml(entry.id)}" title="Favorite (F)">☆ Favorite</button>
        <button class="action-btn" data-action="pin" data-id="${escapeHtml(entry.id)}" title="Pin (P)">📌 Pin</button>
        <button class="action-btn" data-action="learned" data-id="${escapeHtml(entry.id)}" title="Mark as learned (L)">✓ Learned</button>
        <button class="action-btn" data-action="confusing" data-id="${escapeHtml(entry.id)}" title="Mark as confusing">？ Confusing</button>
      </div>
    </div>
    <p class="entry-summary">${escapeHtml(entry.summary || "")}</p>
  </header>

  ${entry.deprecated && entry.deprecated.isDeprecated ? `
    <div class="deprecated-banner">⛔ <div><b>Deprecated.</b> ${entry.deprecated.replacement ? `Use <b>${escapeHtml(entry.deprecated.replacement)}</b> instead.` : ""} ${escapeHtml(entry.deprecated.notes || "")}</div></div>` : ""}
  ${entry._pending || v.status === "pending" ? `
    <div class="pending-banner">⚠ <div>This entry is an <b>unreviewed proposal</b>. It has not been verified against authoritative documentation — treat technical details with caution.</div></div>` : ""}

  <div class="entry-layout">
    <div class="entry-main">
      <div class="tabs" role="tablist">
        <button class="tab-btn" data-tab-btn="explanation" role="tab">
          <span class="tab-dot" style="background:var(--purple)"></span> Explanation
        </button>
        ${hasReference ? `<button class="tab-btn" data-tab-btn="reference" role="tab">
          <span class="tab-dot" style="background:var(--green)"></span> Reference
        </button>` : ""}
      </div>

      <div class="tab-panel" data-tab-panel="explanation" ${defaultTab !== "explanation" ? 'hidden' : ""}>
        ${explSections.map(sectionHtml).join("") || `<p class="muted">No explanation content yet.</p>`}
      </div>
      ${hasReference ? `
      <div class="tab-panel" data-tab-panel="reference" ${defaultTab !== "reference" ? 'hidden' : ""}>
        ${refSections.map(sectionHtml).join("")}
      </div>` : ""}

      ${sharedSections.map(sectionHtml).join("")}
    </div>

    <aside class="entry-rail">
      <div class="rail-card">
        <h4>On this page</h4>
        ${tocHtml}
      </div>
      <div class="rail-card">
        <h4>Status</h4>
        <div class="meta-list">
          <div>${statusBadges(entry)}</div>
          ${v.lastVerified ? `<div>Last verified: <b>${escapeHtml(v.lastVerified)}</b></div>` : ""}
          ${v.source ? `<div>Source: <b>${escapeHtml(v.source)}</b></div>` : ""}
          ${entry.added ? `<div>Added: <b>${escapeHtml(entry.added)}</b></div>` : ""}
        </div>
      </div>
    </aside>
  </div>`;
}

function exampleCardHtml(ex) {
  return `
  <div class="example-card">
    <h4>🧪 ${escapeHtml(ex.title)}</h4>
    ${ex.description ? `<div class="ex-desc">${renderRich(ex.description)}</div>` : ""}
    ${codeBlockHtml(ex.code, { language: ex.language || "lua", title: null })}
    ${ex.whyItWorks ? `<div class="example-note why"><span>🔍</span><div><b>Why this works:</b> ${renderRich(ex.whyItWorks)}</div></div>` : ""}
    ${ex.commonMistake ? `<div class="example-note mistake"><span>⚠️</span><div><b>Common mistake:</b> ${renderRich(ex.commonMistake)}</div></div>` : ""}
  </div>`;
}

function sourceCardHtml(entry) {
  const v = entry.verification || {};
  const isApi = ["services", "classes", "methods", "events", "properties", "datatypes"].includes(entry.category);
  return `
  <div class="card source-card">
    ${v.source ? `<div class="src-row"><span class="src-label">Source</span><span>${v.sourceUrl ? `<a href="${escapeHtml(v.sourceUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(v.source)}</a>` : escapeHtml(v.source)}</span></div>` : ""}
    ${v.sourceUrl ? `<div class="src-row"><span class="src-label">Docs</span><span><a href="${escapeHtml(v.sourceUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(v.sourceUrl)}</a></span></div>` : ""}
    ${v.lastVerified ? `<div class="src-row"><span class="src-label">Last verified</span><span>${escapeHtml(v.lastVerified)}</span></div>` : ""}
    ${v.notes ? `<div class="src-row"><span class="src-label">Version notes</span><span>${escapeHtml(v.notes)}</span></div>` : ""}
    <div class="layer-note">
      🛡️ <b>Verified reference</b> vs <b>educational explanation</b> — the Reference tab holds precise technical facts checked against the cited source;
      the Explanation tab simplifies and teaches. ${isApi ? "If Roblox changes this API, the verification date tells you how fresh this page is." : ""}
      Explanations may simplify — they never override the verified reference.
    </div>
  </div>`;
}
