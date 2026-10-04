# Authoring Knowledge Entries

How to add, edit, and review knowledge in LuauNotes.

## The golden rules

1. **Never invent APIs.** If you can't point at the Roblox Creator Documentation (or the
   Luau docs), the entry must be `review` or `pending` — never `verified`.
2. **Verified API entries need `verification.sourceUrl`.** The validator rejects verified
   entries in `services`, `classes`, `methods`, `events`, `properties`, `datatypes`
   without one.
3. **One concept per file.** Ids are kebab-case and must match the filename
   (`fire-server.json` → `"id": "fire-server"`).
4. **Related links must resolve.** Run `npm run validate` before committing.
5. **Reference and Explanation are separate jobs.** Reference = facts (signatures, params,
   returns). Explanation = understanding (mental models, when/why, mistakes).

## Directory → category map

| Directory              | Category    | Typical `type`                          |
| ---------------------- | ----------- | --------------------------------------- |
| `knowledge/luau/`      | `luau`      | concept, function, keyword, library     |
| `knowledge/services/`  | `services`  | service                                 |
| `knowledge/classes/`   | `classes`   | class                                   |
| `knowledge/methods/`   | `methods`   | method                                  |
| `knowledge/events/`    | `events`    | event                                   |
| `knowledge/properties/`| `properties`| property                                |
| `knowledge/datatypes/` | `datatypes` | datatype                                |
| `knowledge/concepts/`  | `concepts`  | concept                                 |
| `knowledge/patterns/`  | `patterns`  | pattern                                 |
| `knowledge/gotchas/`   | `gotchas`   | gotcha                                  |
| `knowledge/debugging/` | `debugging` | concept / gotcha                        |

## Minimal template

```json
{
  "id": "example-entry",
  "title": "Example Entry",
  "category": "concepts",
  "type": "concept",
  "summary": "One or two sentences that also power search snippets.",
  "keywords": ["synonyms", "how learners phrase it", "gui not showing"],
  "tags": ["topic", "essential"],
  "verification": {
    "status": "verified",
    "source": "Roblox Creator Documentation",
    "sourceUrl": "https://create.roblox.com/docs/reference/engine/classes/Example",
    "lastVerified": "2026-10-04",
    "notes": ""
  },
  "reference": {
    "signature": "Example:Method(param: Type) --> Return"
  },
  "explanation": {
    "whatItIs": "Plain-language description.",
    "whyItExists": "The problem it solves.",
    "whenToUse": ["case 1", "case 2"],
    "whenNotToUse": ["anti-case"],
    "tips": ["practical tip"],
    "commonMistakes": ["the classic mistake"]
  },
  "examples": [
    {
      "title": "Typical usage",
      "language": "lua",
      "code": "print(\"hello\")"
    }
  ],
  "related": ["other-entry-id"],
  "added": "2026-10-04"
}
```

## Verification statuses

- **`verified`** — checked against authoritative docs; has `sourceUrl`; safe to present
  as fact. Used by the UI badge.
- **`review`** — believed accurate but not re-checked against a source, or the source is
  community knowledge. UI shows it distinctly.
- **`pending`** — proposals and AI drafts. Files in `knowledge/_pending/` are forced to
  this status by the loader, whatever the file says.

Deprecation: if an API is deprecated, keep the entry, set
`deprecated: { "isDeprecated": true, "replacement": "new-thing", "notes": "…" }`.
Search penalizes deprecated entries instead of hiding them.

## The AI/proposal workflow

```
generate ──▶ knowledge/_pending/my-draft.json   (forced "pending")
                    │
           human review: facts against docs, sources added
                    ▼
        move to knowledge/<category>/, set verification
                    │
        npm run validate  →  commit  →  PR review  →  merge
```

AI output must never be merged into real category folders without a human verifying each
API fact against the official documentation.

## Writing style

- **Summary** is what search snippets show — write it like the first line of an encyclopedia.
- **keywords** are search affordances: include the phrases learners actually type
  ("player parameter", "gui not showing", "falls down").
- **Examples** must be real, runnable Luau. Prefer small complete scripts over fragments.
  Add `why` or `mistake` notes where they teach something.
- Gotchas are cards: symptom → cause → fix. Keep them scannable.
- Patterns are recipes: when to use, when NOT to, a mental model, working code.

## Quality bar checklist

- [ ] Every API claim verifiable via `sourceUrl`
- [ ] `npm run validate` passes with no errors
- [ ] `related` links all resolve and teach the reader where to go next
- [ ] At least one example for API-category entries
- [ ] No personal opinions in `reference` sections
- [ ] Dates in `lastVerified`/`added` are real dates you actually checked
