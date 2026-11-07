---
name: release
description: Cut and verify an opencode-summary release (release-please PR, GitHub Release, npm publish via trusted publishing) and fix a failed one. Use when the user asks to release, publish, ship, cut a version, merge the release PR, or when a release or npm publish fails.
---

# Release opencode-summary

Releases are automated. Never bump `package.json`, `.release-please-manifest.json` or `CHANGELOG.md` by hand, and never run `npm publish` locally.

Flow: conventional commits on `main` -> release-please opens a release PR -> merge it -> the same workflow (`.github/workflows/release-please.yml`) tags `vX.Y.Z`, creates the GitHub Release, then the `publish` job publishes to npm over OIDC.

## Cut a release

1. Check state: `git status`, on `main`, up to date with `origin/main`, and `gh run list -L 3` shows CI green.
2. Find the release PR: `gh pr list --search "release"`. If none exists, nothing releasable has landed: only `feat`, `fix` and `perf` (or a `!` breaking marker) trigger a release; `docs`, `ci`, `chore`, `test`, `refactor` do not.
3. Read the PR: proposed version and changelog (`gh pr view <n>`). While the version is `0.x`, `feat` bumps minor and `fix` bumps patch.
4. **Ask the user to confirm** the version, then `gh pr merge <n> --squash`.
5. Watch the run: `gh run list -L 3`, then `gh run view <id>`. The `publish` job needs about a minute.
6. Verify (npm may lag a few minutes: "being processed"):
   - `gh release list` shows `vX.Y.Z` (plain `v` prefix, no component name)
   - `npm view opencode-summary dist-tags.latest --prefer-online` equals the new version
   - `npm view opencode-summary@X.Y.Z dist.attestations` shows provenance
7. Tell the user to run `opencode plugin update opencode-summary` and restart opencode.

## Force a specific version

Push an empty commit to `main` (release-please then updates the PR):

```
git commit --allow-empty -m "chore: release 0.2.0" -m "Release-As: 0.2.0"
```

## Before merging code that changes the TUI

`dist/tui.js` is shipped in the npm package (opencode cannot compile `.tsx` inside `node_modules`) but is not committed. CI and the publish job build it with `bun run build`; nothing to commit.

## When it fails

- `publish` job, `403 ... OIDC permission denied`: npm trusted publisher mismatch. On npmjs.com the config must be GitHub Actions, owner `frostehhh`, repo `opencode-summary`, workflow `release-please.yml`, environment blank, and the allowed actions must include `npm publish` (stage-only rejects it). After fixing it, re-run only the failed job: `gh run rerun <run-id> --failed`. The tag and release stay as they are.
- Wrong version or tag name: check `release-please-config.json` (`include-component-in-tag` is `false`, `include-v-in-tag` is `true`) and use `Release-As`.
- Release PR missing after a `feat`/`fix`: re-run the release-please run, and check Settings -> Actions allows creating pull requests.

Do not unpublish or delete a release without asking: npm never lets a version number be reused.
