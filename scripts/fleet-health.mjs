#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { resolvePolicy } from "./ops-policy.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function tokenFor(owner) {
  if (owner === "oaslananka") return process.env.GH_TOKEN_SOURCE || process.env.GH_TOKEN || "";
  if (owner === "oaslananka-lab") return process.env.GH_TOKEN_LAB || process.env.GH_TOKEN || "";
  return process.env.GH_TOKEN || "";
}

function gh(owner, args, fallback = null) {
  const result = spawnSync("gh", args, {
    cwd: ROOT,
    encoding: "utf8",
    env: { ...process.env, GH_TOKEN: tokenFor(owner) },
  });
  if (result.status !== 0) return fallback;
  if (!result.stdout.trim()) return fallback;
  try {
    return JSON.parse(result.stdout);
  } catch {
    return result.stdout;
  }
}

function repos() {
  const entries = [];
  const base = path.join(ROOT, "config", "repos", "oaslananka-lab");
  for (const file of fs.readdirSync(base).filter((item) => item.endsWith(".yml"))) {
    const repo = file.slice(0, -4);
    entries.push({ owner: "oaslananka-lab", repo, full: `oaslananka-lab/${repo}`, policy: resolvePolicy("oaslananka-lab", repo) });
  }
  return entries;
}

function severityBreakdown(alerts) {
  const result = { critical: 0, high: 0, medium: 0, low: 0, unknown: 0 };
  for (const alert of alerts || []) {
    const key = alert.security_advisory?.severity || "unknown";
    result[key] = (result[key] || 0) + 1;
  }
  return result;
}

function requiredReviewersCount(environment) {
  if (!environment?.protection_rules) return 0;
  return environment.protection_rules
    .filter((rule) => rule.type === "required_reviewers")
    .reduce((sum, rule) => sum + (rule.reviewers?.length || 0), 0);
}

function latestPublishRun(owner, full) {
  const runs = gh(owner, ["run", "list", "--repo", full, "--limit", "20", "--json", "databaseId,status,conclusion,workflowName,url"], []);
  const run = (runs || []).find((item) => /publish|deploy|release|mcp registry/i.test(item.workflowName || ""));
  if (!run) return { state: "none", url: null };
  if (run.status === "waiting") return { state: "awaiting_approval", url: run.url };
  if (run.status !== "completed") return { state: run.status, url: run.url };
  return { state: run.conclusion || "completed", url: run.url };
}

function sourceMirrorRelation(policy) {
  if (!policy.mirror?.enabled) return "not_mirrored";
  const source = gh(policy.mirror.source_owner, ["api", `repos/${policy.mirror.source_owner}/${policy.mirror.source_repo}/commits/${policy.mirror.source_branch}`], null);
  const mirror = gh(policy.mirror.mirror_owner, ["api", `repos/${policy.mirror.mirror_owner}/${policy.mirror.mirror_repo}/commits/${policy.mirror.mirror_branch}`], null);
  if (!source || !mirror) return "missing_ref";
  if (source.sha === mirror.sha) return "equal";
  if (source.commit?.tree?.sha && source.commit.tree.sha === mirror.commit?.tree?.sha) return "tree_equal";
  return "drift";
}

function npmTrustedPublisherStatus(packageName) {
  if (!packageName) return "not_applicable";
  spawnSync("npm", ["view", packageName, "name", "--json"], { encoding: "utf8" });
  return "requires_npmjs_ui_verification";
}

function classifyDependabotUpdate(title = "") {
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
  return "unknown";
}

function packageName(owner, repo) {
  const content = gh(owner, ["api", `repos/${owner}/${repo}/contents/package.json?ref=main`], null);
  if (!content?.content) return null;
  try {
    const text = Buffer.from(content.content, "base64").toString("utf8");
    return JSON.parse(text).name || null;
  } catch {
    return null;
  }
}

