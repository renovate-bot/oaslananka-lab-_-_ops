import type { Env } from "../env";
import { json } from "../errors";
import { finishGitHubOAuth, startGitHubOAuth } from "../auth/github-oauth";
import { deleteSession, expireSessionCookie } from "../auth/session";

export function oauthStart(env: Env): Promise<Response> {
  return startGitHubOAuth(env);
}

export function oauthCallback(env: Env, request: Request): Promise<Response> {
  return finishGitHubOAuth(env, request);
}

export async function logout(env: Env, request: Request): Promise<Response> {
  await deleteSession(env, request);
  return json(
    {
      authenticated: false
    },
    200,
    {
      "set-cookie": expireSessionCookie()
    }
  );
}
