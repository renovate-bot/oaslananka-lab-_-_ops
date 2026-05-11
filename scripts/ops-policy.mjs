#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const CONFIG_DIR = path.join(ROOT, "config");
const DEFAULT_POLICY = path.join(CONFIG_DIR, "repo-autonomy.default.yml");
const PROFILES = new Set(["off", "suggest", "source", "patch", "guarded", "full", "breakglass"]);
const PATCH_MODES = new Set(["auto", "suggest", "patch"]);
const MERGE_METHODS = new Set(["merge", "squash", "rebase"]);
const REPOSITORY_ROLES = new Set(["unknown", "canonical_source", "ci_cd_mirror", "control_plane", "org_native"]);
const MIRROR_DIRECTIONS = new Set(["source_to_mirror"]);
const PROMOTE_METHODS = new Set(["pull_request"]);

function stripInlineComment(value) {
  let quote = null;
  for (let i = 0; i < value.length; i += 1) {
    const ch = value[i];
    if ((ch === '"' || ch === "'") && value[i - 1] !== "\\") {
      quote = quote === ch ? null : quote || ch;
    }
    if (ch === "#" && quote === null && (i === 0 || /\s/.test(value[i - 1]))) {
      return value.slice(0, i).trimEnd();
    }
  }
  return value.trimEnd();
}

export function parseScalar(raw) {
  const value = stripInlineComment(raw).trim();
  if (value === "") return "";
  if (value === "true") return true;
  if (value === "false") return false;
  if (value === "null") return null;
  if (/^-?\d+$/.test(value)) return Number.parseInt(value, 10);
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    return value.slice(1, -1);
  }
  return value;
}

export function parseYaml(text) {
  const root = {};
  const stack = [{ indent: -1, value: root }];

  for (const [index, rawLine] of text.replace(/\r\n/g, "\n").split("\n").entries()) {
    if (!rawLine.trim() || rawLine.trimStart().startsWith("#")) continue;
    const indent = rawLine.match(/^ */)[0].length;
    if (indent % 2 !== 0) {
      throw new Error(`Invalid YAML indentation at line ${index + 1}`);
    }
    const line = rawLine.trim();
    const sep = line.indexOf(":");
    if (sep <= 0) {
      throw new Error(`Invalid YAML mapping at line ${index + 1}`);
    }
    const key = line.slice(0, sep).trim();
    const rest = line.slice(sep + 1);

    while (stack.length > 1 && indent <= stack.at(-1).indent) stack.pop();
    const parent = stack.at(-1).value;
    if (Object.prototype.hasOwnProperty.call(parent, key)) {
      throw new Error(`Duplicate key '${key}' at line ${index + 1}`);
    }

    if (rest.trim() === "") {
      parent[key] = {};
      stack.push({ indent, value: parent[key] });
    } else {
      parent[key] = parseScalar(rest);
    }
  }

  return root;
}

function readYaml(file) {
  return parseYaml(fs.readFileSync(file, "utf8"));
}

export function deepMerge(base, override) {
  if (!override || typeof override !== "object" || Array.isArray(override)) return structuredClone(base);
  const result = structuredClone(base);
  for (const [key, value] of Object.entries(override)) {
    if (key === "extends") {
      result[key] = value;
      continue;
    }
    if (
      value &&
      typeof value === "object" &&
      !Array.isArray(value) &&
      result[key] &&
      typeof result[key] === "object" &&
      !Array.isArray(result[key])
    ) {
      result[key] = deepMerge(result[key], value);
    } else {
      result[key] = structuredClone(value);
    }
  }
  return result;
}

function requireType(policy, field, type) {
  const value = getField(policy, field);
  if (typeof value !== type) {
    throw new Error(`${field} must be ${type}`);
  }
}

function requireEnum(policy, field, allowed) {
  const value = getField(policy, field);
  if (!allowed.has(value)) {
    throw new Error(`${field} must be one of: ${[...allowed].join(", ")}`);
  }
}

