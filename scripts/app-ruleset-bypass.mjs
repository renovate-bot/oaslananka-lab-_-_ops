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
  const args = { action: "list" };
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

function ruleTypes(ruleset) {
  return (ruleset.rules || []).map((rule) => rule.type).sort();
}

function summarize(ruleset) {
  return {
    id: ruleset.id,
    name: ruleset.name,
    target: ruleset.target,
    enforcement: ruleset.enforcement,
    rules: ruleTypes(ruleset),
    bypassActors: (ruleset.bypass_actors || []).map((actor) => ({
      actorId: actor.actor_id,
      actorType: actor.actor_type,
      bypassMode: actor.bypass_mode,
    })),
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const target = `${args.owner}/${args.repo}`;
  const token = await installationToken(args.owner, args.repo);
  const listed = await api(token, "GET", `repos/${target}/rulesets`);
  const detailed = [];
  for (const item of listed) {
    detailed.push(await api(token, "GET", `repos/${target}/rulesets/${item.id}`));
  }

  if (args.action === "list") {
    process.stdout.write(`${JSON.stringify({ target, rulesets: detailed.map(summarize) }, null, 2)}\n`);
    return;
  }

  if (args.action !== "add-app-bypass") throw new Error(`Unsupported --action: ${args.action}`);
  const appId = Number(args.appId || process.env.REPO_OPS_APP_ID);
  if (!Number.isInteger(appId) || appId <= 0) throw new Error("A numeric --app-id or REPO_OPS_APP_ID is required");

  const updates = [];
  for (const ruleset of detailed) {
    const rules = ruleTypes(ruleset);
    const relevant = rules.includes("pull_request") || rules.includes("required_status_checks");
    if (!relevant) continue;
    const actors = ruleset.bypass_actors || [];
    const exists = actors.some((actor) => actor.actor_type === "Integration" && Number(actor.actor_id) === appId);
    if (exists) {
      updates.push({ id: ruleset.id, name: ruleset.name, changed: false, reason: "already_present" });
      continue;
    }
    const body = {
      name: ruleset.name,
      target: ruleset.target,
      enforcement: ruleset.enforcement,
      bypass_actors: [
        ...actors.map((actor) => ({
          actor_id: actor.actor_id,
          actor_type: actor.actor_type,
          bypass_mode: actor.bypass_mode,
        })),
        { actor_id: appId, actor_type: "Integration", bypass_mode: "always" },
      ],
      conditions: ruleset.conditions,
      rules: ruleset.rules,
    };
    const updated = await api(token, "PUT", `repos/${target}/rulesets/${ruleset.id}`, body);
    updates.push({ id: ruleset.id, name: ruleset.name, changed: true, bypassActors: summarize(updated).bypassActors });
  }
  process.stdout.write(`${JSON.stringify({ target, appId, updates }, null, 2)}\n`);
}

main().catch((error) => {
  console.error(error.message);
  if (error.data?.message) console.error(error.data.message);
  if (error.data?.errors) console.error(JSON.stringify(error.data.errors));
  process.exit(1);
});
