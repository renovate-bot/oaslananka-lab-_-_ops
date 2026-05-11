import type { Env } from "../env";
import { json } from "../errors";
import { readSession } from "../auth/session";

export async function me(env: Env, request: Request): Promise<Response> {
  const session = await readSession(env, request);
  if (!session) {
    return json({
      authenticated: false
    });
  }
  return json({
    authenticated: true,
    login: session.login,
    id: session.github_id
  });
}