export function validatePolicy(policy) {
  if (policy.version !== 1) throw new Error("version must be 1");
  requireType(policy, "autonomy.enabled", "boolean");
  requireEnum(policy, "autonomy.profile", PROFILES);
  requireEnum(policy, "repository_role.role", REPOSITORY_ROLES);
  requireType(policy, "repository_role.source_of_truth_owner", "string");
  requireType(policy, "repository_role.execution_owner", "string");
  requireType(policy, "agent.patch", "boolean");
  requireEnum(policy, "agent.patch_mode_on_check_run_failure", PATCH_MODES);
  requireType(policy, "agent.max_iterations", "number");
  if (!Number.isInteger(policy.agent.max_iterations) || policy.agent.max_iterations < 1 || policy.agent.max_iterations > 10) {
    throw new Error("agent.max_iterations must be an integer between 1 and 10");
  }
  for (const field of [
    "pr.finalize",
    "pr.merge",
    "pr.delete_branch",
    "pr.require_clean_checks",
    "pr.require_zero_pending_checks",
    "pr.require_zero_unresolved_threads",
    "pr.require_mergeable",
    "pr.require_human_review",
    "pr.allow_bot_review",
    "pr.allow_review_dismissal",
    "pr.allow_auto_merge",
    "pr.allow_immediate_merge",
    "pr.allow_bypass_ruleset",
    "pr.require_expected_head_sha",
    "pr.allow_fork_head",
    "release.enabled",
    "release.trigger_after_merge",
    "release.release_please",
    "release.merge_release_pr",
    "release.create_github_release",
    "release.require_release_plan_clean",
    "publish.enabled",
    "mirror.enabled",
    "mirror.promote_back",
    "mirror.delete_promote_branch",
    "mirror.require_source_mirror_sha_match_before_release",
    "mirror.require_source_mirror_sha_match_before_publish",
    "mirror.allow_mirror_only_closeout",
    "source.accepts_promoted_prs",
    "source.actions_expected_enabled",
    "source.require_clean_mirror_validation",
    "rulesets.audit",
    "rulesets.require_app_bypass_for_full",
    "safety.forbid_force_push",
    "safety.forbid_default_branch_direct_push",
    "safety.forbid_secret_printing",
    "safety.forbid_release_from_dirty_tree",
    "safety.forbid_publish_from_pr_head",
    "safety.require_main_after_merge"
  ]) {
    requireType(policy, field, "boolean");
  }
  requireEnum(policy, "pr.merge_method", MERGE_METHODS);
  requireEnum(policy, "mirror.direction", MIRROR_DIRECTIONS);
  requireEnum(policy, "mirror.promote_method", PROMOTE_METHODS);
  for (const field of [
    "mirror.source_owner",
    "mirror.source_repo",
    "mirror.source_branch",
    "mirror.mirror_owner",
    "mirror.mirror_repo",
    "mirror.mirror_branch"
  ]) {
    requireType(policy, field, "string");
  }
  requireType(policy, "source.ci_delegated_to", "string");
  if (policy.repository_role.role === "ci_cd_mirror" || policy.mirror.enabled) {
    for (const field of ["mirror.source_owner", "mirror.source_repo", "mirror.mirror_owner", "mirror.mirror_repo"]) {
      if (!getField(policy, field)) {
        throw new Error(`${field} is required for mirror policies`);
      }
    }
  }
  if (policy.repository_role.role === "canonical_source" && policy.autonomy.profile !== "source") {
    throw new Error("canonical_source policies must use autonomy.profile=source");
  }
  return policy;
}

export function repoPolicyPath(owner, repo) {
  return path.join(CONFIG_DIR, "repos", owner, `${repo}.yml`);
}

