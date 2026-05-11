import type { Env } from "../env";
import { opsRepo, requireEnv } from "../env";
import { HttpError } from "../errors";

const GITHUB_API = "https://api.github.com";

function base64Url(input: ArrayBuffer | string): string {
  const bytes = typeof input === "string" ? new TextEncoder().encode(input) : new Uint8Array(input);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function pemToArrayBuffer(pem: string): ArrayBuffer {
  const body = pem
    .replace(/-----BEGIN [^-]+-----/g, "")
    .replace(/-----END [^-]+-----/g, "")
    .replace(/\s+/g, "");
  const binary = atob(body);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes.buffer;
}

async function signJwt(env: Env): Promise<string> {
  const appId = requireEnv(env, "REPO_OPS_APP_ID");
  const privateKey = requireEnv(env, "REPO_OPS_APP_PRIVATE_KEY");
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const payload = {
    iat: now - 60,
    exp: now + 9 * 60,
    iss: appId
  };
  const signingInput = `${base64Url(JSON.stringify(header))}.${base64Url(JSON.stringify(payload))}`;
  const key = await crypto.subtle.importKey(
    "pkcs8",
    pemToArrayBuffer(privateKey),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(signingInput));
  return `${signingInput}.${base64Url(signature)}`;
}

async function githubJson<T>(path: string, init: RequestInit & { token: string }): Promise<T> {
  const response = await fetch(`${GITHUB_API}${path}`, {
    ...init,
    headers: {
      accept: "application/vnd.github+json",
      authorization: `Bearer ${init.token}`,
      "content-type": "application/json",
      "user-agent": "oaslananka-ops-api",
      "x-github-api-version": "2026-03-10",
      ...(init.headers || {})
    }
  });
  if (!response.ok) {
    throw new HttpError(response.status, "GITHUB_API_FAILED", `GitHub API request failed: ${path}`, {
      status: response.status
    });
  }
  return (await response.json()) as T;
}

export async function getOpsInstallationToken(env: Env): Promise<string> {
  const { owner, repo } = opsRepo(env);
  let jwt: string;
  try {
    jwt = await signJwt(env);
  } catch (error) {
    const message = error instanceof Error ? error.message : "GitHub App key unavailable";
    throw new HttpError(503, "GITHUB_APP_SECRET_MISSING", "GitHub App private key is not configured for ops-api.", {
      reason: message
    });
  }
  const installation = await githubJson<{ id: number }>(`/repos/${owner}/${repo}/installation`, {
    method: "GET",
    token: jwt
  });
  const tokenResponse = await githubJson<{ token: string }>(`/app/installations/${installation.id}/access_tokens`, {
    method: "POST",
    token: jwt,
    body: JSON.stringify({
      repositories: [repo]
    })
  });
  return tokenResponse.token;
}
