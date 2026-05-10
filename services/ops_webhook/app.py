from __future__ import annotations

import base64
import hashlib
import hmac
import logging
import os
import re
from typing import Any

import httpx
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse

LOGGER = logging.getLogger("ops_webhook")
logging.basicConfig(level=os.getenv("LOG_LEVEL", "INFO"))

app = FastAPI(title="ops-webhook")

OPS_REPO = os.getenv("OPS_REPO", "oaslananka-lab/_ops")
PERSONAL_OWNER = os.getenv("PERSONAL_OWNER", "oaslananka")
ORG_OWNER = os.getenv("ORG_OWNER", "oaslananka-lab")
ROUTED_OWNERS = {PERSONAL_OWNER, ORG_OWNER}
IGNORED_ORG_REPOS = {
    repo.strip()
    for repo in os.getenv("IGNORED_ORG_REPOS", "_ops").split(",")
    if repo.strip()
}
API_VERSION = os.getenv("GITHUB_API_VERSION", "2026-03-10")
CHECK_RUN_WORKFLOW = os.getenv("CHECK_RUN_WORKFLOW", "agent-fix-loop.yml")

PR_ACTIONS = {"opened", "synchronize", "reopened", "closed"}
CHECK_RUN_FAILURES = {"failure", "timed_out"}

SUGGEST_POLICY: dict[str, Any] = {
    "autonomy": {"enabled": True, "profile": "suggest"},
    "agent": {"patch": False, "patch_mode_on_check_run_failure": "suggest", "max_iterations": 3},
    "pr": {"finalize": False, "merge": False},
    "release": {"enabled": False, "trigger_after_merge": False},
    "publish": {"enabled": False},
}


def _json(status: str, **payload: Any) -> JSONResponse:
    return JSONResponse({"status": status, **payload}, status_code=200)


def _signature_is_valid(signature: str, body: bytes) -> bool:
    secret = os.getenv("WEBHOOK_SECRET", "")
    if not secret or not signature.startswith("sha256="):
        return False

    expected = "sha256=" + hmac.new(
        secret.encode("utf-8"),
        body,
        hashlib.sha256,
    ).hexdigest()

    return hmac.compare_digest(signature, expected)


async def dispatch(workflow: str, inputs: dict[str, str]) -> dict[str, Any]:
    token = os.getenv("GITHUB_TOKEN", "")
    if not token:
        return {"ok": False, "error": "GITHUB_TOKEN is not configured"}

    url = f"https://api.github.com/repos/{OPS_REPO}/actions/workflows/{workflow}/dispatches"
    headers = {
        "Authorization": f"Bearer {token}",
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": API_VERSION,
    }

    async with httpx.AsyncClient(timeout=20) as client:
        response = await client.post(
            url,
            headers=headers,
            json={"ref": "main", "inputs": inputs},
        )

    result = {
        "ok": response.status_code in {204, 201, 200},
        "workflow": workflow,
        "status_code": response.status_code,
    }
    if not result["ok"]:
        result["error"] = response.text[:1000]
    return result


async def github_get(path: str) -> dict[str, Any] | None:
    token = os.getenv("GITHUB_TOKEN", "")
    if not token:
        return None

    url = f"https://api.github.com/{path.lstrip('/')}"
    headers = {
        "Authorization": f"Bearer {token}",
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": API_VERSION,
    }

    async with httpx.AsyncClient(timeout=20) as client:
        response = await client.get(url, headers=headers)

    if response.status_code != 200:
        LOGGER.warning("GitHub GET %s returned %s", path, response.status_code)
        return None
    return response.json()


def _strip_inline_comment(value: str) -> str:
    quote = None
    for index, char in enumerate(value):
        if char in {"'", '"'} and (index == 0 or value[index - 1] != "\\"):
            quote = None if quote == char else quote or char
        if char == "#" and quote is None and (index == 0 or value[index - 1].isspace()):
            return value[:index].rstrip()
    return value.rstrip()


def _parse_scalar(raw: str) -> Any:
    value = _strip_inline_comment(raw).strip()
    if value == "true":
        return True
    if value == "false":
        return False
    if value == "null":
        return None
    if re.fullmatch(r"-?\d+", value):
        return int(value)
    if (value.startswith('"') and value.endswith('"')) or (value.startswith("'") and value.endswith("'")):
        return value[1:-1]
    return value