function upsertIssue(report, markdown) {
  const date = new Date().toISOString().slice(0, 10);
  const title = `[fleet-health] ${date}`;
  const issues = gh("oaslananka-lab", ["issue", "list", "--repo", "oaslananka-lab/_ops", "--state", "open", "--search", title, "--json", "number,title"], []);
  const match = (issues || []).find((issue) => issue.title === title);
  if (match) {
    spawnSync("gh", ["issue", "edit", String(match.number), "--repo", "oaslananka-lab/_ops", "--body", markdown], {
      cwd: ROOT,
      encoding: "utf8",
      env: { ...process.env, GH_TOKEN: process.env.OPS_TOKEN || tokenFor("oaslananka-lab") },
    });
    return match.number;
  }
  const created = spawnSync("gh", ["issue", "create", "--repo", "oaslananka-lab/_ops", "--title", title, "--body", markdown], {
    cwd: ROOT,
    encoding: "utf8",
    env: { ...process.env, GH_TOKEN: process.env.OPS_TOKEN || tokenFor("oaslananka-lab") },
  });
  const number = created.stdout.match(/\/issues\/(\d+)/)?.[1] || null;
  return number ? Number(number) : null;
}

function markdownFor(report) {
  const lines = [
    "# Fleet Health",
    "",
    `Generated: ${report.generated_at}`,
    "",
    "| Repo | Non-major Dependabot PRs | Major Dependabot PRs | Dependabot alerts | Drift | Production reviewers | Latest publish/deploy | Trusted publisher |",
    "|---|---:|---:|---|---|---:|---|---|",
  ];
  for (const row of report.repos) {
    lines.push(
      `| \`${row.repository}\` | ${row.dependabot_prs_pending_count} | ${row.dependabot_prs_major_review_required_count} | ${JSON.stringify(row.dependabot_open_count)} | ${row.source_mirror_drift} | ${row.production_environment_required_reviewers_count} | ${row.latest_publish_run_state}${row.latest_publish_run_url ? `<br>${row.latest_publish_run_url}` : ""} | ${row.trusted_publisher_configured} |`,
    );
  }
  return `${lines.join("\n")}\n`;
}

export function main() {
  const outDir = path.join(ROOT, "out");
  fs.mkdirSync(outDir, { recursive: true });
  const report = { generated_at: new Date().toISOString(), repos: [] };
  for (const entry of repos()) {
    const alerts = gh(entry.owner, ["api", `repos/${entry.full}/dependabot/alerts?state=open&per_page=100`], []);
    const prs = gh(entry.owner, [
      "pr",
      "list",
      "--repo",
      entry.full,
      "--state",
      "open",
      "--author",
      "app/dependabot",
      "--json",
      "number,title,url,labels",
      "--limit",
      "100",
    ], []);
    const majorPrs = (prs || []).filter(
      (pr) =>
        classifyDependabotUpdate(pr.title) === "major" ||
        (pr.labels || []).some((label) => label.name === "dependabot-major-review-required"),
    );
    const nonMajorPrs = (prs || []).filter((pr) => !majorPrs.some((major) => major.number === pr.number));
    const environment = gh(entry.owner, ["api", `repos/${entry.full}/environments/production`], null);
    const latest = latestPublishRun(entry.owner, entry.full);
    const pkgName = entry.policy.publish?.npm ? packageName(entry.owner, entry.repo) : null;
    report.repos.push({
      repository: entry.full,
      dependabot_open_count: severityBreakdown(alerts),
      code_scanning_open_count: 0,
      secret_scanning_open_count: 0,
      dependabot_prs_pending_count: nonMajorPrs.length,
      dependabot_prs_major_review_required_count: majorPrs.length,
      source_mirror_drift: sourceMirrorRelation(entry.policy),
      production_environment_required_reviewers_count: requiredReviewersCount(environment),
      latest_publish_run_state: latest.state,
      latest_publish_run_url: latest.url,
      trusted_publisher_configured: npmTrustedPublisherStatus(pkgName),
      publish_enabled: Boolean(entry.policy.publish?.enabled),
    });
  }
  const markdown = markdownFor(report);
  report.issue_number = upsertIssue(report, markdown);
  fs.writeFileSync(path.join(outDir, "fleet-health.json"), `${JSON.stringify(report, null, 2)}\n`);
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  main();
}
