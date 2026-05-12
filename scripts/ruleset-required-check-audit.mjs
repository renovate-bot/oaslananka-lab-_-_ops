#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function tokenFor(owner) {
  if (owner === "oaslananka") return process.env.GH_TOKEN_SOURCE || process.env.GH_TOKEN || "";
  if (owner === "oaslananka-lab") return process.env.GH_TOKEN_LAB || process.env.GH_TOKEN || "";
  return process.env.GH_TOKEN || "";
}

function gh(owner, args) {
  const result = spawnSync("gh", args, {
    cwd: ROOT,
    encoding: "utf8",
    env: { ...process.env, GH_TOKEN: tokenFor(owner) },
  });
  if (result.status !== 0) return { ok: false, error: result.stderr.trim() || result.stdout.trim() };
  try {
    return { ok: true, data: result.stdout.trim() ? JSON.parse(result.stdout) : null };
  } catch {
    return { ok: true, data: result.stdout };
  }
}

export function requiredCheckNamesFromRulesets(rulesets = []) {
  const names = new Set();
  for (const ruleset of rulesets) {
    for (const rule of ruleset.rules || []) {
      if (rule.type !== "required_status_checks") continue;
      for (const check of rule.parameters?.required_status_checks || []) {
        if (check.context) names.add(check.context);
      }
    }
  }
  return [...names].sort();
}

export function jobNamesFromWorkflow(text = "") {
  const names = new Set();
  const lines = text.split(/\r?\n/);
  let inJobs = false;
  let currentIndent = null;
  for (const line of lines) {
    if (/^jobs:\s*$/.test(line)) {
      inJobs = true;
      continue;
    }
    if (!inJobs) continue;
    const indent = line.match(/^ */)?.[0].length ?? 0;
    if (indent === 0 && line.trim() && !line.startsWith("jobs:")) break;
    const match = line.match(/^ {4}name:\s*(.+?)\s*$/);
    if (match) names.add(match[1].replace(/^["']|["']$/g, ""));
    if (line.match(/^ {2}[-A-Za-z0-9_]+:\s*$/)) currentIndent = indent;
    if (currentIndent !== null && line.match(/^ {2}[-A-Za-z0-9_]+:\s*$/)) {
      const fallback = line.trim().replace(/:$/, "");
      names.add(fallback);
    }
  }
  return [...names].sort();
}

function workflowContent(owner, repo, pathName) {
  const response = gh(owner, ["api", `repos/${owner}/${repo}/contents/${pathName}?ref=main`]);
  if (!response.ok || !response.data?.content) return null;
  return Buffer.from(response.data.content, "base64").toString("utf8");
}

function auditRepo(owner, repo) {
  const rulesets = gh(owner, ["api", `repos/${owner}/${repo}/rulesets?includes_parents=true&per_page=100`]);
  const workflows = gh(owner, ["api", `repos/${owner}/${repo}/actions/workflows?per_page=100`]);
  const required = requiredCheckNamesFromRulesets(rulesets.data || []);
  const workflowJobs = new Set();
  const workflowReports = [];
  for (const workflow of workflows.data?.workflows || []) {
    const text = workflow.path ? workflowContent(owner, repo, workflow.path) : null;
    const jobs = text ? jobNamesFromWorkflow(text) : [];
    for (const job of jobs) workflowJobs.add(job);
    workflowReports.push({ path: workflow.path, name: workflow.name, jobs });
  }
  const missing = required.filter((name) => !workflowJobs.has(name));
  return {
    repository: `${owner}/${repo}`,
    required_checks: required,
    workflow_jobs: [...workflowJobs].sort(),
    required_checks_not_emitted_by_named_jobs: missing,
    classification: missing.length ? "ruleset_required_check_mismatch" : "required_checks_mapped",
    workflows: workflowReports,
    api_errors: [rulesets, workflows].filter((item) => !item.ok).map((item) => item.error),
  };
}

function parseArgs(argv) {
  const args = { owner: "oaslananka-lab" };
  for (let index = 0; index < argv.length; index += 1) {
    const key = argv[index];
    if (!key.startsWith("--")) throw new Error(`Unexpected argument: ${key}`);
    args[key.slice(2)] = argv[index + 1];
    index += 1;
  }
  if (!args.repo) throw new Error("--repo is required");
  return args;
}

export function main(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  const outDir = path.join(ROOT, "out");
  fs.mkdirSync(outDir, { recursive: true });
  const report = { generated_at: new Date().toISOString(), ...auditRepo(args.owner, args.repo) };
  fs.writeFileSync(path.join(outDir, `ruleset-required-check-audit-${args.owner}-${args.repo}.json`), `${JSON.stringify(report, null, 2)}\n`);
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  try {
    main();
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}
