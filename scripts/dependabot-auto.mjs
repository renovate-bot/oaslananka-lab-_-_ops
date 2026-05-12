#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { execFileSync, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { resolvePolicy } from "./ops-policy.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OPS_REPO = process.env.OPS_REPO || "oaslananka-lab/_ops";
const dispatchedFixLoops = new Set();
const SOURCE_DEPENDABOT_DISABLED_MARKER = "<!-- repo-ops-source-dependabot-disabled -->";
const SOURCE_DEPENDABOT_DISABLED_BODY = `${SOURCE_DEPENDABOT_DISABLED_MARKER}

Closing because dependency automation for this fleet is managed from the CI/CD mirror through _ops. Source-side Dependabot is disabled by policy to avoid source/mirror divergence.`;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function summarizeError(error) {
  return {
    message: String(error?.message || error || "unknown error"),
    status: error?.status ?? null,
  };
}

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

async function api(owner, method, endpoint, body, allowFail = false) {
  const token = tokenFor(owner);
  if (!token) throw new Error(`Missing GitHub token for ${owner}`);
  let lastError = null;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const response = await fetch(`https://api.github.com/${endpoint}`, {
        method,
        headers: {
          Accept: "application/vnd.github+json",
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          "User-Agent": "oaslananka-repo-ops-dependabot-auto",
          "X-GitHub-Api-Version": "2026-03-10",
        },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      const text = await response.text();
      const data = text ? JSON.parse(text) : null;
      if (!response.ok && !allowFail) {
        const error = new Error(data?.message || `GitHub API ${method} ${endpoint} failed: ${response.status}`);
        error.status = response.status;
        error.data = data;
        throw error;
      }
      return { ok: response.ok, status: response.status, data };
    } catch (error) {
      lastError = error;
      if (attempt < 3) {
        await sleep(1000 * attempt);
        continue;
      }
    }
  }
  if (allowFail) {
    return {
      ok: false,
      status: lastError?.status ?? 0,
      data: { message: lastError?.message || "fetch failed" },
    };
  }
  throw lastError;
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
    try {
      gh(owner, [
        "api",
        `repos/${full}/labels`,
        "-f",
        `name=${label}`,
        "-f",
        "color=ededed",
        "-f",
        "description=Managed by _ops dependency automation",
      ]);
      gh(owner, ["pr", "edit", String(number), "--repo", full, "--add-label", label]);
      return true;
    } catch {
      return false;
    }
  }
}

function issueComments(repoEntry, number) {
  return ghJson(repoEntry.owner, ["api", `repos/${repoEntry.full}/issues/${number}/comments?per_page=100`], []);
}

function hasSourceDependabotCloseMarker(repoEntry, number) {
  return issueComments(repoEntry, number).some((comment) => String(comment.body || "").includes(SOURCE_DEPENDABOT_DISABLED_MARKER));
}

export function shouldCloseSourceDependabotPr(repoEntry) {
  return (
    repoEntry.owner === "oaslananka" &&
    repoEntry.policy.repository_role?.role === "canonical_source" &&
    repoEntry.policy.dependabot?.managed !== false &&
    repoEntry.policy.dependabot?.source_settings_disabled === true
  );
}

function dispatchFixLoop(full, number) {
  const key = `${full}#${number}`;
  if (dispatchedFixLoops.has(key)) return false;
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
    dispatchedFixLoops.add(key);
    return true;
  } catch {
    return false;
  }
}

export function classifyMergeFailure(message = "") {
  const lower = String(message).toLowerCase();
  if (lower.includes("merge conflicts") || lower.includes("not mergeable")) return "merge_conflict_rebase_requested";
  if (lower.includes("code owner review") || lower.includes("review required")) return "merge_blocked_codeowner_review";
  if (lower.includes("required status checks") || lower.includes("expected")) return "merge_blocked_required_checks";
  if (lower.includes("cannot be merged") || lower.includes("method not allowed")) return "merge_blocked_by_ruleset";
  return "merge_failed";
}

function requestDependabotRebase(owner, full, number) {
  try {
    gh(owner, ["api", `repos/${full}/issues/${number}/comments`, "-f", "body=@dependabot rebase"]);
    return true;
  } catch {
    return false;
  }
}

