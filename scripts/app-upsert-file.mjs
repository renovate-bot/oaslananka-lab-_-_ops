#!/usr/bin/env node
import crypto from "node:crypto";
import fs from "node:fs";
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
  const args = { base: "main", branch: "", title: "", body: "", merge: true, deleteBranch: true };
  for (let i = 0; i < argv.length; i += 1) {
    const key = argv[i];
    if (!key.startsWith("--")) throw new Error(`Unexpected argument: ${key}`);
    const name = key.slice(2).replace(/-([a-z])/g, (_, c) => c.toUpperCase());
    if (["merge", "deleteBranch"].includes(name)) {
      args[name] = argv[i + 1] !== "false";
      i += 1;
    } else {
      args[name] = argv[i + 1];
      i += 1;
    }
  }
  for (const required of ["owner", "repo", "path", "contentFile"]) {
    if (!args[required]) throw new Error(`--${required.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)} is required`);
  }
  args.branch ||= `repo-ops/upsert-${args.path.replace(/[^A-Za-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "")}`;
  args.title ||= `chore: update ${args.path}`;
  args.body ||= "Policy-controlled repository automation update.";
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

async function optionalApi(token, method, endpoint, body) {
  try {
    return { ok: true, data: await api(token, method, endpoint, body) };
  } catch (error) {
    return { ok: false, status: error.status, data: error.data };
  }
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

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const target = `${args.owner}/${args.repo}`;
  const token = await installationToken(args.owner, args.repo);
  const baseRef = await api(token, "GET", `repos/${target}/git/ref/heads/${encodeURIComponent(args.base)}`);
  const baseSha = baseRef.object.sha;
  const branchRef = await optionalApi(token, "GET", `repos/${target}/git/ref/heads/${encodeURIComponent(args.branch)}`);
  if (!branchRef.ok) {
    await api(token, "POST", `repos/${target}/git/refs`, {
      ref: `refs/heads/${args.branch}`,
      sha: baseSha,
    });
  }
  const existing = await optionalApi(
    token,
    "GET",
    `repos/${target}/contents/${encodeURIComponent(args.path).replaceAll("%2F", "/")}?ref=${encodeURIComponent(args.branch)}`,
  );
  const content = fs.readFileSync(args.contentFile, "utf8");
  const current = existing.ok && existing.data?.content ? Buffer.from(existing.data.content, "base64").toString("utf8") : null;
  let changed = current !== content;
  if (changed) {
    await api(token, "PUT", `repos/${target}/contents/${encodeURIComponent(args.path).replaceAll("%2F", "/")}`, {
      message: args.title,
      content: Buffer.from(content).toString("base64"),
      branch: args.branch,
      sha: existing.ok ? existing.data.sha : undefined,
    });
  }
  const pulls = await api(
    token,
    "GET",
    `repos/${target}/pulls?state=open&head=${encodeURIComponent(`${args.owner}:${args.branch}`)}&base=${encodeURIComponent(args.base)}`,
  );
  let pr = pulls[0] || null;
  if (!pr && changed) {
    pr = await api(token, "POST", `repos/${target}/pulls`, {
      title: args.title,
      body: args.body,
      head: args.branch,
      base: args.base,
      maintainer_can_modify: true,
    });
  }
  let merge = null;
  if (args.merge && pr) {
    const fresh = await api(token, "GET", `repos/${target}/pulls/${pr.number}`);
    merge = await optionalApi(token, "PUT", `repos/${target}/pulls/${pr.number}/merge`, {
      commit_title: args.title,
      merge_method: "squash",
      sha: fresh.head.sha,
    });
    if (merge.ok && args.deleteBranch) {
      await optionalApi(token, "DELETE", `repos/${target}/git/refs/heads/${encodeURIComponent(args.branch)}`);
    }
  }
  const report = {
    target,
    path: args.path,
    branch: args.branch,
    changed,
    pr: pr ? { number: pr.number, url: pr.html_url } : null,
    merge: merge
      ? {
          ok: merge.ok,
          status: merge.status ?? null,
          sha: merge.data?.sha ?? null,
          message: merge.data?.message ?? null,
        }
      : null,
  };
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  if (merge && !merge.ok) process.exitCode = 2;
}

main().catch((error) => {
  console.error(error.message);
  if (error.data?.message) console.error(error.data.message);
  process.exit(1);
});