def _parse_simple_yaml(text: str) -> dict[str, Any]:
    root: dict[str, Any] = {}
    stack: list[tuple[int, dict[str, Any]]] = [(-1, root)]
    for line_number, raw_line in enumerate(text.replace("\r\n", "\n").split("\n"), start=1):
        if not raw_line.strip() or raw_line.lstrip().startswith("#"):
            continue
        indent = len(raw_line) - len(raw_line.lstrip(" "))
        if indent % 2:
            raise ValueError(f"invalid indentation at line {line_number}")
        line = raw_line.strip()
        if ":" not in line:
            raise ValueError(f"invalid mapping at line {line_number}")
        key, rest = line.split(":", 1)
        key = key.strip()
        while len(stack) > 1 and indent <= stack[-1][0]:
            stack.pop()
        parent = stack[-1][1]
        if rest.strip() == "":
            parent[key] = {}
            stack.append((indent, parent[key]))
        else:
            parent[key] = _parse_scalar(rest)
    return root


def _deep_merge(base: dict[str, Any], override: dict[str, Any]) -> dict[str, Any]:
    merged: dict[str, Any] = dict(base)
    for key, value in override.items():
        if key == "extends":
            merged[key] = value
        elif isinstance(value, dict) and isinstance(merged.get(key), dict):
            merged[key] = _deep_merge(merged[key], value)
        else:
            merged[key] = value
    return merged


async def get_ops_file(path: str) -> dict[str, Any] | None:
    owner_repo = OPS_REPO.split("/", 1)
    if len(owner_repo) != 2:
        return None
    owner, repo = owner_repo
    data = await github_get(f"repos/{owner}/{repo}/contents/{path}?ref=main")
    if not data or "content" not in data:
        return None
    try:
        content = base64.b64decode(data["content"]).decode("utf-8")
    except Exception as exc:  # noqa: BLE001
        LOGGER.warning("failed to decode ops file %s: %s", path, exc)
        return None
    return {"path": path, "content": content}


async def get_effective_policy(owner: str, repo: str) -> dict[str, Any]:
    try:
        default_file = await get_ops_file("config/repo-autonomy.default.yml")
        if not default_file:
            return SUGGEST_POLICY
        policy = _parse_simple_yaml(default_file["content"])
        override_file = await get_ops_file(f"config/repos/{owner}/{repo}.yml")
        if override_file:
            policy = _deep_merge(policy, _parse_simple_yaml(override_file["content"]))
        return policy
    except Exception as exc:  # noqa: BLE001
        LOGGER.warning("failed to resolve policy for %s/%s: %s", owner, repo, exc)
        return SUGGEST_POLICY


def _policy_patch_mode(policy: dict[str, Any]) -> str:
    autonomy = policy.get("autonomy") or {}
    agent = policy.get("agent") or {}
    if autonomy.get("enabled") is False:
        return "ignore"
    profile = autonomy.get("profile", "suggest")
    if profile == "off":
        return "ignore"
    if profile == "suggest" or agent.get("patch") is False:
        return "suggest"
    if profile in {"patch", "guarded", "full", "breakglass"}:
        return "patch"
    return "suggest"


def _repository_identity(payload: dict[str, Any]) -> tuple[str, str, str]:
    repository = payload.get("repository") or {}
    owner = (repository.get("owner") or {}).get("login") or ""
    repo = repository.get("name") or ""
    default_branch = repository.get("default_branch") or "main"
    return owner, repo, default_branch


def _comment_should_dispatch(body: str) -> bool:
    return "@oaslananka-repo-ops" in body or re.search(r"(^|\s)/ops(\s|$)", body, re.IGNORECASE) is not None


