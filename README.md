# 💻 LuauNotes

**A complete Roblox/Luau knowledge encyclopedia, API reference, and personal learning companion.**

LuauNotes replaces messy notes with a real product: verified Roblox API reference +
teaching explanations + reusable coding patterns + gotcha cards + your own private notes —
searchable from one place, running fully on your machine, stored as reviewable JSON on GitHub.

It is **not** a generic notes app. Every feature exists to make you better at Roblox/Luau.

---

## Quick start

Requires [Node.js](https://nodejs.org) 18+ (no npm packages — zero dependencies).

```bash
git clone https://github.com/Raaniscool/LuauNotes.git
cd LuauNotes
npm start          # → http://localhost:4330
```

Or use a launcher: `./codingnotes.sh` · `.\codingnotes.ps1` · `codingnotes.cmd`
(they also open the browser for you).

### Useful commands

```bash
npm start              # run the app          (PORT=xxxx to change port)
npm test               # run the test suite   (node:test, zero deps)
npm run validate       # validate the knowledge base (errors fail CI)
npm run stats          # entry counts by category & verification status
npm run search -- "gui not showing"
```

## What's inside

### 📚 A real knowledge base — 193 verified entries, 11 categories

| Category | What's there |
| --- | --- |
| **Luau** | variables, tables, functions, closures, metatables, type checking, task library… |
| **Services** | Players, RunService, TweenService, DataStoreService, ReplicatedStorage, 15 more |
| **Classes** | Part, Model, Humanoid, RemoteEvent, UnreliableRemoteEvent, GUIs, Tools, Sound… |
| **Methods** | FireServer/InvokeServer, WaitForChild, Clone/Destroy, Raycast, tweens… |
| **Events** | Touched, PlayerAdded, CharacterAdded, Heartbeat, InputBegan, remote events… |
| **Properties** | `.Value`, `.Anchored`, `.Parent`, WalkSpeed, ResetOnSpawn… |
| **Datatypes** | Vector3, CFrame, Color3, UDim2, Enum, TweenInfo… |
| **Concepts** | client vs server, replication, object lifetime, truthiness, serialization… |
| **Patterns** | debounce, cooldowns, save systems, server validation, moving models, GUI toggles… |
| **Gotchas** | quick cards: StarterGui vs PlayerGui, wait() vs task.wait(), forgetting `.Value`… |
| **Debugging** | workflow, Output window, infinite-yield warnings |

Every API entry follows one consistent structure — **what it is / when to use it / when NOT
to / syntax / parameters / returns / methods / events / common mistakes / tips / examples /
related** — split into two tabs:

- **Reference** — technical facts (signatures, parameters, return values)
- **Explanation** — mental models, teaching, tips, mistakes

### 🔍 Search that understands what you mean

- `UnreliableRemoteEvent` → full entry: differences from RemoteEvent, reliability,
  ordering, use cases, methods, examples, related mistakes
- `player parameter` → OnServerEvent / FireServer (related-term matching via keywords)
- `gui not showing` → the StarterGui vs PlayerGui gotcha

Search runs across names, keywords, summaries, explanations, examples, and mistakes —
knowledge entries **and** your personal notes (kept in separate result sections).

### 📝 My Notes — a personal layer that never touches the reference

Create, edit, delete, tag, favorite, and pin personal notes; link them to API entries;
attach warnings; import `.txt` / `.md` / `.json` — imports land in My Notes only,
never in the verified knowledge base. `my-notes/` is gitignored: your notes stay yours.

### 🔒 Knowledge integrity (no hallucinated APIs)

- Each entry carries **verification metadata**: `verified / review / pending`, source,
  source URL, last-verified date, deprecation info.
- Verified API entries **must** cite their source — the validator enforces it.
- `knowledge/_pending/` is a proposal inbox: anything inside is force-marked *pending*
  regardless of file contents, so AI drafts can't masquerade as facts.
- `npm run validate` gates merges: broken links, duplicate ids, missing fields, and
  source-less "verified" entries all fail.

See [docs/KNOWLEDGE_AUTHORING.md](docs/KNOWLEDGE_AUTHORING.md) for the full authoring guide.

### ⌨️ UI highlights

- Dashboard: Continue Learning, Recently Viewed, Favorites, Pinned, Suggested, search
- Two-pane layout: collapsible sidebar + content pane with breadcrumbs and tabs
- Syntax-highlighted Lua code blocks with copy buttons and teaching notes
- Dark & light themes, keyboard navigation (`/` to search, `Ctrl+K` command palette)
- Favorites, pins, and history persist locally — no account, no cloud, no tracking

## Architecture in one minute

```
app/        zero-dependency Node server + vanilla-JS SPA (no build step)
knowledge/  the encyclopedia: one JSON file per entry, organized by category
my-notes/   your personal notes (gitignored)
schemas/    JSON Schemas for entries and notes
tests/      node:test suite
docs/       architecture, authoring guide, HTTP API, roadmap
```

App code never contains knowledge; knowledge never contains app logic. The whole thing is
GitHub-friendly: diffable JSON, schema validation in CI, PR-reviewed knowledge changes.

📖 [Architecture](docs/ARCHITECTURE.md) · [HTTP API](docs/API.md) · [Roadmap](docs/ROADMAP.md)

## Built to grow

The schema already reserves integration points for **DukeOTR AI assistance**
(pending-proposal workflow) and **coding puzzles** (`debugging`, `predict-output`,
`complete-code`, `client-or-server`, `api-identification`) — designed now, built later.

## License

MIT
