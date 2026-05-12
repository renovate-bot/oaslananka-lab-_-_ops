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
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const key = argv[i];
    if (!key.startsWith("--")) throw new Error(`Unexpected argument: ${key}`);
    const name = key.slice(2).replace(/-([a-z])/g, (_, c) => c.toUpperCase());
    args[name] = argv[i + 1];
    i += 1;
  }
  for (const required of ["owner", "repo", "pr"]) {
    if (!args[required]) throw new Error(`--${required} is required`);
  }
  args.pr = Number(args.pr);
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

function summarizeCheck(check) {
  return {
    id: check.id,
    name: check.name,
    status: check.status,
    conclusion: check.conclusion,
    startedAt: check.started_at,
    completedAt: check.completed_at,
    url: check.html_url,
    detailsUrl: check.details_url,
    output: check.output
      ? {
          title: check.output.title,
          summary: check.output.summary ? check.output.summary.slice(0, 2000) : "",
          text: check.output.text ? check.output.text.slice(0, 2000) : "",
        }
      : null,
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const target = `${args.owner}/${args.repo}`;
  const token = await installationToken(args.owner, args.repo);
  const pr = await api(token, "GET", `repos/${target}/pulls/${args.pr}`);
  const checks = await api(token, "GET", `repos/${target}/commits/${pr.head.sha}/check-runs?per_page=100`);
  const statuses = await api(token, "GET", `repos/${target}/commits/${pr.head.sha}/status`);
  const report = {
    target,
    pr: {
      number: pr.number,
      url: pr.html_url,
      title: pr.title,
      headRef: pr.head.ref,
      headSha: pr.head.sha,
      mergeable: pr.mergeable,
    },
    check_runs: (checks.check_runs || []).map(summarizeCheck),
    statuses: (statuses.statuses || []).map((status) => ({
      context: status.context,
      state: status.state,
      url: status.target_url,
      description: status.description,
    })),
  };
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
}

main().catch((error) => {
  console.error(error.message);
  if (error.data?.message) console.error(error.data.message);
  process.exit(1);
});
