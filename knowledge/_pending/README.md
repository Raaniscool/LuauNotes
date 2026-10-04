# `knowledge/_pending/` — the proposal inbox

Drop proposed or AI-generated knowledge entries here as JSON files.

Rules enforced by `app/lib/knowledge.js` and `app/lib/validate.js`:

1. **Every entry in this folder is force-marked `verification.status = "pending"`**,
   no matter what the file claims. Pending entries are visually de-emphasized in the UI
   and penalized in search.
2. File name must still match the entry `id` (`my-draft.json` → `"id": "my-draft"`).
3. Nothing here is treated as fact until a human:
   - verifies every API claim against the official Roblox/Luau documentation,
   - fills in `verification.source` + `sourceUrl`,
   - moves the file into the proper category folder (`knowledge/classes/…` etc.),
   - runs `npm run validate` and commits through a pull request.

This directory is the seam for AI-assisted authoring: generate → propose → human review
→ verified. AI output must never skip the review step.
