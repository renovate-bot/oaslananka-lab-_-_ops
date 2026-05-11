import { HttpError } from "../errors";

const GITHUB_API = "https://api.github.com";

export async function githubRequest<T>(
  token: string,
  path: string,
  init: RequestInit = {}
): Promise<T> {
  const response = await fetch(`${GITHUB_API}${path}`, {
    ...init,
    headers: {
      accept: "application/vnd.github+json",
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
      "user-agent": "oaslananka-ops-api",
      "x-github-api-version": "2026-03-10",
      ...(init.headers || {})
    }
  });
  if (!response.ok) {
    const text = await response.text();
    throw new HttpError(response.status, "GITHUB_API_FAILED", `GitHub API request failed: ${path}`, {
      status: response.status,
      response: text.slice(0, 500)
    });
  }
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

export async function githubContents(token: string, owner: string, repo: string, path: string): Promise<string | null> {
  const encoded = path.split("/").map(encodeURIComponent).join("/");
  try {
    const payload = await githubRequest<{ content?: string; encoding?: string }>(
      token,
      `/repos/${owner}/${repo}/contents/${encoded}?ref=main`
    );
    if (!payload.content || payload.encoding !== "base64") return null;
    return atob(payload.content.replace(/\n/g, ""));
  } catch (error) {
    if (error instanceof HttpError && error.status === 404) return null;
    throw error;
  }
}
