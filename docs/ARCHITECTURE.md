# LuauNotes Architecture

LuauNotes is a local-first, zero-dependency knowledge application for Roblox/Luau development.
It combines a verified API reference, a teaching layer, and a personal notes layer in one app.

## Design principles

1. **App code and knowledge content are separate.** Nothing factual is hard-coded into the UI.
   All knowledge lives in `knowledge/**/*.json` and is loaded at runtime.
2. **No hallucinated APIs.** Every verified entry cites its source (`verification.sourceUrl`).
   Unverified content is structurally incapable of claiming to be verified (see `_pending/`).
3. **Personal notes never pollute the reference.** My Notes is a separate store (`my-notes/`)
   with its own schema and its own search namespace.
4. **GitHub-first.** JSON + small schemas + a CLI validator = a knowledge base that can be
   reviewed, diffed, and validated in pull requests.
5. **Zero runtime dependencies.** Node's standard library only. No build step, no lockfile,
   no supply chain. Startup is instant.

## Repository layout

```
LuauNotes/
├── app/                        # application code (no knowledge inside)
│   ├── server.js               # zero-dependency HTTP server + JSON API + static hosting
│   ├── cli.js                  # validate / stats / search / list / show
│   ├── lib/
│   │   ├── knowledge.js        # loads knowledge/**/*.json into a searchable store
│   │   ├── search.js           # token-scoring search (knowledge + personal notes)
│   │   ├── notes.js            # personal notes CRUD + import (txt/md/json)
│   │   └── validate.js         # schema/convention validator for the knowledge base
│   └── frontend/               # vanilla-JS single page app (no framework, no build step)
│       ├── index.html
│       ├── styles.css          # design system, dark + light themes
│       └── js/                 # text, state, api, render, views, app modules
├── knowledge/                  # THE knowledge base (content, not code)
│   ├── luau/                   #   language fundamentals
│   ├── services/               #   Roblox services (Players, RunService, …)
│   ├── classes/                #   engine classes (Part, Humanoid, RemoteEvent, …)
│   ├── methods/                #   method references (FireServer, WaitForChild, …)
│   ├── events/                 #   event references (Touched, PlayerAdded, …)
│   ├── properties/             #   notable properties (.Value, .Anchored, …)
│   ├── datatypes/              #   Vector3, CFrame, Color3, UDim2, Enum, …
│   ├── concepts/               #   client/server, replication, lifetime, …
│   ├── patterns/               #   debounce, cooldowns, save systems, …
│   ├── gotchas/                #   quick-reference mistake cards
│   ├── debugging/              #   debugging workflow entries
│   └── _pending/               #   proposed/unreviewed entries (forced to "pending")
├── my-notes/                   # personal notes (gitignored — yours alone)
├── schemas/                    # JSON Schemas describing entries and notes
├── tests/                      # node:test suite (no test framework dependency)
├── docs/                       # you are here
└── codingnotes.{sh,ps1,cmd}    # one-command launchers
```

## Runtime architecture

```
┌────────────────────────────── browser ─────────────────────────────┐
│  SPA (hash router): dashboard, category browse, entry pages with   │
│  [Reference] / [Explanation] tabs, gotcha cards, notes UI,         │
│  command palette (Ctrl+K), "/" search focus.                       │
│  localStorage: theme, favorites, pins, recently viewed.            │
└───────────────────────────────┬─────────────────────────────────────┘
                                │  fetch("/api/…")  (same origin)
┌───────────────────────────────▼─────────────────────────────────────┐
│  app/server.js  (node:http, PORT default 4330, HOST 0.0.0.0)        │
│   ├─ static hosting of app/frontend with SPA fallback               │
│   ├─ /api/meta            app + knowledge statistics                │
│   ├─ /api/knowledge       lightweight index for the whole base      │
│   ├─ /api/entry/:id       full entry                                │
│   ├─ /api/search?q=       ranked knowledge + note results           │
│   └─ /api/notes…          personal notes CRUD + import              │
│                                                                     │
│  KnowledgeStore: loads knowledge/**/*.json once at boot;            │
│  POST /api/reload re-reads from disk during development.            │
└─────────────────────────────────────────────────────────────────────┘
```

### Data flow for a search

1. Frontend `GET /api/search?q=gui+not+showing`.
2. `search.js` tokenizes the query, scores every entry:
   - exact/phrase matches in title & keywords (heaviest weight),
   - keyword-phrase matching enables *related-term* hits
     ("player parameter" → `OnServerEvent`/`FireServer`;
      "gui not showing" → the StarterGui-vs-PlayerGui gotcha),
   - per-token scoring across title/keywords/tags/summary/full text,
   - penalties for missing tokens, deprecated and pending entries.
3. Ranked results with snippets return; personal notes are searched separately
   and only ever returned in their own section.

### Knowledge entry anatomy

`schemas/knowledge-entry.schema.json` defines the full shape. Key sections:

- `verification` — `status` (verified | review | pending), `source`, `sourceUrl`,
  `lastVerified`, optional `deprecated` info. This is the integrity layer.
- `reference` — technical facts: signature, parameters, returns, methods, events,
  properties. Shown in the **Reference** tab.
- `explanation` — teaching layer: what/why/when (not) to use, mental models,
  tips, common mistakes. Shown in the **Explanation** tab.
- `examples` — runnable Lua with titles and optional `why`/`mistake` notes.
- `related` — cross-links; the validator enforces that every link resolves.

## Security & integrity model

- Verified entries in API categories **must** have a `sourceUrl` (validator-enforced).
- Anything under `knowledge/_pending/` is force-marked `verification.status = "pending"`
  by the loader regardless of file contents — proposals can never masquerade as facts.
- `npm run validate` fails CI on: malformed JSON, missing required fields, invalid
  category/type/status enums, duplicate ids, id/filename mismatches, broken related-links,
  missing sourceUrl on verified API entries.
- Personal notes import is append-only into `my-notes/` and can never write to `knowledge/`.

## Extensibility points (designed, not built)

- **AI integration (DukeOTR):** the pending-proposal workflow is the seam. An AI can
  generate entries into `knowledge/_pending/`; a human reviews, moves them to a category
  folder, sets verification metadata, and `npm run validate` gates the merge.
- **Coding puzzles:** entries reserve a `puzzles` array with kinds
  `debugging | predict-output | complete-code | client-or-server | api-identification`.
  The schema is stable; the player UI is future work.
- **Headless use:** everything the UI shows is available over the JSON API —
  the knowledge base is usable without the frontend (CLI, scripts, other tools).
