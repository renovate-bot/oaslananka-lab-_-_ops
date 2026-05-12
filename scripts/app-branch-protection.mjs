#!/usr/bin/env node
import crypto from "node:crypto";
import process from "node:process";

const API_VERSION = "2026-03-10";

function base64url(input) {
  return Buffer.from(input).toString("base64url");
}

function jwt(appId, privateKey) {
  const now = Math.floor(Date.now() / 1000);
  const header = base64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const payload = base64url(JSON.stringify({ iat: now - 60, exp: now + 540, iss: appId }));
  const data = `${header}.${payload}`;
  const signature = crypto.createSign("RSA-SHA256").update(data).sign(privateKey, "base64url");
  return `${data}.${signature}`;
}

function parseArgs(argv) {
  const args = { action: "view", branch: "main", app: "oaslananka-repo-ops" };
  for (let i = 0; i < argv.length; i += 1) {
    const key = argv[i];
    if (!key.startsWith("--")) throw new Error(`Unexpected argument: ${key}`);
    const name = key.slice(2).replace(/-([a-z])/g, (_, c) => c.toUpperCase());
    args[name] = argv[i + 1];
    i += 1;
  }
  for (const required of ["owner", "repo"]) {
    if (!args[required]) throw new Error(`--${required} is required`);
  }
  return args;
}

async function api(token, method, endpoint, body) {
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
  const data = text ? JSON.parse(text) : null;
  if (!response.ok) {
    const error = new Error(`GitHub API ${method} ${endpoint} failed: ${response.status}`);
    error.status = response.status;
    error.data = data;
    throw error;
  }
  return data;
}

async function installationToken(owner, repo) {
  const appId = process.env.REPO_OPS_APP_ID;
  const privateKey = process.env.REPO_OPS_APP_PRIVATE_KEY;
  if (!appId || !privateKey) throw new Error("REPO_OPS_APP_ID and REPO_OPS_APP_PRIVATE_KEY are required");
  const appJwt = jwt(appId, privateKey.replace(/\\n/g, "\n"));
  const installs = await api(appJwt, "GET", "app/installations");
  const install = installs.find((item) => item.account?.login === owner);
  if (!install) throw new Error(`GitHub App installation not found for ${owner}`);
  const token = await api(appJwt, "POST", `app/installations/${install.id}/access_tokens`, {
    repositories: [repo],
  });
  return token.token;
}

function summarize(protection) {
  const reviews = protection.required_pull_request_reviews || null;
  const checks = protection.required_status_checks || null;
  return {
    requiredStatusChecks: checks
      ? {
          strict: checks.strict,
          contexts: checks.contexts || [],
          checks: checks.checks || [],
        }
      : null,
    requiredPullRequestReviews: reviews
      ? {
          dismissStaleReviews: reviews.dismiss_stale_reviews,
          requireCodeOwnerReviews: reviews.require_code_owner_reviews,
          requiredApprovingReviewCount: reviews.required_approving_review_count,
          requireLastPushApproval: reviews.require_last_push_approval,
          bypassApps: reviews.bypass_pull_request_allowances?.apps?.map((app) => app.slug) || [],
          bypassUsers: reviews.bypass_pull_request_allowances?.users?.map((user) => user.login) || [],
          bypassTeams: reviews.bypass_pull_request_allowances?.teams?.map((team) => team.slug) || [],
        }
      : null,
    requiredConversationResolution: Boolean(protection.required_conversation_resolution?.enabled),
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const target = `${args.owner}/${args.repo}`;
  const token = await installationToken(args.owner, args.repo);
  const protection = await api(token, "GET", `repos/${target}/branches/${encodeURIComponent(args.branch)}/protection`);
  if (args.action === "view") {
    process.stdout.write(`${JSON.stringify({ target, branch: args.branch, protection: summarize(protection) }, null, 2)}\n`);
    return;
  }
  if (args.action === "replace-required-check") {
    if (!args.from || !args.to) throw new Error("--from and --to are required for replace-required-check");
    const checks = protection.required_status_checks;
    if (!checks) throw new Error("Branch protection has no required_status_checks block");
    const updatedChecks = (checks.checks || []).map((check) =>
      check.context === args.from ? { ...check, context: args.to } : check,
    );
    const updatedContexts = (checks.contexts || []).map((context) => (context === args.from ? args.to : context));
    if (!updatedChecks.some((check) => check.context === args.to) && !updatedContexts.includes(args.to)) {
      throw new Error(`Required check ${args.from} was not present`);
    }
    const updated = await api(
      token,
      "PATCH",
      `repos/${target}/branches/${encodeURIComponent(args.branch)}/protection/required_status_checks`,
      {
        strict: Boolean(checks.strict),
        contexts: [...new Set(updatedContexts)],
        checks: updatedChecks.map((check) => ({
          context: check.context,
          app_id: check.app_id,
        })),
      },
    );
    process.stdout.write(
      `${JSON.stringify(
        {
          target,
          branch: args.branch,
          replaced: { from: args.from, to: args.to },
          requiredStatusChecks: {
            strict: updated.strict,
            contexts: updated.contexts || [],
            checks: updated.checks || [],
          },
        },
        null,
        2,
      )}\n`,
    );
    return;
  }
  if (args.action !== "add-app-review-bypass") throw new Error(`Unsupported --action: ${args.action}`);
  const reviews = protection.required_pull_request_reviews;
  if (!reviews) throw new Error("Branch protection has no required_pull_request_reviews block");
  const bypass = reviews.bypass_pull_request_allowances || {};
  const users = (bypass.users || []).map((user) => user.login);
  const teams = (bypass.teams || []).map((team) => team.slug);
  const apps = new Set((bypass.apps || []).map((app) => app.slug));
  apps.add(args.app);
  const updated = await api(
    token,
    "PATCH",
    `repos/${target}/branches/${encodeURIComponent(args.branch)}/protection/required_pull_request_reviews`,
    {
      dismissal_restrictions: {
        users: (reviews.dismissal_restrictions?.users || []).map((user) => user.login),
        teams: (reviews.dismissal_restrictions?.teams || []).map((team) => team.slug),
        apps: (reviews.dismissal_restrictions?.apps || []).map((app) => app.slug),
      },
      dismiss_stale_reviews: Boolean(reviews.dismiss_stale_reviews),
      require_code_owner_reviews: Boolean(reviews.require_code_owner_reviews),
      required_approving_review_count: reviews.required_approving_review_count ?? 1,
      require_last_push_approval: Boolean(reviews.require_last_push_approval),
      bypass_pull_request_allowances: {
        users,
        teams,
        apps: [...apps].sort(),
      },
    },
  );
  process.stdout.write(`${JSON.stringify({ target, branch: args.branch, updated: summarize({ required_pull_request_reviews: updated }) }, null, 2)}\n`);
}

main().catch((error) => {
  console.error(error.message);
  if (error.data?.message) console.error(error.data.message);
  if (error.data?.errors) console.error(JSON.stringify(error.data.errors));
  process.exit(1);
});
