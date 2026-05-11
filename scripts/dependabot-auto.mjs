#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { execFileSync, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { resolvePolicy } from "./ops-policy.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OPS_REPO = process.env.OPS_REPO || "oaslananka-lab/_ops";

export function classifyUpdate(title = "") {
  const lower = title.toLowerCase();
  if (lower.includes("semver-major") || lower.includes("major")) return "major";
  const versions = [...title.matchAll(/\b(\d+)\.(\d+)\.(\d+)(?:[-+][0-9A-Za-z.-]+)?\b/g)].map((match) =>
    match.slice(1, 4).map(Number),
  );
  if (versions.length >= 2) {
    const [from, to] = versions;
    if (to[0] > from[0]) return "major";
    if (to[0] === from[0] && (to[1] > from[1] || to[2] > from[2])) return "minor_or_patch";
  }
  if (lower.includes("minor") || lower.includes("patch") || lower.includes("group")) return "minor_or_patch";
  return "unknown";
}

function tokenFor(owner) {
  if (owner === "oaslananka") return process.env.GH_TOKEN_SOURCE || process.env.GH_TOKEN || "";
  if (owner === "oaslananka-lab") return process.env.GH_TOKEN_LAB || process.env.GH_TOKEN || "";
  return process.env.GH_TOKEN || "";
}

function gh(owner, args, options = {}) {
  const token = tokenFor(owner);
  if (!token) throw new Error(`Missing GitHub token for ${owner}`);
  const result = spawnSync("gh", args, {
    cwd: ROOT,
    encoding: "utf8",
    env: { ...process.env, GH_TOKEN: token },
    ...options,
  });
  if (result.status !== 0) {
    const error = new Error(result.stderr.trim() || result.stdout.trim() || `gh ${args.join(" ")} failed`);
    error.status = result.status;
    error.stdout = result.stdout;
    error.stderr = result.stderr;
    throw error;
  }
  return result.stdout;
}

function ghJson(owner, args, fallback) {
  try {
    const out = gh(owner, args);
    return out.trim() ? JSON.parse(out) : fallback;
  } catch (error) {
    return fallback;
  }
}

function policyRepos() {
  const repos = [];
  const base = path.join(ROOT, "config", "repos");
  for (const owner of fs.readdirSync(base)) {
    const ownerDir = path.join(base, owner);
    if (!fs.statSync(ownerDir).isDirectory()) continue;
    for (const file of fs.readdirSync(ownerDir)) {
      if (!file.endsWith(".yml")) continue;
      const repo = file.slice(0, -4);
      const policy = resolvePolicy(owner, repo);
      repos.push({ owner, repo, full: `${owner}/${repo}`, policy });
    }
  }
  return repos;
}

function prChecks(owner, full, number) {
  const checks = ghJson(owner, ["pr", "checks", String(number), "--repo", full, "--json", "name,state,bucket"], []);
  const pending = checks.filter((check) => ["pending", "in_progress", "queued"].includes(String(check.state).toLowerCase()));
  const failed = checks.filter((check) => ["fail", "failed", "failure", "cancelled", "timed_out"].includes(String(check.state).toLowerCase()) || check.bucket === "fail");
  const success = checks.filter((check) => ["pass", "success", "skipped"].includes(String(check.state).toLowerCase()) || check.bucket === "pass");
  return { checks, pending, failed, success };
}

function addLabel(owner, full, number, label) {
  try {
    gh(owner, ["pr", "edit", String(number), "--repo", full, "--add-label", label]);
    return true;
  } catch {
    return false;
  }
}

function dispatchFixLoop(full, number) {
  const [owner, repo] = full.split("/");
  try {
    gh("oaslananka-lab", [
      "workflow",
      "run",
      "agent-fix-loop.yml",
      "--repo",
      OPS_REPO,
      "--ref",
      "main",
      "-f",
      `target_owner=${owner}`,
      "-f",
      `target_repo=${repo}`,
      "-f",
      `pr_number=${number}`,
      "-f",
      "max_iterations=10",
    ]);
    return true;
  } catch {
    return false;
  }
}

