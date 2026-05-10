# Agentic Workflows

Active GitHub Agentic Workflows are stored in `.github/workflows/*.md` and compiled to `.github/workflows/*.lock.yml`.

This directory is kept as the operator-facing index for the current agentic workflow set:

```text
.github/workflows/pr-fix.md
.github/workflows/issue-triage.md
.github/workflows/ci-doctor.md
```

GitHub Actions only discovers workflow files under `.github/workflows`, so the runnable source files live there.
