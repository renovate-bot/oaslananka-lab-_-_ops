#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function parseArgs(argv) {
  const args = { root: process.cwd() };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === "--root") {
      args.root = argv[i + 1];
      i += 1;
    }
  }
  return args;
}

function loadPins() {
  const file = path.join(ROOT, "config", "pinned-actions.json");
  if (!fs.existsSync(file)) return {};
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

export function updateWorkflowText(text, pins) {
  let changed = text;
  for (const [action, ref] of Object.entries(pins)) {
    const escaped = action.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    changed = changed.replace(new RegExp(`uses:\\s*${escaped}@[A-Za-z0-9._/-]+`, "g"), `uses: ${action}@${ref}`);
  }
  changed = changed.replace(/^\s*package-manager-cache:\s*false\s*$/gm, "");
  return changed;
}

export function main() {
  const args = parseArgs(process.argv.slice(2));
  const pins = loadPins();
  const workflowDir = path.join(args.root, ".github", "workflows");
  if (!fs.existsSync(workflowDir)) return;
  for (const file of fs.readdirSync(workflowDir)) {
    if (!file.endsWith(".yml") && !file.endsWith(".yaml")) continue;
    const full = path.join(workflowDir, file);
    const before = fs.readFileSync(full, "utf8");
    const after = updateWorkflowText(before, pins);
    if (after !== before) fs.writeFileSync(full, after);
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  main();
}