async function approveAndMerge(owner, full, pr) {
  const expectedSha = pr.headRefOid;
  const [repoOwner, repoName] = full.split("/");
  const review = await api(owner, "POST", `repos/${full}/pulls/${pr.number}/reviews`, {
    event: "APPROVE",
    body: "Approved for policy-controlled Dependabot auto-merge.",
  }, true);
  try {
    gh("oaslananka-lab", [
      "workflow",
      "run",
      "ops-pr-finalize.yml",
      "--repo",
      OPS_REPO,
      "--ref",
      "main",
      "-f",
      `target_owner=${repoOwner}`,
      "-f",
      `target_repo=${repoName}`,
      "-f",
      `pr_number=${pr.number}`,
      "-f",
      "requested_action=finalize",
      "-f",
      `expected_head_sha=${expectedSha}`,
      "-f",
      "dry_run=false",
    ]);
    return { reviewed: review.ok, merged: false, mode: "finalize_dispatched", expectedSha };
  } catch (error) {
    const mode = classifyMergeFailure(error.message);
    const rebaseRequested = mode === "merge_conflict_rebase_requested" ? requestDependabotRebase(owner, full, pr.number) : false;
    const conflictLabel =
      mode === "merge_conflict_rebase_requested" ? addLabel(owner, full, pr.number, "needs-human-conflict-resolution") : false;
    return {
      reviewed: review.ok,
      merged: false,
      mode,
      error: error.message,
      rebaseRequested,
      conflictLabel,
      repository: `${repoOwner}/${repoName}`,
    };
  }
}

export async function processPullRequest(repoEntry, pr) {
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
  const merged = await approveAndMerge(repoEntry.owner, repoEntry.full, pr);
  return { pr: pr.number, action: merged.mode, ...merged };
}

export async function closeSourceDependabotPr(repoEntry, pr) {
  const commented = hasSourceDependabotCloseMarker(repoEntry, pr.number)
    ? { ok: true, skipped: true }
    : await api(repoEntry.owner, "POST", `repos/${repoEntry.full}/issues/${pr.number}/comments`, {
        body: SOURCE_DEPENDABOT_DISABLED_BODY,
      }, true);
  const closed = await api(repoEntry.owner, "PATCH", `repos/${repoEntry.full}/pulls/${pr.number}`, {
    state: "closed",
  }, true);
  return {
    pr: pr.number,
    action: closed.ok ? "source_dependabot_closed" : "source_dependabot_close_failed",
    commented: commented.ok,
    commentSkipped: commented.skipped === true,
    closed: closed.ok,
    error: closed.ok ? null : closed.data?.message || `GitHub API returned ${closed.status}`,
  };
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

export async function main() {
  const outDir = path.join(ROOT, "out");
  fs.mkdirSync(outDir, { recursive: true });
  const file = path.join(outDir, "dependabot-auto.json");
  const report = {
    generated_at: new Date().toISOString(),
    repos: [],
  };
  const writeReport = () => {
    fs.writeFileSync(file, `${JSON.stringify(report, null, 2)}\n`);
  };
  for (const repoEntry of policyRepos()) {
    let alerts = [];
    let prs = [];
    let repositoryError = null;
    try {
      alerts = dependabotAlerts(repoEntry);
      prs = openDependabotPrs(repoEntry);
    } catch (error) {
      repositoryError = summarizeError(error);
    }
    const processed = [];
    const sourceDisabled = shouldCloseSourceDependabotPr(repoEntry);
    if (repoEntry.owner !== "oaslananka-lab" && !sourceDisabled) {
      report.repos.push({
        repository: repoEntry.full,
        role: repoEntry.policy.repository_role?.role,
        open_dependabot_alerts: summarizeAlerts(alerts),
        open_dependabot_prs: prs.length,
        processed,
        action: "skipped_non_mirror",
        ...(repositoryError ? { error: repositoryError } : {}),
      });
      writeReport();
      continue;
    }
    for (const pr of prs) {
      try {
        processed.push(sourceDisabled ? await closeSourceDependabotPr(repoEntry, pr) : await processPullRequest(repoEntry, pr));
      } catch (error) {
        processed.push({ pr: pr.number, action: "error", error: summarizeError(error) });
      }
    }
    report.repos.push({
      repository: repoEntry.full,
      role: repoEntry.policy.repository_role?.role,
      open_dependabot_alerts: summarizeAlerts(alerts),
      open_dependabot_prs: prs.length,
      processed,
      ...(repositoryError ? { error: repositoryError } : {}),
    });
    writeReport();
  }
  writeReport();
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  main().catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
}