function approveAndMerge(owner, full, pr) {
  const expectedSha = pr.headRefOid;
  const reviewed = spawnSync("gh", ["pr", "review", String(pr.number), "--repo", full, "--approve", "--body", "Approved for policy-controlled Dependabot auto-merge."], {
    cwd: ROOT,
    encoding: "utf8",
    env: { ...process.env, GH_TOKEN: tokenFor(owner) },
  });
  const mergeArgs = ["pr", "merge", String(pr.number), "--repo", full, "--squash", "--delete-branch", "--match-head-commit", expectedSha];
  const merged = spawnSync("gh", mergeArgs, {
    cwd: ROOT,
    encoding: "utf8",
    env: { ...process.env, GH_TOKEN: tokenFor(owner) },
  });
  if (merged.status === 0) return { reviewed: reviewed.status === 0, merged: true, mode: "merged" };
  const auto = spawnSync("gh", [...mergeArgs.slice(0, 5), "--auto", ...mergeArgs.slice(5)], {
    cwd: ROOT,
    encoding: "utf8",
    env: { ...process.env, GH_TOKEN: tokenFor(owner) },
  });
  return {
    reviewed: reviewed.status === 0,
    merged: auto.status === 0,
    mode: auto.status === 0 ? "auto_merge_enabled" : "merge_failed",
    error: auto.stderr.trim() || merged.stderr.trim(),
  };
}

export function processPullRequest(repoEntry, pr) {
  const classification = classifyUpdate(pr.title);
  if (classification === "major") {
    const labeled = addLabel(repoEntry.owner, repoEntry.full, pr.number, "dependabot-major-review-required");
    return { pr: pr.number, action: "major_review_required", labeled };
  }
  const checks = prChecks(repoEntry.owner, repoEntry.full, pr.number);
  if (checks.pending.length > 0) {
    return { pr: pr.number, action: "pending_checks", pending: checks.pending.length };
  }
  if (checks.failed.length > 0) {
    return { pr: pr.number, action: "fix_loop_dispatched", dispatched: dispatchFixLoop(repoEntry.full, pr.number), failed: checks.failed.length };
  }
  const requireClean = repoEntry.policy.pr?.require_clean_checks !== false;
  if (requireClean && checks.checks.length === 0) {
    return { pr: pr.number, action: "waiting_for_checks" };
  }
  const merged = approveAndMerge(repoEntry.owner, repoEntry.full, pr);
  return { pr: pr.number, action: merged.merged ? merged.mode : "merge_failed", ...merged };
}

function openDependabotPrs(repoEntry) {
  return ghJson(repoEntry.owner, [
    "pr",
    "list",
    "--repo",
    repoEntry.full,
    "--state",
    "open",
    "--author",
    "app/dependabot",
    "--json",
    "number,title,headRefName,headRefOid,mergeable,reviewDecision,url",
    "--limit",
    "100",
  ], []);
}

function dependabotAlerts(repoEntry) {
  return ghJson(repoEntry.owner, ["api", `repos/${repoEntry.full}/dependabot/alerts?state=open&per_page=100`], []);
}

export function summarizeAlerts(alerts) {
  const summary = { critical: 0, high: 0, medium: 0, low: 0, unknown: 0 };
  for (const alert of alerts || []) {
    const severity = alert.security_advisory?.severity || "unknown";
    summary[severity] = (summary[severity] || 0) + 1;
  }
  return summary;
}

export function main() {
  const outDir = path.join(ROOT, "out");
  fs.mkdirSync(outDir, { recursive: true });
  const report = {
    generated_at: new Date().toISOString(),
    repos: [],
  };
  for (const repoEntry of policyRepos()) {
    const alerts = dependabotAlerts(repoEntry);
    const prs = openDependabotPrs(repoEntry);
    const processed = prs.map((pr) => processPullRequest(repoEntry, pr));
    report.repos.push({
      repository: repoEntry.full,
      role: repoEntry.policy.repository_role?.role,
      open_dependabot_alerts: summarizeAlerts(alerts),
      open_dependabot_prs: prs.length,
      processed,
    });
  }
  const file = path.join(outDir, "dependabot-auto.json");
  fs.writeFileSync(file, `${JSON.stringify(report, null, 2)}\n`);
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  main();
}
