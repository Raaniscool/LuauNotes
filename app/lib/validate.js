"use strict";
/**
 * Knowledge base validator.
 *
 * Catches: malformed JSON, missing required fields, invalid categories/types,
 * duplicate IDs, broken `related` links, invalid verification metadata,
 * missing sources for verified Roblox API entries, malformed examples, and
 * file-name/id mismatches. Warnings never fail the run; errors do.
 */

const path = require("path");
const {
  loadKnowledge,
  listKnowledgeFiles,
  CATEGORIES,
  TYPES,
  VERIFICATION_STATUSES,
  API_CATEGORIES,
} = require("./knowledge");

const ID_RE = /^[a-z0-9][a-z0-9-]*$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Validate the whole knowledge base.
 * @returns {{ errors: Array<{id?:string,file:string,message:string}>,
 *             warnings: Array<{id?:string,file:string,message:string}>,
 *             counts: object, total: number }}
 */
function validateKnowledgeBase() {
  const errors = [];
  const warnings = [];
  const files = listKnowledgeFiles();
  const { entries, errors: loadErrors } = loadKnowledge({ lenient: false });

  for (const e of loadErrors) {
    errors.push({ file: e.file, message: e.message });
  }

  const seenFiles = new Map(); // id -> file (for duplicate detection with better messages)

  for (const [id, entry] of entries) {
    const file = entry._file;

    // --- id & file name -------------------------------------------------
    if (!ID_RE.test(id)) {
      errors.push({ id, file, message: "id must be kebab-case (lowercase letters, digits, dashes)" });
    }
    const base = path.basename(file, ".json");
    if (base !== id) {
      errors.push({ id, file, message: `file name "${base}.json" does not match entry id "${id}"` });
    }
    if (seenFiles.has(id)) {
      errors.push({ id, file, message: `duplicate id "${id}" (also defined in ${seenFiles.get(id)})` });
    } else {
      seenFiles.set(id, file);
    }

    // --- required scalar fields ------------------------------------------
    const req = (field, label) => {
      if (typeof entry[field] !== "string" || entry[field].trim() === "") {
        errors.push({ id, file, message: `missing or empty required field "${label || field}"` });
      }
    };
    req("title");
    req("summary");
    if (typeof entry.summary === "string" && entry.summary.trim().length > 0 && entry.summary.trim().length < 10) {
      warnings.push({ id, file, message: "summary is very short (<10 chars)" });
    }

    if (!CATEGORIES.includes(entry.category)) {
      errors.push({ id, file, message: `invalid category "${entry.category}" (allowed: ${CATEGORIES.join(", ")})` });
    }
    if (!TYPES.includes(entry.type)) {
      errors.push({ id, file, message: `invalid type "${entry.type}" (allowed: ${TYPES.join(", ")})` });
    }
    if (entry.added !== undefined && !DATE_RE.test(String(entry.added))) {
      errors.push({ id, file, message: `invalid "added" date "${entry.added}" (expected YYYY-MM-DD)` });
    }

    // --- tags / keywords ---------------------------------------------------
    if (!Array.isArray(entry.tags) || entry.tags.length === 0) {
      warnings.push({ id, file, message: "entry has no tags" });
    } else if (entry.tags.some((t) => typeof t !== "string")) {
      errors.push({ id, file, message: "tags must be an array of strings" });
    }
    if (entry.keywords !== undefined && (!Array.isArray(entry.keywords) || entry.keywords.some((t) => typeof t !== "string"))) {
      errors.push({ id, file, message: "keywords must be an array of strings" });
    }

    // --- verification ------------------------------------------------------
    const v = entry.verification;
    if (!v || typeof v !== "object") {
      errors.push({ id, file, message: "missing verification block" });
    } else {
      if (!VERIFICATION_STATUSES.includes(v.status)) {
        errors.push({ id, file, message: `invalid verification.status "${v.status}"` });
      }
      if (v.sourceUrl && !/^https?:\/\//.test(v.sourceUrl)) {
        errors.push({ id, file, message: `verification.sourceUrl must be an http(s) URL, got "${v.sourceUrl}"` });
      }
      if (v.lastVerified && !DATE_RE.test(v.lastVerified)) {
        errors.push({ id, file, message: `verification.lastVerified must be YYYY-MM-DD, got "${v.lastVerified}"` });
      }
      if (v.status === "verified" && API_CATEGORIES.includes(entry.category) && !v.sourceUrl) {
        errors.push({
          id,
          file,
          message: "verified Roblox API entries must include verification.sourceUrl",
        });
      }
      if (v.status === "verified" && API_CATEGORIES.includes(entry.category) && !v.lastVerified) {
        warnings.push({ id, file, message: "verified entry has no lastVerified date" });
      }
    }

    // --- deprecation ---------------------------------------------------------
    if (entry.deprecated && entry.deprecated.isDeprecated && !entry.deprecated.replacement) {
      warnings.push({ id, file, message: "deprecated entry has no replacement API/approach listed" });
    }

    // --- explanation -----------------------------------------------------------
    const ex = entry.explanation;
    if (!ex || typeof ex.whatItIs !== "string" || ex.whatItIs.trim() === "") {
      errors.push({ id, file, message: "missing explanation.whatItIs — every entry must teach what the thing is" });
    }
    for (const key of ["whenToUse", "whenNotToUse", "tips", "commonMistakes"]) {
      if (ex && ex[key] !== undefined && (!Array.isArray(ex[key]) || ex[key].some((s) => typeof s !== "string"))) {
        errors.push({ id, file, message: `explanation.${key} must be an array of strings` });
      }
    }

    // --- reference ---------------------------------------------------------------
    const ref = entry.reference;
    if (ref) {
      for (const key of ["parameters", "methods", "properties", "events"]) {
        if (ref[key] !== undefined) {
          if (!Array.isArray(ref[key])) {
            errors.push({ id, file, message: `reference.${key} must be an array` });
          } else {
            for (const m of ref[key]) {
              if (!m || typeof m.name !== "string" || typeof m.description !== "string") {
                errors.push({ id, file, message: `reference.${key} items need at least {name, description}` });
                break;
              }
            }
          }
        }
      }
      if (ref.details !== undefined && (!Array.isArray(ref.details) || ref.details.some((d) => !d || !d.heading || !d.body))) {
        errors.push({ id, file, message: "reference.details items need {heading, body}" });
      }
    }

    // --- examples ------------------------------------------------------------------
    if (entry.examples !== undefined) {
      if (!Array.isArray(entry.examples)) {
        errors.push({ id, file, message: "examples must be an array" });
      } else {
        entry.examples.forEach((e2, i) => {
          if (!e2 || typeof e2.code !== "string" || e2.code.trim() === "" || typeof e2.title !== "string") {
            errors.push({ id, file, message: `examples[${i}] needs at least {title, code}` });
          } else if (!e2.language) {
            warnings.push({ id, file, message: `examples[${i}] has no language label` });
          }
        });
      }
    }

    // --- puzzles (future feature, validated when present) -----------------------------
    if (entry.puzzles !== undefined) {
      const kinds = ["debugging", "predict-output", "complete-code", "client-or-server", "api-identification", "code-reading", "build-a-system"];
      if (!Array.isArray(entry.examples ? entry.puzzles : entry.puzzles) || entry.puzzles.some((p) => !p || !kinds.includes(p.kind) || !p.prompt)) {
        errors.push({ id, file, message: "puzzles items need {kind, prompt} with a valid kind" });
      }
    }

    // --- related links ----------------------------------------------------------------
    if (entry.related !== undefined) {
      if (!Array.isArray(entry.related)) {
        errors.push({ id, file, message: "related must be an array of entry ids" });
      } else {
        for (const rel of entry.related) {
          if (!entries.has(rel)) {
            errors.push({ id, file, message: `broken related link: "${rel}" does not exist` });
          } else if (rel === id) {
            warnings.push({ id, file, message: "entry lists itself in related" });
          }
        }
      }
    } else {
      warnings.push({ id, file, message: "entry has no related links" });
    }

    // content richness warnings for API-ish entries
    if (["classes", "services", "methods", "events"].includes(entry.category)) {
      if (!entry.examples || entry.examples.length === 0) {
        warnings.push({ id, file, message: "API entry has no examples" });
      }
      if (!ref || (!ref.signature && !(Array.isArray(ref.syntax) && ref.syntax.length))) {
        warnings.push({ id, file, message: "API entry has no signature/syntax in its reference section" });
      }
    }
  }

  const counts = {};
  for (const c of CATEGORIES) counts[c] = 0;
  for (const entry of entries.values()) {
    if (counts[entry.category] !== undefined) counts[entry.category] += 1;
  }

  return { errors, warnings, counts, total: entries.size, files: files.length };
}

module.exports = { validateKnowledgeBase };
