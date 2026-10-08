---
name: release
description: Guide a release of SFU MyProfessor to the Chrome Web Store — version bump, tag push, and the GitHub Actions upload. Also covers re-creating the store credentials when they stop working. Use when the user asks to release, publish, ship, or bump the version.
---

# Releasing to the Chrome Web Store

Pushing a `v*` tag runs `.github/workflows/release.yml`: it checks the tag matches
`package.json`, runs tests and typecheck, builds the zip, and runs `wxt submit`, which uploads
it and submits it for review. Google review (hours to a few days) still gates what users get.

Walk the user through these steps. Run the read-only checks yourself; let the user run the
commands that publish (`git push --follow-tags`), or run them only after they say to.

## 1. Pre-flight

```bash
git switch main && git pull origin main
git status -s                      # tracked changes must be committed; npm version refuses otherwise
npm test && npm run typecheck && npm run build
git tag --sort=-v:refname | head   # last released version
gh secret list                     # expect the four CHROME_* secrets below
```

- Untracked files don't block `npm version`, but they won't be in the release. Ask about any
  that look like they belong (assets in `src/public/`, etc.).
- Summarize what's changed since the last tag (`git log --oneline <last-tag>..HEAD`) so the user
  can pick the bump and write the store's "what's new" if they want.

## 2. Pick the version

- `patch` (1.4.0 → 1.4.1): fixes only
- `minor` (1.4.0 → 1.5.0): new features
- `major`: breaking or big redesigns

The store rejects a version that isn't higher than the published one; `npm version` handles that.

## 3. Release

```bash
npm version <patch|minor|major>   # bumps package.json + lock, commits "x.y.z", tags vx.y.z
git push --follow-tags            # pushes commit and tag → triggers the Release workflow
gh run watch                      # or: gh run list --workflow release.yml
```

Success: the run's `wxt submit` step ends with `✔ Chrome Web Store`, and the item shows
"Pending review" in the [developer dashboard](https://chrome.google.com/webstore/devconsole).

If the user changed permissions in `wxt.config.ts`, warn them review may take longer. Store
listing text and screenshots are edited in the dashboard, not here.

## Troubleshooting

| Failure | Fix |
|---|---|
| "Tag vX does not match package.json version" | Tag was made by hand. Delete it (`git tag -d vX && git push origin :refs/tags/vX`) and use `npm version`. |
| Tests/typecheck fail in the workflow | Fix on a branch, merge, then release a new patch version (don't move an existing tag). |
| `invalid_grant` / token errors in `wxt submit` | Refresh token expired or revoked; redo **Credentials** below and update the secrets. |
| Upload rejected: version not higher | That version is already uploaded; bump again. |
| Upload rejected: item in review | A previous submission is still pending; wait, or cancel it in the dashboard. |

To retry a failed run without a new version: `gh run rerun <run-id>`.

## Credentials (one-time, or when they expire)

Four repo secrets: `CHROME_EXTENSION_ID`, `CHROME_CLIENT_ID`, `CHROME_CLIENT_SECRET`,
`CHROME_REFRESH_TOKEN`. Locally they live in `.env.submit` (git-ignored via `.env.*`; never
commit it or paste its values into chat).

Don't use `npx publish-extension init` for the token: it uses Google's blocked OOB flow.
(`wxt submit init` doesn't exist either.) Instead, in Google Cloud project `sfu-my-professor`:

1. **Chrome Web Store API** enabled (APIs & Services → Library).
2. **Google Auth Platform → Branding**: app name, support email, home page
   (`https://github.com/aaf1007/SFU-MyProfessor`), privacy policy link. No logo — a logo forces
   verification.
3. **Audience**: External, **Publish app** (In production). In "Testing" the refresh token
   expires after 7 days.
4. **Credentials → Create credentials → OAuth client ID**: type **Web application** (not
   "Chrome extension"), redirect URI `https://developers.google.com/oauthplayground`. Save the
   client ID and secret (download the JSON).
5. [OAuth Playground](https://developers.google.com/oauthplayground): gear → "Use your own
   OAuth credentials" → paste ID/secret; scope `https://www.googleapis.com/auth/chromewebstore`;
   Authorize with the account that owns the store item (click through "unverified app");
   "Exchange authorization code for tokens" → copy the refresh token.
6. Write `.env.submit` (`CHROME_EXTENSION_ID=agcnjhkelnjokbchcjkldkphdkdclonp` plus the other
   three), then verify and upload:

```bash
npm run zip
npx wxt submit --dry-run --chrome-zip .output/sfu-myprofessor-$(node -p "require('./package.json').version")-chrome.zip
gh secret set -f .env.submit
```

Pass the exact zip path — `.output/*-chrome.zip` also matches old versions' zips and fails with
"Unused args". A passing dry run prints `Getting an access token` then `✔ Chrome Web Store`.
