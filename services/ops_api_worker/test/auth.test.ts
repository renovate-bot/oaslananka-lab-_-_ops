import { describe, expect, it } from "vitest";
import { allowedLogins, type Env } from "../src/env";
import { createSession, readSession } from "../src/auth/session";

class MemoryKv {
  private readonly values = new Map<string, string>();
  async get(key: string): Promise<string | null> {
    return this.values.get(key) ?? null;
  }
  async put(key: string, value: string): Promise<void> {
    this.values.set(key, value);
  }
  async delete(key: string): Promise<void> {
    this.values.delete(key);
  }
}

function env(): Env {
  const kv = new MemoryKv() as unknown as KVNamespace;
  return {
    OAUTH_STATE: kv,
    OPS_SESSIONS: kv,
    OPS_REPO: "oaslananka-lab/_ops",
    OPS_API_PUBLIC_BASE_URL: "https://ops-api.oaslananka.dev",
    OPS_APP_PUBLIC_BASE_URL: "https://ops.oaslananka.dev",
    ALLOWED_GITHUB_LOGINS: "oaslananka",
    GITHUB_OAUTH_CALLBACK_URL: "https://ops-api.oaslananka.dev/oauth/github/callback",
    SESSION_SECRET: "test-secret"
  };
}

describe("auth sessions", () => {
  it("normalizes allowed GitHub logins", () => {
    expect([...allowedLogins(env())]).toEqual(["oaslananka"]);
  });

  it("creates and reads an allowed session", async () => {
    const testEnv = env();
    const { cookie } = await createSession(testEnv, "oaslananka", 169144131);
    const request = new Request("https://ops-api.oaslananka.dev/v1/me", {
      headers: { cookie }
    });
    await expect(readSession(testEnv, request)).resolves.toMatchObject({
      login: "oaslananka",
      github_id: 169144131
    });
  });
});
