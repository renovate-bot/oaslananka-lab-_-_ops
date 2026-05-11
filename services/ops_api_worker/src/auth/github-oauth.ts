import type { Env } from "../env";
import { requireEnv } from "../env";
import { HttpError } from "../errors";
import { randomId } from "../security";
import { createSession } from "./session";

const OAUTH_STATE_TTL_SECONDS = 600;
const GITHUB_AUTHORIZE = "https://github.com/login/oauth/authorize";
const GITHUB_ACCESS_TOKEN = "https://github.com/login/oauth/access_token";
const GITHUB_USER = "https://api.github.com/user";

export interface GitHubUser {
  id: number;
  login: string;
}

export async function startGitHubOAuth(env: Env): Promise<Response> {
  const clientId = requireEnv(env, "GITHUB_OAUTH_CLIENT_ID");
  const callbackUrl = requireEnv(env, "GITHUB_OAUTH_CALLBACK_URL");
  const state = randomId("oauth");
  await env.OAUTH_STATE.put(state, "1", { expirationTtl: OAUTH_STATE_TTL_SECONDS });
  const url = new URL(GITHUB_AUTHORIZE);
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", callbackUrl);
  url.searchParams.set("scope", "read:user user:email");
  url.searchParams.set("state", state);
  return Response.redirect(url.toString(), 302);
}

export async function finishGitHubOAuth(env: Env, request: Request): Promise<Response> {
  const url = new URL(request.url);
  const code = url.searchParams.get("code") || "";
  const state = url.searchParams.get("state") || "";
  if (!code || !state) {
    throw new HttpError(400, "OAUTH_CALLBACK_INVALID", "OAuth callback is missing code or state.");
  }
  const stateFound = await env.OAUTH_STATE.get(state);
  if (!stateFound) {
    throw new HttpError(400, "OAUTH_STATE_INVALID", "OAuth state is invalid or expired.");
  }
  await env.OAUTH_STATE.delete(state);

  const token = await exchangeCodeForToken(env, code);
  const user = await fetchGitHubUser(token);
  const { cookie } = await createSession(env, user.login, user.id);
  return new Response(null, {
    status: 302,
    headers: {
      location: `${env.OPS_API_PUBLIC_BASE_URL}/v1/me`,
      "set-cookie": cookie
    }
  });
}

async function exchangeCodeForToken(env: Env, code: string): Promise<string> {
  const response = await fetch(GITHUB_ACCESS_TOKEN, {
    method: "POST",
    headers: {
      accept: "application/json",
      "content-type": "application/json"
    },
    body: JSON.stringify({
      client_id: requireEnv(env, "GITHUB_OAUTH_CLIENT_ID"),
      client_secret: requireEnv(env, "GITHUB_OAUTH_CLIENT_SECRET"),
      code,
      redirect_uri: requireEnv(env, "GITHUB_OAUTH_CALLBACK_URL")
    })
  });
  const payload = (await response.json()) as { access_token?: string; error?: string };
  if (!response.ok || !payload.access_token) {
    throw new HttpError(401, "OAUTH_TOKEN_EXCHANGE_FAILED", "GitHub OAuth token exchange failed.", {
      github_error: payload.error || response.status
    });
  }
  return payload.access_token;
}

async function fetchGitHubUser(token: string): Promise<GitHubUser> {
  const response = await fetch(GITHUB_USER, {
    headers: {
      accept: "application/vnd.github+json",
      authorization: `Bearer ${token}`,
      "user-agent": "oaslananka-ops-api"
    }
  });
  if (!response.ok) {
    throw new HttpError(401, "GITHUB_USER_LOOKUP_FAILED", "Could not fetch authenticated GitHub user.");
  }
  const user = (await response.json()) as GitHubUser;
  if (!user.login || typeof user.id !== "number") {
    throw new HttpError(401, "GITHUB_USER_INVALID", "GitHub user response was invalid.");
  }
  return user;
}
