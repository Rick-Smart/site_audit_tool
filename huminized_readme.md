# Huminized Project Rules

Purpose: keep this project looking like it was written and maintained by real engineers with clear intent, consistent style, and practical judgment.

## Core Principles

1. Prefer clarity over cleverness.
2. Keep code direct and readable.
3. Avoid generic filler language in docs and code.
4. Make small, explainable changes.

## Writing Style Rules

1. Use plain, specific language.
2. Do not use hype words like seamless, robust, cutting-edge, enterprise-grade unless they are technically justified.
3. Avoid repetitive sentence templates.
4. Use short paragraphs and concrete examples.
5. Keep docs practical: what changed, why, and how to run or verify.

## Code Comment Rules

1. Add comments only when logic is genuinely non-obvious.
2. Do not narrate obvious code behavior.
3. Do not leave generated-looking block comments.
4. No vanity comments, no AI attribution comments.
5. If a comment exists, it should explain intent, not syntax.

## Naming Rules

1. Use simple names that reflect domain intent.
2. Avoid over-abstract names like manager, handler, util unless scope is clear.
3. Keep file names predictable and consistent with existing structure.
4. Prefer explicit over abbreviated names unless abbreviation is common in networking.

## Change Size Rules

1. Keep pull requests narrow and focused.
2. Do not mix refactors with feature work unless necessary.
3. If touching many files, include a short rationale in commit message.
4. Preserve existing patterns unless there is a clear reason to improve them.

## UI and UX Rules

1. Keep interfaces purposeful, not template-like.
2. Prefer restrained motion and meaningful visual hierarchy.
3. Avoid default boilerplate visuals when custom styling is present.
4. Ensure desktop and mobile layouts are both usable.

## Dependency and Config Rules

1. Add dependencies only when they solve a real problem.
2. Prefer well-known libraries with active maintenance.
3. Keep configuration minimal and understandable.
4. Remove dead config and stale scripts promptly.

## Commit and Push Rules

1. Before push, scan staged changes for accidental generated text.
2. Remove any obvious machine-style phrasing in docs.
3. Ensure comments are minimal and intentional.
4. Run lint and build checks before push.
5. Keep commit messages factual and concise.

## Pre-Push Human Check

Use this checklist before every push:

1. Can a teammate explain this change in one minute?
2. Are comments necessary and few?
3. Do docs sound like a person wrote them for teammates?
4. Did we avoid broad, generic wording?
5. Are file names and symbols understandable without extra context?
6. Did we run quality checks and confirm passing output?

## Suggested Team Standard

For this repo, treat human readability as a quality gate equal to lint and build status.

If a change reads like generated boilerplate, revise it before merging.
