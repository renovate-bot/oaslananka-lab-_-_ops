export interface Env {
  OAUTH_STATE: KVNamespace;
  OPS_SESSIONS: KVNamespace;
  OPS_REPO: string;
  OPS_API_PUBLIC_BASE_URL: string;
  OPS_APP_PUBLIC_BASE_URL: string;
  ALLOWED_GITHUB_LOGINS: string;
  GITHUB_OAUTH_CALLBACK_URL: string;
  GITHUB_OAUTH_CLIENT_ID?: string;
  GITHUB_OAUTH_CLIENT_SECRET?: string;
  SESSION_SECRET?: string;
  REPO_OPS_APP_ID?: string;
  REPO_OPS_APP_CLIENT_ID?: string;
  REPO_OPS_APP_PRIVATE_KEY?: string;
}

export function allowedLogins(env: Env): Set<string> {
  return new Set(
    env.ALLOWED_GITHUB_LOGINS.split(",")
      .map((entry) => entry.trim().toLowerCase())
      .filter(Boolean)
  );
}

export function requireEnv(env: Env, key: keyof Env): string {
  const value = env[key];
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`Missing required environment binding: ${String(key)}`);
  }
  return value;
}

export function opsRepo(env: Env): { owner: string; repo: string; full: string } {
  const full = env.OPS_REPO || "oaslananka-lab/_ops";
  const [owner, repo] = full.split("/");
  if (!owner || !repo) throw new Error("OPS_REPO must be owner/repo");
  return { owner, repo, full };
}
