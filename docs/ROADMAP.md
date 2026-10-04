# LuauNotes Roadmap

## ✅ Shipped

- Zero-dependency Node server + JSON API over the knowledge base
- Vanilla-JS SPA: dashboard, category browsing, Reference/Explanation tabs, gotcha cards,
  notes editor/import, command palette, dark/light themes, keyboard shortcuts
- Knowledge base: **193 verified entries** across 11 categories
  (Luau fundamentals, services, classes, methods, events, properties, datatypes,
  concepts, patterns, gotchas, debugging)
- Search: phrase + keyword scoring, related-term matches ("player parameter",
  "gui not showing"), snippets, category filters
- Validation: schema- and link-checking CLI that gates merges
- Verification model: verified/review/pending + forced-pending `_pending/` proposals
- Personal notes: CRUD, tags, favorites, pins, linked entries, txt/md/json import
- Tests (node:test), docs, one-command launchers

## 🔜 Next

### Knowledge depth
- Animation events & HumanoidStateType reference set
- DataStore edge cases (session locking deep dive, BudgetService)
- Physics deep-dives: AssemblyLinearVelocity, network ownership
- More gotcha cards as real debugging sessions produce them

### Learning companion features
- **Progress tracking:** mark entries learned / learned-with-confidence; dashboard streaks
- **Suggested learning paths:** curated sequences (Fundamentals → Remotes → Security)
- **Spaced repetition review queue** built from favorites + recently viewed

### Puzzles (data model already reserved in the schema)
- Kinds: `debugging`, `predict-output`, `complete-code`, `client-or-server`,
  `api-identification`
- Attach puzzles to entries (`puzzles[]`), standalone puzzle browser, score history

### DukeOTR AI integration
- Draft generation into `knowledge/_pending/` (human review required)
- Grounded Q&A over `/api/search` + `/api/entry/:id`
- "Explain my code" using entry references as ground truth

### Quality of life
- Note ↔ entry backlink panel ("notes mentioning this entry")
- Export/print entry pages
- Offline-first PWA manifest
- Knowledge changelog derived from git history

## 🚫 Explicitly not planned
- Multi-user/cloud accounts (this is a personal, local-first tool; GitHub is the sync layer)
- A generic notes app — every feature must serve Roblox/Luau learning
- Heavy frameworks/build pipelines — zero-dependency is a feature
