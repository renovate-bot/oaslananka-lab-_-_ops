#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { resolvePolicy } from "./ops-policy.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OPS_REPO = process.env.OPS_REPO || "oaslananka-lab/_ops";

function tokenFor(owner) {
  if (owner === "oaslananka") return process.env.GH_TOKEN_SOURCE || process.env.GH_TOKEN || "";
  if (owner === "oaslananka-lab") return process.env.GH_TOKEN_LAB || process.env.GH_TOKEN || "";
  return process.env.GH_TOKEN || "";
}

function gh(owner, args, allowFail = false) {
  const result = spawnSync("gh", args, {
    cwd: ROOT,
    encoding: "utf8",
    env: { ...process.env, GH_TOKEN: tokenFor(owner) },
  });
  if (result.status !== 0 && !allowFail) throw new Error(result.stderr.trim() || `gh ${args.join(" ")} failed`);
  return result;
}

function ghJson(owner, args, fallback = null) {
  const result = gh(owner, args, true);
  if (result.status !== 0 || !result.stdout.trim()) return fallback;
  return JSON.parse(result.stdout);
}

function mirrorPolicies() {
  const dir = path.join(ROOT, "config", "repos", "oaslananka-lab");
  return fs
    .readdirSync(dir)
    .filter((file) => file.endsWith(".yml"))
    .map((file) => file.slice(0, -4))
    .map((repo) => ({ repo, policy: resolvePolicy("oaslananka-lab", repo) }))
    .filter((entry) => entry.policy.mirror?.enabled);
}

function commit(owner, repo, branch) {
  return ghJson(owner, ["api", `repos/${owner}/${repo}/commits/${branch}`]);
}

function dispatchSync(policy) {
  const args = [
    "workflow",
    "run",
    "repo-mirror-sync.yml",
    "--repo",
    OPS_REPO,
    "--ref",
    "main",
    "-f",
    `source_owner=${policy.mirror.source_owner}`,
    "-f",
    `source_repo=${policy.mirror.source_repo}`,
    "-f",
    `target_owner=${policy.mirror.mirror_owner}`,
    "-f",
    `target_repo=${policy.mirror.mirror_repo}`,
  ];
  const result = gh("oaslananka-lab", args, true);
  return { ok: result.status === 0, error: result.stderr.trim() || null };
}

export function relationFor(sourceCommit, mirrorCommit) {
  if (!sourceCommit || !mirrorCommit) return "missing_ref";
  if (sourceCommit.sha === mirrorCommit.sha) return "equal";
  if (sourceCommit.commit?.tree?.sha && sourceCommit.commit.tree.sha === mirrorCommit.commit?.tree?.sha) return "tree_equal";
  return "drift";
}

export function main() {
  const outDir = path.join(ROOT, "out");
  fs.mkdirSync(outDir, { recursive: true });
  const report = { generated_at: new Date().toISOString(), repos: [] };
  const incidents = [];
  for (const { policy } of mirrorPolicies()) {
    const source = commit(policy.mirror.source_owner, policy.mirror.source_repo, policy.mirror.source_branch);
    const mirror = commit(policy.mirror.mirror_owner, policy.mirror.mirror_repo, policy.mirror.mirror_branch);
    const relation = relationFor(source, mirror);
    let sync = null;
    if (relation === "drift") {
      sync = dispatchSync(policy);
      incidents.push(
        `${new Date().toISOString()} ${policy.mirror.source_owner}/${policy.mirror.source_repo} -> ${policy.mirror.mirror_owner}/${policy.mirror.mirror_repo} relation=${relation} sync=${sync.ok ? "dispatched" : "failed"}`,
      );
    }
    report.repos.push({
      source: `${policy.mirror.source_owner}/${policy.mirror.source_repo}`,
      mirror: `${policy.mirror.mirror_owner}/${policy.mirror.mirror_repo}`,
      source_sha: source?.sha || null,
      mirror_sha: mirror?.sha || null,
      source_tree_sha: source?.commit?.tree?.sha || null,
      mirror_tree_sha: mirror?.commit?.tree?.sha || null,
      relation,
      sync,
    });
  }
  fs.writeFileSync(path.join(outDir, "mirror-drift-check.json"), `${JSON.stringify(report, null, 2)}\n`);
  if (incidents.length > 0) {
    fs.appendFileSync(path.join(ROOT, "docs", "mirror-drift-incidents.md"), `${incidents.join("\n")}\n`);
  }
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  main();
}
