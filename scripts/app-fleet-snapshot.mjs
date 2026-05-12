#!/usr/bin/env node
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const API_VERSION = "2026-03-10";
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const REPOS = [
  "boardguard",
  "kicad-studio",
  "mcp-health-monitor",
  "mcp-debug-recorder",
  "mcp-infra-lens",
  "test",
  "kicad-mcp-pro",
  "mcp-ssh-tool",
  "fovux",
  "a2a-mesh",
  "codex-app-server-web",
  "cifence",
  "oaslananka.github.io",
];

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

async function optionalApi(token, method, endpoint, body) {
  try {
    return { ok: true, data: await api(token, method, endpoint, body) };
  } catch (error) {
    return {
      ok: false,
      status: error.status ?? null,
      message: error.data?.message ?? error.message,
    };
  }
}

async function installationToken(appJwt, owner, repo) {
  const installs = await api(appJwt, "GET", "app/installations");
  const install = installs.find((item) => item.account?.login === owner);
  if (!install) throw new Error(`GitHub App installation not found for ${owner}`);
  const token = await api(appJwt, "POST", `app/installations/${install.id}/access_tokens`, {
    repositories: [repo],
  });
  return token.token;
}

async function tokenCache(appJwt) {
  const cache = new Map();
  return async function token(owner, repo) {
    const key = `${owner}/${repo}`;
    if (!cache.has(key)) cache.set(key, await installationToken(appJwt, owner, repo));
    return cache.get(key);
  };
}

async function commit(token, owner, repo) {
  const result = await optionalApi(token, "GET", `repos/${owner}/${repo}/commits/main`);
  return result.ok ? result.data : null;
}

function relation(source, mirror) {
  if (!source || !mirror) return "missing_ref";
  if (source.sha === mirror.sha) return "equal";
  if (source.commit?.tree?.sha && source.commit.tree.sha === mirror.commit?.tree?.sha) return "tree_equal";
  return "drift";
}

function reviewersCount(environment) {
  return (environment?.protection_rules || [])
    .filter((rule) => rule.type === "required_reviewers")
    .reduce((sum, rule) => sum + (rule.reviewers?.length || 0), 0);
}

function summarizePr(pr) {
  return {
    number: pr.number,
    title: pr.title,
    url: pr.html_url,
    headRef: pr.head?.ref ?? null,
    headSha: pr.head?.sha ?? null,
    baseRef: pr.base?.ref ?? null,
    draft: pr.draft,
    user: pr.user?.login ?? null,
  };
}

function summarizeRun(run) {
  if (!run) return null;
  return {
    id: run.id,
    name: run.name,
    event: run.event,
    status: run.status,
    conclusion: run.conclusion,
    url: run.html_url,
    createdAt: run.created_at,
  };
}

async function latestRuns(token, owner, repo) {
  const result = await optionalApi(token, "GET", `repos/${owner}/${repo}/actions/runs?per_page=20`);
  return result.ok ? (result.data.workflow_runs || []).map(summarizeRun) : [];
}

async function main() {
  const appId = process.env.REPO_OPS_APP_ID;
  const privateKey = process.env.REPO_OPS_APP_PRIVATE_KEY;
  if (!appId || !privateKey) throw new Error("REPO_OPS_APP_ID and REPO_OPS_APP_PRIVATE_KEY are required");
  const appJwt = jwt(appId, privateKey.replace(/\\n/g, "\n"));
  const getToken = await tokenCache(appJwt);
  const report = { generated_at: new Date().toISOString(), repos: [] };

  for (const repo of REPOS) {
    const sourceOwner = "oaslananka";
    const mirrorOwner = "oaslananka-lab";
    const sourceToken = await getToken(sourceOwner, repo);
    const mirrorToken = await getToken(mirrorOwner, repo);
    const sourceCommit = await commit(sourceToken, sourceOwner, repo);
    const mirrorCommit = await commit(mirrorToken, mirrorOwner, repo);
    const sourcePrs = await optionalApi(sourceToken, "GET", `repos/${sourceOwner}/${repo}/pulls?state=open&per_page=100`);
    const mirrorPrs = await optionalApi(mirrorToken, "GET", `repos/${mirrorOwner}/${repo}/pulls?state=open&per_page=100`);
    const environment = await optionalApi(mirrorToken, "GET", `repos/${mirrorOwner}/${repo}/environments/production`);
    const runs = await latestRuns(mirrorToken, mirrorOwner, repo);
    report.repos.push({
      repo,
      source: `${sourceOwner}/${repo}`,
      mirror: `${mirrorOwner}/${repo}`,
      source_sha: sourceCommit?.sha ?? null,
      mirror_sha: mirrorCommit?.sha ?? null,
      source_tree_sha: sourceCommit?.commit?.tree?.sha ?? null,
      mirror_tree_sha: mirrorCommit?.commit?.tree?.sha ?? null,
      relation: relation(sourceCommit, mirrorCommit),
      source_open_prs: sourcePrs.ok ? sourcePrs.data.map(summarizePr) : [],
      mirror_open_prs: mirrorPrs.ok ? mirrorPrs.data.map(summarizePr) : [],
      production_environment: environment.ok
        ? {
            state: "exists",
            reviewers: reviewersCount(environment.data),
          }
        : {
            state: "missing_or_inaccessible",
            reviewers: null,
            status: environment.status,
            message: environment.message,
          },
      latest_runs: runs.slice(0, 5),
    });
  }

  fs.mkdirSync(path.join(ROOT, "out"), { recursive: true });
  fs.writeFileSync(path.join(ROOT, "out", "app-fleet-snapshot.json"), `${JSON.stringify(report, null, 2)}\n`);
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
}

main().catch((error) => {
  console.error(error.message);
  if (error.data?.message) console.error(error.data.message);
  process.exit(1);
});
