import type { Env } from "../env";
import { allowedLogins, requireEnv } from "../env";
import { HttpError } from "../errors";
import { randomId } from "../security";

const COOKIE_NAME = "ops_session";
const SESSION_TTL_SECONDS = 60 * 60 * 8;

export interface Session {
  id: string;
  login: string;
  github_id: number;
  created_at: string;
}

function cookieHeader(sessionId: string, maxAge: number): string {
  return `${COOKIE_NAME}=${sessionId}; Path=/; Max-Age=${maxAge}; HttpOnly; Secure; SameSite=Lax`;
}

export function expireSessionCookie(): string {
  return cookieHeader("", 0);
}

export function getSessionId(request: Request): string | null {
  const cookie = request.headers.get("cookie") || "";
  for (const part of cookie.split(";")) {
    const [rawName, ...rawValue] = part.trim().split("=");
    if (rawName === COOKIE_NAME) return rawValue.join("=") || null;
  }
  return null;
}

export async function createSession(env: Env, login: string, githubId: number): Promise<{ session: Session; cookie: string }> {
  requireEnv(env, "SESSION_SECRET");
  const normalized = login.toLowerCase();
  if (!allowedLogins(env).has(normalized)) {
    throw new HttpError(403, "LOGIN_NOT_ALLOWED", "GitHub login is not allowed for this ops console.");
  }
  const session: Session = {
    id: randomId("sess"),
    login,
    github_id: githubId,
    created_at: new Date().toISOString()
  };
  await env.OPS_SESSIONS.put(session.id, JSON.stringify(session), {
    expirationTtl: SESSION_TTL_SECONDS
  });
  return { session, cookie: cookieHeader(session.id, SESSION_TTL_SECONDS) };
}

export async function readSession(env: Env, request: Request): Promise<Session | null> {
  const sessionId = getSessionId(request);
  if (!sessionId) return null;
  const raw = await env.OPS_SESSIONS.get(sessionId);
  if (!raw) return null;
  const session = JSON.parse(raw) as Session;
  if (!allowedLogins(env).has(session.login.toLowerCase())) return null;
  return session;
}

export async function requireSession(env: Env, request: Request): Promise<Session> {
  const session = await readSession(env, request);
  if (!session) {
    throw new HttpError(401, "AUTH_REQUIRED", "Authentication is required.");
  }
  return session;
}

export async function deleteSession(env: Env, request: Request): Promise<void> {
  const sessionId = getSessionId(request);
  if (sessionId) await env.OPS_SESSIONS.delete(sessionId);
}
