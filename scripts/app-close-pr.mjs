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
  const args = { deleteBranch: true, comment: "" };
  for (let i = 0; i < argv.length; i += 1) {
    const key = argv[i];
    if (!key.startsWith("--")) throw new Error(`Unexpected argument: ${key}`);
    const name = key.slice(2).replace(/-([a-z])/g, (_, c) => c.toUpperCase());
    if (name === "deleteBranch") {
      args[name] = argv[i + 1] !== "false";
      i += 1;
    } else {
      args[name] = argv[i + 1];
      i += 1;
    }
  }
  for (const required of ["owner", "repo", "pr"]) {
    if (!args[required]) throw new Error(`--${required} is required`);
  }
  args.pr = Number(args.pr);
  if (!Number.isInteger(args.pr) || args.pr <= 0) throw new Error("--pr must be a positive integer");
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
  const pr = await api(token, "GET", `repos/${target}/pulls/${args.pr}`);
  if (args.comment) {
    await api(token, "POST", `repos/${target}/issues/${args.pr}/comments`, { body: args.comment });
  }
  const closed = pr.state === "closed" ? pr : await api(token, "PATCH", `repos/${target}/pulls/${args.pr}`, { state: "closed" });
  let branchDelete = null;
  if (args.deleteBranch && pr.head?.repo?.full_name === target) {
    branchDelete = await optionalApi(token, "DELETE", `repos/${target}/git/refs/heads/${encodeURIComponent(pr.head.ref)}`);
  }
  process.stdout.write(
    `${JSON.stringify(
      {
        target,
        pr: args.pr,
        url: pr.html_url,
        previousState: pr.state,
        state: closed.state,
        headRef: pr.head?.ref ?? null,
        branchDelete: branchDelete ? { ok: branchDelete.ok, status: branchDelete.status ?? null } : null,
      },
      null,
      2,
    )}\n`,
  );
}

main().catch((error) => {
  console.error(error.message);
  if (error.data?.message) console.error(error.data.message);
  process.exit(1);
});
