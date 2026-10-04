/**
 * Text utilities: HTML escaping, a markdown-lite renderer for knowledge
 * prose, and a Luau syntax highlighter. Everything runs locally — no CDN,
 * no network, so the app works fully offline.
 */

export function escapeHtml(s) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

/* ── Luau syntax highlighting ─────────────────────────────────────── */

const LUA_KEYWORDS = new Set([
  "local", "function", "end", "if", "then", "else", "elseif", "for", "while",
  "repeat", "until", "return", "break", "continue", "in", "do", "and", "or",
  "not", "type", "export", "typeof",
]);
const LUA_CONSTANTS = new Set(["true", "false", "nil", "self", "..."]);
const LUA_BUILTINS = new Set([
  "print", "warn", "error", "pcall", "xpcall", "require", "type", "typeof",
  "pairs", "ipairs", "next", "select", "unpack", "tostring", "tonumber",
  "assert", "setmetatable", "getmetatable", "rawget", "rawset", "rawequal",
  "rawlen", "wait", "spawn", "delay", "tick", "time",
  "task", "string", "table", "math", "coroutine", "os", "debug", "bit32",
  "utf8", "buffer", "shared", "_G",
  "game", "workspace", "script", "Enum", "Instance", "Vector3", "Vector2",
  "CFrame", "Color3", "UDim2", "UDim", "TweenInfo", "Ray", "Rect",
  "NumberRange", "NumberSequence", "ColorSequence", "Random", "DateTime",
  "Axes", "Faces", "PhysicalProperties", "RaycastParams", "OverlapParams",
]);

const LUA_TOKEN_RE = new RegExp(
  [
    "--\\[\\[[\\s\\S]*?(?:\\]\\]|$)", // block comment
    "--[^\\n]*",                       // line comment
    "\\[\\[[\\s\\S]*?(?:\\]\\]|$)",    // long string
    '"(?:\\\\.|[^"\\\\\\n])*"',        // double string
    "'(?:\\\\.|[^'\\\\\\n])*'",        // single string
    "`(?:\\\\.|[^`\\\\])*`",           // interpolated string
    "\\b0[xX][0-9a-fA-F]+\\b|\\b\\d+(?:\\.\\d+)?(?:[eE][+-]?\\d+)?\\b", // number
    "[A-Za-z_][A-Za-z0-9_]*",          // identifier
  ].join("|"),
  "g"
);

function classifyToken(tok) {
  if (tok.startsWith("--")) return "comment";
  if (/^["'`[]/.test(tok) || tok[0] === "[") return "string";
  if (/^[0-9]/.test(tok)) return "number";
  if (LUA_KEYWORDS.has(tok)) return "keyword";
  if (LUA_CONSTANTS.has(tok)) return "constant";
  if (LUA_BUILTINS.has(tok)) return "builtin";
  return null;
}

export function highlightLua(code) {
  let out = "";
  let last = 0;
  LUA_TOKEN_RE.lastIndex = 0;
  let m;
  while ((m = LUA_TOKEN_RE.exec(code)) !== null) {
    out += escapeHtml(code.slice(last, m.index));
    const cls = classifyToken(m[0]);
    out += cls ? `<span class="tk-${cls}">${escapeHtml(m[0])}</span>` : escapeHtml(m[0]);
    last = m.index + m[0].length;
    if (m[0].length === 0) LUA_TOKEN_RE.lastIndex++;
  }
  out += escapeHtml(code.slice(last));
  return out;
}

/** Highlighted code block with header (language label + copy button). */
export function codeBlockHtml(code, { language = "lua", title = null } = {}) {
  const highlighted = language === "lua" ? highlightLua(code) : escapeHtml(code);
  return `
  <div class="code-block">
    <div class="code-head">
      <span>
        <span class="code-lang">${escapeHtml(language)}</span>
        ${title ? `<span class="code-title">${escapeHtml(title)}</span>` : ""}
      </span>
      <button class="copy-btn" data-copy>📋 Copy</button>
    </div>
    <pre><code>${highlighted}</code></pre>
    <span class="hidden copy-source">${escapeHtml(code)}</span>
  </div>`;
}

/* ── Markdown-lite renderer ────────────────────────────────────────── */
/* Supported: paragraphs, `inline code`, **bold**, *italic*,
   - bullets, 1. numbered, > quotes, ``` fenced blocks (plain or lua).  */

function inlineMd(escaped) {
  return escaped
    .replace(/`([^`]+)`/g, (_, c) => `<code class="ic">${c}</code>`)
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/(^|[^*])\*([^*\n]+)\*/g, "$1<em>$2</em>");
}

export function renderRich(text) {
  if (!text) return "";
  const fences = [];
  let src = String(text).replace(/```([\w-]*)\n([\s\S]*?)```/g, (_, lang, code) => {
    fences.push({ lang, code });
    return `\u0000F${fences.length - 1}\u0000`;
  });

  const escaped = escapeHtml(src);
  const lines = escaped.split(/\r?\n/);
  const html = [];
  let para = [];
  let list = null; // {type, items}

  const flushPara = () => {
    if (para.length) {
      html.push(`<p>${inlineMd(para.join(" "))}</p>`);
      para = [];
    }
  };
  const flushList = () => {
    if (list) {
      const tag = list.type === "ol" ? "ol" : "ul";
      html.push(`<${tag}>${list.items.map((i) => `<li>${inlineMd(i)}</li>`).join("")}</${tag}>`);
      list = null;
    }
  };

  for (const line of lines) {
    const fenceMatch = line.match(/^\u0000F(\d+)\u0000$/);
    if (fenceMatch) {
      flushPara();
      flushList();
      const f = fences[Number(fenceMatch[1])];
      const lang = f.lang && f.lang !== "text" && f.lang !== "" ? f.lang : null;
      if (lang === "lua") {
        html.push(codeBlockHtml(f.code.replace(/\n$/, ""), { language: "lua" }));
      } else {
        html.push(`<pre class="diagram">${escapeHtml(f.code.replace(/\n$/, ""))}</pre>`);
      }
      continue;
    }
    const t = line.trim();
    if (!t) {
      flushPara();
      flushList();
      continue;
    }
    let m;
    if ((m = t.match(/^[-•]\s+(.*)$/))) {
      flushPara();
      if (!list || list.type !== "ul") { flushList(); list = { type: "ul", items: [] }; }
      list.items.push(m[1]);
    } else if ((m = t.match(/^\d+[.)]\s+(.*)$/))) {
      flushPara();
      if (!list || list.type !== "ol") { flushList(); list = { type: "ol", items: [] }; }
      list.items.push(m[1]);
    } else if ((m = t.match(/^&gt;\s?(.*)$/))) {
      flushPara();
      flushList();
      html.push(`<blockquote>${inlineMd(m[1])}</blockquote>`);
    } else {
      flushList();
      para.push(t);
    }
  }
  flushPara();
  flushList();
  return `<div class="rich">${html.join("")}</div>`;
}

/** Highlight query terms inside an already-escaped snippet. */
export function markSnippet(snippet, query) {
  let html = escapeHtml(snippet);
  const terms = String(query || "").toLowerCase().split(/[^a-z0-9_]+/).filter((t) => t.length >= 2);
  for (const t of terms) {
    const re = new RegExp(`(${t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "gi");
    html = html.replace(re, "<mark>$1</mark>");
  }
  return html;
}

export function truncate(s, n = 140) {
  s = String(s || "");
  return s.length > n ? s.slice(0, n - 1).trimEnd() + "…" : s;
}
