# LuauNotes HTTP API

The app is a thin JSON API over the knowledge base — everything the UI does is available
to scripts, CLI tooling, or future integrations (including AI assistants).

Server defaults: `HOST=0.0.0.0`, `PORT=4330`. Override via environment variables.

## Endpoints

### `GET /api/meta`
App + knowledge statistics.

```json
{
  "name": "LuauNotes",
  "tagline": "Roblox / Luau knowledge encyclopedia + personal learning companion",
  "version": "0.1.0",
  "categories": ["luau", "services", "classes", "…"],
  "counts": { "luau": 45, "gotchas": 16, "…": "…" },
  "totalEntries": 193,
  "noteCount": 0,
  "parseErrors": 0
}
```

### `GET /api/knowledge`
Lightweight index of every entry (id, title, category, type, summary, tags, status).
This is what the frontend loads once to power browsing and client-side filtering.

```
GET /api/knowledge  →  { "entries": [ { "id": "…", "title": "…", … } ] }
```

### `GET /api/entry/:id`
Full entry, including `reference`, `explanation`, `examples`, `verification`, `related`.

```
GET /api/entry/unreliable-remote-event
404 → { "error": "no knowledge entry with id \"…\"" }
```

### `GET /api/search?q=<query>&category=<category>&limit=<n>&notes=<0|1>`
Ranked search across knowledge entries and (unless `notes=0`) personal notes.

Response:

```json
{
  "q": "gui not showing",
  "knowledge": [ { "id": "startergui-vs-playergui", "score": 220, "snippet": "…", "status": "verified" } ],
  "notes":     [ { "id": "note-…", "title": "…", "snippet": "…" } ]
}
```

Notes and knowledge are separate result sets — personal notes never mix into reference
results.

### `POST /api/reload`
Re-read `knowledge/` from disk without restarting the server (dev convenience).

### Notes CRUD

| Method & path            | Purpose                                       |
| ------------------------ | --------------------------------------------- |
| `GET /api/notes`         | list personal notes                            |
| `POST /api/notes`        | create (body: `{ title, body, tags, … }`)     |
| `GET /api/notes/:id`     | read one note                                  |
| `PUT /api/notes/:id`     | update (partial bodies allowed)                |
| `DELETE /api/notes/:id`  | delete                                         |
| `POST /api/notes/import` | import `{ format: "json"|"text", content, fileName }` |

Import accepts:
- **JSON** — an object/array of `{ title, body, tags, … }` notes,
- **Markdown/text with frontmatter** — `title:`/`tags:` lines between `---`, heading and
  first-line title fallbacks,
- **plain text** — first non-empty line becomes the title.

Imports always land in `my-notes/` — there is no API path that writes to `knowledge/`.

## CLI

```
npm run validate                     # schema/link validator, exits non-zero on errors
npm run stats                        # counts by category and verification status
npm run search -- "query"            # search from the terminal
node app/cli.js list [category]      # list entry ids, optionally filtered
node app/cli.js show <id>            # pretty-print one entry
```

## Future integration points

- **DukeOTR AI:** consume `/api/search` and `/api/entry/:id` for grounded answers;
  generate drafts into `knowledge/_pending/` via PRs.
- **Puzzles:** the entry schema reserves `puzzles[]`; a future endpoint
  (e.g. `GET /api/puzzles`) will serve them without schema changes.
