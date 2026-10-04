#!/usr/bin/env node
"use strict";
/**
 * LuauNotes command-line companion.
 *
 *   node app/cli.js validate          validate the knowledge base (used by tests)
 *   node app/cli.js stats             library statistics
 *   node app/cli.js search "query"    search from the terminal
 *   node app/cli.js list [category]   list entries
 *   node app/cli.js show <id>         print one entry as text
 */

const { KnowledgeStore, CATEGORIES } = require("./lib/knowledge");
const { validateKnowledgeBase } = require("./lib/validate");
const { searchKnowledge } = require("./lib/search");

const [, , command, ...rest] = process.argv;

function printValidation() {
  const { errors, warnings, counts, total } = validateKnowledgeBase();
  console.log(`Knowledge base: ${total} entries\n`);
  for (const c of CATEGORIES) console.log(`  ${c.padEnd(12)} ${counts[c]}`);
  console.log("");
  if (warnings.length) {
    console.log(`⚠ ${warnings.length} warning(s):`);
    for (const w of warnings.slice(0, 40)) console.log(`  - [${w.id || "?"}] ${w.message} (${w.file})`);
    if (warnings.length > 40) console.log(`  … and ${warnings.length - 40} more`);
    console.log("");
  }
  if (errors.length) {
    console.log(`✗ ${errors.length} error(s):`);
    for (const e of errors) console.log(`  - [${e.id || "?"}] ${e.message} (${e.file})`);
    process.exitCode = 1;
  } else {
    console.log("✓ Validation passed — no errors.");
  }
}

function printStats() {
  const store = new KnowledgeStore();
  const counts = store.countsByCategory();
  const byStatus = { verified: 0, review: 0, pending: 0 };
  for (const e of store.entries.values()) byStatus[e.verification.status] += 1;
  console.log(`LuauNotes knowledge base — ${store.entries.size} entries\n`);
  console.log("By category:");
  for (const c of CATEGORIES) console.log(`  ${c.padEnd(12)} ${counts[c]}`);
  console.log("\nBy verification status:");
  for (const s of Object.keys(byStatus)) console.log(`  ${s.padEnd(12)} ${byStatus[s]}`);
  if (store.errors.length) console.log(`\n⚠ ${store.errors.length} file(s) failed to load — run "validate".`);
}

function printSearch(query) {
  const store = new KnowledgeStore();
  const results = searchKnowledge(store, query, { limit: 20 });
  if (!results.length) {
    console.log(`No results for "${query}".`);
    return;
  }
  console.log(`Results for "${query}":\n`);
  for (const r of results) {
    const badge = r.pending ? " [pending]" : r.deprecated ? " [deprecated]" : "";
    console.log(`  ${r.title}  (${r.category}/${r.type})${badge}  → #/entry/${r.id}`);
    console.log(`      ${r.summary}`);
  }
}

function printList(category) {
  const store = new KnowledgeStore();
  const items = store.index.filter((e) => !category || e.category === category);
  if (category && !CATEGORIES.includes(category)) {
    console.log(`Unknown category "${category}". Valid: ${CATEGORIES.join(", ")}`);
    process.exitCode = 1;
    return;
  }
  let last = null;
  for (const item of items) {
    if (item.category !== last) {
      console.log(`\n${item.category.toUpperCase()}`);
      last = item.category;
    }
    console.log(`  ${item.title.padEnd(34)} ${item.type}  (#/entry/${item.id})`);
  }
  console.log(`\n${items.length} entries.`);
}

function printShow(id) {
  const store = new KnowledgeStore();
  const entry = store.get(id);
  if (!entry) {
    console.log(`No entry with id "${id}".`);
    process.exitCode = 1;
    return;
  }
  const v = entry.verification || {};
  console.log(`${entry.title}  [${entry.category}/${entry.type}]`);
  console.log(`Status: ${v.status}${v.sourceUrl ? ` — ${v.sourceUrl}` : ""}`);
  console.log(`\n${entry.summary}\n`);
  if (entry.explanation && entry.explanation.whatItIs) console.log(`${entry.explanation.whatItIs}\n`);
  if (entry.reference && entry.reference.signature) console.log(`Signature: ${entry.reference.signature}\n`);
  if (entry.examples) {
    for (const ex of entry.examples) {
      console.log(`--- ${ex.title} ---\n${ex.code}\n`);
    }
  }
}

switch (command) {
  case "validate":
    printValidation();
    break;
  case "stats":
    printStats();
    break;
  case "search":
    printSearch(rest.join(" "));
    break;
  case "list":
    printList(rest[0]);
    break;
  case "show":
    printShow(rest[0]);
    break;
  default:
    console.log(`LuauNotes CLI

Commands:
  node app/cli.js validate          validate the knowledge base
  node app/cli.js stats             library statistics
  node app/cli.js search "query"    search the knowledge base
  node app/cli.js list [category]   list entries (categories: ${CATEGORIES.join(", ")})
  node app/cli.js show <id>         print one entry
`);
}
