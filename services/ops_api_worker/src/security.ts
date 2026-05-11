import type { Env } from "./env";
import { HttpError } from "./errors";

const ALLOWED_ORIGINS = new Set([
  "https://ops.oaslananka.dev",
  "https://chatgpt.com"
]);

export function randomId(prefix = "ops"): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  const value = [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
  return `${prefix}_${value}`;
}

export function corsHeaders(request: Request, env: Env): HeadersInit {
  const origin = request.headers.get("origin") || "";
  const appOrigin = env.OPS_APP_PUBLIC_BASE_URL;
  const allowed = ALLOWED_ORIGINS.has(origin) || origin === appOrigin;
  if (!allowed) return {};
  return {
    "access-control-allow-origin": origin,
    "access-control-allow-credentials": "true",
    "access-control-allow-methods": "GET,POST,OPTIONS",
    "access-control-allow-headers": "content-type,x-csrf-token"
  };
}

export function preflight(request: Request, env: Env): Response {
  return new Response(null, {
    status: 204,
    headers: corsHeaders(request, env)
  });
}

export function assertJson(request: Request): void {
  const contentType = request.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) {
    throw new HttpError(415, "UNSUPPORTED_MEDIA_TYPE", "Expected application/json request body.");
  }
}

export function escapePathSegment(value: string): string {
  if (!/^[A-Za-z0-9_.-]+$/.test(value)) {
    throw new HttpError(400, "INVALID_PATH_SEGMENT", "Path segment contains unsupported characters.");
  }
  return value;
}
