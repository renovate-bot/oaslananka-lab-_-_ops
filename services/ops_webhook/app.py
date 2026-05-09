from __future__ import annotations

import hashlib
import hmac
import logging
import os
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
API_VERSION = os.getenv("GITHUB_API_VERSION", "2026-03-10")

PR_ACTIONS = {"opened", "synchronize", "reopened", "closed"}


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


def _repository_identity(payload: dict[str, Any]) -> tuple[str, str, str]:
    repository = payload.get("repository") or {}
    owner = (repository.get("owner") or {}).get("login") or ""
    repo = repository.get("name") or ""
    default_branch = repository.get("default_branch") or "main"
    return owner, repo, default_branch


async def _route_event(event: str, payload: dict[str, Any]) -> dict[str, Any]:
    owner, repo, default_branch = _repository_identity(payload)

    if owner != PERSONAL_OWNER:
        return {"handled": False, "reason": "not personal repo", "owner": owner}

    action = payload.get("action") or ""

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

    if event == "push" and payload.get("ref") == f"refs/heads/{default_branch}":
        return await dispatch(
            "repo-mirror-sync.yml",
            {
                "source_owner": owner,
                "source_repo": repo,
                "target_owner": ORG_OWNER,
                "target_repo": repo,
            },
        )

    if event == "issue_comment" and action == "created":
        comment = payload.get("comment") or {}
        body = comment.get("body") or ""
        if "@oaslananka-repo-ops" not in body:
            return {"handled": False, "reason": "comment does not mention app"}

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