async def _route_event(event: str, payload: dict[str, Any]) -> dict[str, Any]:
    owner, repo, default_branch = _repository_identity(payload)

    if owner not in ROUTED_OWNERS:
        return {"handled": False, "reason": "owner not routed", "owner": owner}

    if owner == ORG_OWNER and repo in IGNORED_ORG_REPOS:
        return {"handled": False, "reason": "org repo ignored", "owner": owner, "repo": repo}

    action = payload.get("action") or ""

    if event == "check_run" and action == "completed":
        check_run = payload.get("check_run") or {}
        conclusion = check_run.get("conclusion") or ""
        if conclusion in CHECK_RUN_FAILURES:
            for pr in check_run.get("pull_requests") or []:
                pr_num = pr.get("number")
                if pr_num:
                    pr_state = await github_get(f"repos/{owner}/{repo}/pulls/{pr_num}")
                    if not pr_state:
                        return {"handled": False, "reason": "pull request state unavailable", "owner": owner, "repo": repo}
                    if pr_state.get("state") != "open":
                        return {
                            "handled": False,
                            "reason": "pull request is not open",
                            "owner": owner,
                            "repo": repo,
                            "pr_number": str(pr_num),
                        }
                    policy = await get_effective_policy(owner, repo)
                    patch_mode = _policy_patch_mode(policy)
                    if patch_mode == "ignore":
                        return {"handled": False, "reason": "policy disables check_run automation", "owner": owner, "repo": repo}
                    max_iterations = str((policy.get("agent") or {}).get("max_iterations", 3))
                    inputs = {
                        "target_owner": owner,
                        "target_repo": repo,
                        "pr_number": str(pr_num),
                    }
                    if CHECK_RUN_WORKFLOW == "agent-fix-loop.yml":
                        inputs.update({"max_iterations": max_iterations, "patch_mode": patch_mode})
                    return await dispatch(
                        CHECK_RUN_WORKFLOW,
                        inputs,
                    )
        return {"handled": False, "reason": "check_run not actionable", "conclusion": conclusion}

    if event == "pull_request" and action == "closed":
        pr = payload.get("pull_request") or {}
        if pr.get("merged") is True:
            policy = await get_effective_policy(owner, repo)
            release = policy.get("release") or {}
            if release.get("enabled") is True and release.get("trigger_after_merge") is True:
                return await dispatch(
                    "ops-release-orchestrator.yml",
                    {
                        "target_owner": owner,
                        "target_repo": repo,
                        "source_pr": str(pr.get("number", "")),
                        "merge_commit_sha": str((pr.get("merge_commit_sha") or "")),
                        "requested_action": "release",
                        "dry_run": "false",
                    },
                )
            return {"handled": False, "reason": "release disabled by policy after merge", "owner": owner, "repo": repo}
        return {"handled": False, "reason": "pull request closed without merge", "owner": owner, "repo": repo}

    if event == "pull_request" and action in PR_ACTIONS:
        pr = payload.get("pull_request") or {}
        return await dispatch(
            "agent-pr-diagnostics.yml",
            {
                "target_owner": owner,
                "target_repo": repo,
                "pr_number": str(pr.get("number", "")),
            },
        )

    if event == "issues" and action == "opened":
        issue = payload.get("issue") or {}
        return await dispatch(
            "inbox-handler.yml",
            {
                "target_owner": owner,
                "target_repo": repo,
                "issue_number": str(issue.get("number", "")),
                "event_type": "issue",
            },
        )

    if event == "push" and payload.get("ref") == f"refs/heads/{default_branch}" and owner == PERSONAL_OWNER:
        return await dispatch(
            "repo-mirror-sync.yml",
            {
                "source_owner": owner,
                "source_repo": repo,
                "target_owner": ORG_OWNER,
                "target_repo": repo,
            },
        )
    if event == "push" and payload.get("ref") == f"refs/heads/{default_branch}" and owner == ORG_OWNER:
        return {"handled": False, "reason": "org default-branch push is not mirrored"}

    if event == "issue_comment" and action == "created":
        comment = payload.get("comment") or {}
        body = comment.get("body") or ""
        if not _comment_should_dispatch(body):
            return {"handled": False, "reason": "comment does not mention app or /ops command"}

        issue = payload.get("issue") or {}
        return await dispatch(
            "inbox-handler.yml",
            {
                "target_owner": owner,
                "target_repo": repo,
                "issue_number": str(issue.get("number", "")),
                "event_type": "comment",
            },
        )

    return {"handled": False, "reason": "unrecognized event or action", "event": event, "action": action}


@app.post("/webhook")
async def webhook(request: Request) -> JSONResponse:
    body = await request.body()
    signature = request.headers.get("x-hub-signature-256", "")

    if not _signature_is_valid(signature, body):
        return JSONResponse({"status": "unauthorized"}, status_code=401)

    event = request.headers.get("x-github-event", "")

    try:
        payload = await request.json()
    except Exception as exc:  # noqa: BLE001
        LOGGER.warning("valid signature with invalid JSON: %s", exc)
        return _json("ignored", reason="invalid json")

    try:
        result = await _route_event(event, payload)
    except Exception as exc:  # noqa: BLE001
        LOGGER.exception("webhook dispatch failed")
        return _json("dispatch_error", event=event, error=str(exc))

    LOGGER.info("event=%s result=%s", event, result)
    if result.get("ok"):
        return _json("dispatched", event=event, workflow=result.get("workflow"))
    return _json("ignored" if result.get("handled") is False else "dispatch_error", event=event, result=result)


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/")
@app.head("/")
async def root() -> dict[str, str]:
    return {"status": "ok"}
