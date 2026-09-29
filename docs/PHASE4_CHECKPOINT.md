# Phase 4 checkpoint — 2026-09-29

Stopped at the user's quota safeguard: account reports 99% weekly usage, 1% remaining. No new source-ingestion implementation was started.

## Saved implementation

- Manual Movie Entry implementation commit: `c614fc46ff4b286874dc0f97f60f78f5060cfaaf`, pushed to origin/main.
- Phase 4 baseline: `c333a3d844d45a52be3787388b939d18376d4836`.
- Manual entry button and TMDB-failure fallback are deployed in `/opt/hdqaz-bot` on 2.29.49.20. 17 focused bot tests passed locally and inside the production Docker image.
- Bot was verified healthy, one instance, five hours uptime. Existing Phase 3 worker remains deployed separately under `/opt/hdqaz-worker`.
- Known Vercel Ready baseline deployment: `HbQVifiHAFDNuhRgrM1PaYHr9dcL`. New pushes may trigger automatic deployment; their final Vercel state has not been reverified. These changes require only the bot deployment, not backend changes.
- Phase 4 additive migration `202609290001_telegram_workflow.sql` was already applied. Do not rerun it. Eight existing catalog/processing table snapshots were unchanged immediately after application.
- Secrets remain in protected server/Vercel configuration. No rotation or credential disclosure.

## Production evidence

Synthetic workflow `2362c4e9-6311-400a-a7b6-50f5e2da9901`, content `29aafafa-fc05-4d14-9d82-c0c0cf9288f7`, job `acdebee6-1fbe-456c-8c63-bbe06456acfa`.

Final live check: workflow `rejected`, job `ready`, progress `100`. It must stay unpublished. No synthetic content was published by this work. The manual API/source-handoff route reached the existing production worker successfully. Explicit publication was covered by earlier database tests; a real production movie publication has not been verified.

Earlier Phase 4 validation: 99 tests and TypeScript/Next build passed. This minimal bot change: 17 focused tests passed; no broad suites rerun. The attempted additional publication checks in the preceding turn were blocked by quota review and must not be reported as newly passed.

## Current user flow and blockers

`/start` → Movie → Manual entry → `/edit title=...`, `/edit year=2026`, `/edit description=...` → `/source UUID` → processing confirmation → Queue/Refresh → Ready/review → explicit Publish.

Manual fields also include country, duration_minutes, comma-separated genres, premium, dubber, poster/banner URLs (existing backend TMDB image allowlist remains enforced).

**The requested no-SSH/no-UUID ingestion is NOT implemented.** Sources still require immutable operator-staged files under `/opt/hdqaz-worker/runtime/sources/inbox/<UUID>.media`. Do not claim this is the final practical movie MVP. TMDB search through Vercel previously returned 502; server-side TMDB access returned 200. TMDB is optional now.

Series, channel posting, REMAKE and further Phase 4 work are deferred. Ready never auto-publishes. Channel posting remains disabled.

## Exact next step

Implement only a safe movie source registration path from Telegram, reusing `Sources` and the Phase 3 source-provider boundary. Decide on the smallest supported direct-download/source contract before coding. Keep large media download in the worker/source provider, not Vercel or bot polling. Validate URL/redirect destinations against SSRF/private-network access, stream with size/time limits, sanitize errors, bind the registered source to its workflow/job, and preserve authenticated ownership and confirmation. A forwarded Telegram message is not automatically a downloadable large-file source: confirm the actual Bot API limits/access before promising support. Keep `/source UUID` compatibility for recovery.

Add focused source security/ownership/handoff tests, deploy minimally, and run one isolated unpublished job to Ready if quota allows. Never publish the synthetic fixture. Have the user review and explicitly publish their own first real movie, then verify its site page/player.

Temporary Phase 4 SSH access is being removed at this checkpoint; resume requires authorized access again. Do not recreate or rotate permanent credentials. Existing production services keep running without this key.
