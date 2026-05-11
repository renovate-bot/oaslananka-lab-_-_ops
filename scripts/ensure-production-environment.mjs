#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const API_VERSION = "2026-03-10";

export function parseArgs(argv) {
  const args = {
    apply: false,
    environment: "production",
    mode: "audit",
    reviewerLogin: "",
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--apply") {
      args.apply = true;
    } else if (arg.startsWith("--")) {
      const key = arg.slice(2).replace(/-([a-z])/g, (_, c) => c.toUpperCase());
      const value = argv[index + 1];
      if (!value || value.startsWith("--")) {
        throw new Error(`Missing value for ${arg}`);
      }
      args[key] = value;
      index += 1;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  if (!args.owner || !args.repo) {
    throw new Error("--owner and --repo are required");
  }
  return args;
}

function policyFor(owner, repo) {
  return JSON.parse(
    execFileSync("node", ["scripts/ops-policy.mjs", "get", "--owner", owner, "--repo", repo], {
      encoding: "utf8",
    }),
  );
}

export function requiredSecretNames(policy) {
  const names = new Set();
  if (policy.publish?.npm) {
    names.add("NPM_TOKEN");
    names.add("NODE_AUTH_TOKEN");
  }
  if (policy.publish?.vscode_marketplace) {
    names.add("VSCE_PAT");
    names.add("VS_MARKETPLACE_TOKEN");
  }
  if (policy.publish?.open_vsx) {
    names.add("OVSX_PAT");
    names.add("OPEN_VSX_TOKEN");
  }
  if (policy.publish?.mcp_registry) {
    names.add("MCP_REGISTRY_TOKEN");
  }
  if (policy.publish?.dockerhub) {
    names.add("DOCKERHUB_USERNAME");
    names.add("DOCKERHUB_TOKEN");
  }
  // GitHub Pages and GHCR publish with the repository GITHUB_TOKEN/OIDC path.
  // They do not require long-lived environment secrets.
  return [...names].sort();
}

async function github(token, method, endpoint, body) {
  const response = await fetch(`https://api.github.com/${endpoint}`, {
    method,
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "User-Agent": "oaslananka-repo-ops",
      "X-GitHub-Api-Version": API_VERSION,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  let data = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = { raw: text };
    }
  }
  if (!response.ok) {
    const error = new Error(`GitHub API ${method} ${endpoint} failed: ${response.status}`);
    error.status = response.status;
    error.data = data;
    throw error;
  }
  return data;
}

async function optionalGithub(token, method, endpoint) {
  try {
    return { ok: true, data: await github(token, method, endpoint) };
  } catch (error) {
    return {
      ok: false,
      status: error.status ?? null,
      error: error.data?.message ?? error.message,
    };
  }
}

async function listDeploymentBranchPolicies(token, target, environment) {
  try {
    const data = await github(
      token,
      "GET",
      `repos/${target}/environments/${encodeURIComponent(environment)}/deployment-branch-policies?per_page=100`,
    );
    return { ok: true, policies: data.branch_policies || [] };
  } catch (error) {
    return {
      ok: false,
      status: error.status ?? null,
      policies: [],
      error: error.data?.message ?? error.message,
    };
  }
}

async function ensureMainDeploymentBranchPolicy(token, target, environment) {
  const before = await listDeploymentBranchPolicies(token, target, environment);
  if (before.ok && before.policies.some((policy) => policy.name === "main" && policy.type === "branch")) {
    return { ok: true, state: "main_branch_policy_exists", before, created: false };
  }
  try {
    await github(
      token,
      "POST",
      `repos/${target}/environments/${encodeURIComponent(environment)}/deployment-branch-policies`,
      { name: "main", type: "branch" },
    );
    return { ok: true, state: "main_branch_policy_created", before, created: true };
  } catch (error) {
    if (error.status === 422) {
      return { ok: true, state: "main_branch_policy_exists_or_unavailable", before, created: false };
    }
    return {
      ok: false,
      state: "main_branch_policy_not_configurable_by_api",
      before,
      status: error.status ?? null,
      error: error.data?.message ?? error.message,
    };
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const token = process.env.GH_TOKEN || process.env.GITHUB_TOKEN;
  if (!token) {
    throw new Error("GH_TOKEN or GITHUB_TOKEN is required");
  }

  const target = `${args.owner}/${args.repo}`;
  const policy = policyFor(args.owner, args.repo);
  const requiredSecrets = requiredSecretNames(policy);

  const environmentsBefore = await github(token, "GET", `repos/${target}/environments?per_page=100`);
  const existed = (environmentsBefore.environments || []).some((env) => env.name === args.environment);
  let finalState = existed ? "production_environment_exists" : "production_environment_missing";
  let putError = null;
  let branchPolicyResult = null;

  if (args.apply || ["ensure", "reset_reviewers"].includes(args.mode)) {
    let reviewerId = null;
    if (args.reviewerLogin) {
      const reviewer = await github(token, "GET", `users/${encodeURIComponent(args.reviewerLogin)}`);
      reviewerId = reviewer.id;
    }
    const body = {
      wait_timer: 0,
      reviewers: reviewerId ? [{ type: "User", id: reviewerId }] : [],
      prevent_self_review: false,
      deployment_branch_policy: {
        protected_branches: false,
        custom_branch_policies: true,
      },
    };
    try {
      await github(token, "PUT", `repos/${target}/environments/${encodeURIComponent(args.environment)}`, body);
      finalState = existed ? "production_environment_exists" : "production_environment_created";
      branchPolicyResult = await ensureMainDeploymentBranchPolicy(token, target, args.environment);
    } catch (error) {
      putError = {
        status: error.status ?? null,
        message: error.data?.message ?? error.message,
      };
      finalState = "production_environment_not_configurable_by_api";
    }
  }

  const environment = await optionalGithub(
    token,
    "GET",
    `repos/${target}/environments/${encodeURIComponent(args.environment)}`,
  );
  const repoSecrets = await optionalGithub(token, "GET", `repos/${target}/actions/secrets?per_page=100`);
  const envSecrets = await optionalGithub(
    token,
    "GET",
    `repos/${target}/environments/${encodeURIComponent(args.environment)}/secrets?per_page=100`,
  );
  const repoSecretNames = new Set((repoSecrets.data?.secrets || []).map((secret) => secret.name));
  const envSecretNames = new Set((envSecrets.data?.secrets || []).map((secret) => secret.name));
  const presentSecretNames = requiredSecrets.filter((name) => repoSecretNames.has(name) || envSecretNames.has(name));
  const missingSecretNames = requiredSecrets.filter((name) => !repoSecretNames.has(name) && !envSecretNames.has(name));

  const report = {
    generated_at: new Date().toISOString(),
    target,
    environment: args.environment,
    apply: args.apply,
    mode: args.mode,
    final_state: finalState,
    policy_profile: policy.autonomy?.profile ?? "unknown",
    publish_enabled: Boolean(policy.publish?.enabled),
    required_secret_names: requiredSecrets,
    present_secret_names: presentSecretNames,
    missing_secret_names: missingSecretNames,
    environment_observation: environment,
    deployment_branch_policy_observation: branchPolicyResult,
    repo_secrets_observation: {
      ok: repoSecrets.ok,
      status: repoSecrets.status ?? null,
      names: [...repoSecretNames].sort(),
      error: repoSecrets.error ?? null,
    },
    environment_secrets_observation: {
      ok: envSecrets.ok,
      status: envSecrets.status ?? null,
      names: [...envSecretNames].sort(),
      error: envSecrets.error ?? null,
    },
    error: putError,
  };

  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  if (finalState === "production_environment_not_configurable_by_api") {
    process.exitCode = 2;
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  main().catch((error) => {
    console.error(error.message);
    if (error.data) {
      console.error(JSON.stringify({ status: error.status ?? null, message: error.data.message ?? "" }));
    }
    process.exit(1);
  });
}