export function resolvePolicy(owner, repo) {
  if (!owner || !repo) throw new Error("--owner and --repo are required");
  const base = readYaml(DEFAULT_POLICY);
  const overridePath = repoPolicyPath(owner, repo);
  const override = fs.existsSync(overridePath) ? readYaml(overridePath) : {};
  return validatePolicy(deepMerge(base, override));
}

export function getField(object, selector) {
  return selector.split(".").reduce((value, key) => {
    if (value == null || typeof value !== "object" || !(key in value)) {
      throw new Error(`Unknown policy field: ${selector}`);
    }
    return value[key];
  }, object);
}

export function patchMode(policy) {
  if (!policy.autonomy.enabled) return "suggest";
  if (["off", "suggest", "source"].includes(policy.autonomy.profile)) return "suggest";
  if (!policy.agent.patch) return "suggest";
  if (["patch", "guarded", "full", "breakglass"].includes(policy.autonomy.profile)) return "patch";
  return "suggest";
}

export function topology(policy, owner, repo) {
  const role = policy.repository_role.role;
  if (role === "ci_cd_mirror") {
    return {
      role,
      source: `${policy.mirror.source_owner}/${policy.mirror.source_repo}`,
      mirror: `${policy.mirror.mirror_owner}/${policy.mirror.mirror_repo}`,
      promote_back: policy.mirror.promote_back
    };
  }
  if (role === "canonical_source") {
    return {
      role,
      source: `${owner}/${repo}`,
      ci_delegated_to: policy.source.ci_delegated_to
    };
  }
  return {
    role,
    repository: `${owner}/${repo}`,
    source_of_truth_owner: policy.repository_role.source_of_truth_owner,
    execution_owner: policy.repository_role.execution_owner
  };
}

export function isMirror(policy) {
  return policy.repository_role.role === "ci_cd_mirror" && policy.mirror.enabled === true;
}

export function sourceTarget(policy, owner, repo) {
  if (isMirror(policy)) {
    return {
      owner: policy.mirror.source_owner,
      repo: policy.mirror.source_repo,
      full_name: `${policy.mirror.source_owner}/${policy.mirror.source_repo}`,
      branch: policy.mirror.source_branch
    };
  }
  if (policy.repository_role.role === "canonical_source") {
    return {
      owner,
      repo,
      full_name: `${owner}/${repo}`,
      branch: "main"
    };
  }
  return null;
}

function parseArgs(argv) {
  const [command, ...rest] = argv;
  const args = { command };
  for (let i = 0; i < rest.length; i += 1) {
    const token = rest[i];
    if (!token.startsWith("--")) {
      throw new Error(`Unexpected argument: ${token}`);
    }
    args[token.slice(2)] = rest[i + 1];
    i += 1;
  }
  return args;
}

function printValue(value) {
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    process.stdout.write(`${value}\n`);
  } else {
    process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
  }
}

export function main(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (!["get", "check", "patch-mode", "topology", "is-mirror", "source-target"].includes(args.command)) {
    throw new Error("Usage: ops-policy.mjs <get|check|patch-mode|topology|is-mirror|source-target> --owner OWNER --repo REPO [--field a.b]");
  }
  const policy = resolvePolicy(args.owner, args.repo);
  if (args.command === "check") {
    process.stdout.write("ok\n");
    return;
  }
  if (args.command === "patch-mode") {
    process.stdout.write(`${patchMode(policy)}\n`);
    return;
  }
  if (args.command === "topology") {
    printValue(topology(policy, args.owner, args.repo));
    return;
  }
  if (args.command === "is-mirror") {
    process.stdout.write(`${isMirror(policy)}\n`);
    return;
  }
  if (args.command === "source-target") {
    printValue(sourceTarget(policy, args.owner, args.repo));
    return;
  }
  if (args.field) {
    printValue(getField(policy, args.field));
    return;
  }
  process.stdout.write(`${JSON.stringify(policy, null, 2)}\n`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  try {
    main();
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exit(1);
  }
}
