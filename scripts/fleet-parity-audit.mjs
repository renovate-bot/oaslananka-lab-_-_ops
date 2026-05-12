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

function gh(owner, args) {
  const result = spawnSync("gh", args, {
    cwd: ROOT,
    encoding: "utf8",
    env: { ...process.env, GH_TOKEN: tokenFor(owner) },
  });
  if (result.status !== 0) {
    return { ok: false, error: result.stderr.trim() || result.stdout.trim(), status: result.status };
  }
  try {
    return { ok: true, data: result.stdout.trim() ? JSON.parse(result.stdout) : null };
  } catch {
    return { ok: true, data: result.stdout };
  }
}

function rateLimit(owner) {
  return gh(owner, ["api", "rate_limit", "--jq", ".resources.core"]);
}

function mirrorPolicies() {
  const dir = path.join(ROOT, "config", "repos", "oaslananka-lab");
  return fs
    .readdirSync(dir)
    .filter((file) => file.endsWith(".yml"))
    .map((file) => file.slice(0, -4))
    .map((repo) => resolvePolicy("oaslananka-lab", repo))
    .filter((policy) => policy.mirror?.enabled)
    .sort((a, b) => a.mirror.mirror_repo.localeCompare(b.mirror.mirror_repo));
}

function commit(owner, repo, branch) {
  return gh(owner, ["api", `repos/${owner}/${repo}/commits/${branch}`]);
}

function content(owner, repo, file, branch) {
  return gh(owner, ["api", `repos/${owner}/${repo}/contents/${file}?ref=${encodeURIComponent(branch)}`]);
}

export function treeRelation(source, mirror) {
  if (!source?.ok || !mirror?.ok) return "api_error";
  if (source.data?.sha === mirror.data?.sha) return "equal";
  if (source.data?.commit?.tree?.sha && source.data.commit.tree.sha === mirror.data?.commit?.tree?.sha) return "tree_equal";
  return "drift";
}

export function fileRelation(source, mirror, managed = true) {
  if (!managed) return "not_managed";
  if (!source.ok || !mirror.ok) {
    if (!source.ok && !mirror.ok && /not found/i.test(source.error) && /not found/i.test(mirror.error)) return "both_missing";
    return "api_error";
  }
  if (source.data?.sha && source.data.sha === mirror.data?.sha) return "match";
  return "divergent";
}

export function main() {
  const outDir = path.join(ROOT, "out");
  fs.mkdirSync(outDir, { recursive: true });
  const report = { generated_at: new Date().toISOString(), rate_limit: {}, repos: [] };
  for (const owner of ["oaslananka", "oaslananka-lab"]) {
    const limit = rateLimit(owner);
    report.rate_limit[owner] = limit.ok ? limit.data : { error: limit.error };
  }
  for (const policy of mirrorPolicies()) {
    const source = commit(policy.mirror.source_owner, policy.mirror.source_repo, policy.mirror.source_branch);
    const mirror = commit(policy.mirror.mirror_owner, policy.mirror.mirror_repo, policy.mirror.mirror_branch);
    const sourceDependabot = content(policy.mirror.source_owner, policy.mirror.source_repo, ".github/dependabot.yml", policy.mirror.source_branch);
    const mirrorDependabot = content(policy.mirror.mirror_owner, policy.mirror.mirror_repo, ".github/dependabot.yml", policy.mirror.mirror_branch);
    const tree_relation = treeRelation(source, mirror);
    const dependabot_relation = fileRelation(sourceDependabot, mirrorDependabot, policy.dependabot?.managed !== false);
    report.repos.push({
      repo: policy.mirror.mirror_repo,
      source: `${policy.mirror.source_owner}/${policy.mirror.source_repo}`,
      mirror: `${policy.mirror.mirror_owner}/${policy.mirror.mirror_repo}`,
      source_sha: source.data?.sha || null,
      mirror_sha: mirror.data?.sha || null,
      source_tree_sha: source.data?.commit?.tree?.sha || null,
      mirror_tree_sha: mirror.data?.commit?.tree?.sha || null,
      tree_relation,
      dependabot_relation,
      api_errors: [source, mirror, sourceDependabot, mirrorDependabot].filter((item) => !item.ok).map((item) => item.error),
      suggested_workflow_action:
        tree_relation === "drift" || dependabot_relation === "divergent"
          ? "run policy-managed baseline/sync workflow; do not direct-write contents"
          : "none",
    });
  }
  fs.writeFileSync(path.join(outDir, "fleet-parity-audit.json"), `${JSON.stringify(report, null, 2)}\n`);
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  main();
}
