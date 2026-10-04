# HD Qaz checkpoint — 2026-10-04

## Telegram Movie UX update

Code commit: `82ec8f21cd9c35c4402b0880db80fc2c3b5de3f0` (pushed to `origin/main`). This adds the compact single-message Queue with inline movie selection and refresh, an easy TMDB-first Movie menu with inline search results and Manual Entry fallback, and a clean metadata review card. Queue/detail/menu/metadata/video prompts reuse and edit the saved Telegram message. UUIDs, source refs and job IDs stay out of visible Movie/Queue text. Selecting either “Дұрыс” or “Видео қосу” advances to the existing upload flow; processing and explicit Publish behavior are unchanged.

Validation: 41 focused bot tests passed locally, including TMDB search/selection/fallback, queue refresh/edit behavior, and the existing Telegram file-to-Phase-3 handoff regression. `git diff --check` passed. No broad suites were run.

Production deployment completed on `2.29.49.20`: only `hdqaz-bot-bot-1` was rebuilt/replaced; the Local Telegram API and Phase 3 worker were left untouched. The running bot image is `sha256:ad5ad9b2934a697800ca9f1b26afbbd9e9d6764ce5d78a4e5ccda6bfcd72e22b`; health is `healthy`, restart count is 0, and restart policy remains `unless-stopped`. Exactly one bot and one Telegram API service are running. Focused tests were also run inside the production image: 41 passed.

Read-only live smoke checks passed for Telegram `getMe` and the Admin Queue endpoint. Production TMDB search returned an unavailable response during this check; the bot's one-screen Manual Entry fallback is covered by the passing focused tests and remains the path to use when TMDB is unavailable. No test or real movie was published. The temporary SSH public key used for this deployment was removed from the server and its local keypair was deleted. No server secrets were read or changed.

## Working production movie MVP

Implementation commit: `89761a32761910b8974edc1ed6c4b82a82edec3e` (pushed to origin/main). Previous checkpoints c614fc4 and a2769bc are historical; do not redo Phase 1–3 or the completed Phase 4 migration.

The real Telegram path was verified: whitelisted admin → Movie → conversational Manual Entry → Video button → forwarded 4-second synthetic movie → local Telegram Bot API download → automatic immutable source registration → existing Sources.stage/Phase 2 create+activate → existing Phase 3 MountedSource/worker → R2/CDN → Ready 100.

Test workflow: `bf016618-d83e-4cb0-b81f-205d7d3f446c`
Test content: `738a93ce-4df3-4a3f-a627-ac701519e5ca`
Test job: `cfb7e251-46c5-412f-8586-31244fcc45b2`

Verified workflow submitted, job ready, progress 100, no error. Content is_published=false, hls_url=null; no publication audit exists. CDN master, variant and media segment returned HTTP 200. **Do not publish this synthetic fixture.** Ready is not publication. Existing explicit human Publish logic is unchanged and covered by earlier database tests; no real production title was published or its site playback newly tested in this session.

## Deployed state

Server 2.29.49.20:
- `/opt/hdqaz-bot`: one healthy bot, local Telegram API, persistent conversation state.
- Local API built from official tdlib/telegram-bot-api commit e3e9dd8e5b3d7ab8537cd5a10dc31d5ffa8f82d1, private Docker network, no published host ports.
- Use `docker compose -f compose.yaml -f compose.local-api.yaml` for management. Cloud bot was logged out before local polling started. Do not run cloud and local pollers together.
- Bot image sha256:6efc0557f6d3557fba843d4be4ec02cbd103153b4fabdce2483648ecafd3396b.
- API image sha256:6a4979c86c828fd9fbc34ef9bb9716348537cdf6bd70c7b3ebb7a33be33cf2a2.
- Bot/API restart policy unless-stopped; Docker enabled at boot. Bot remained healthy after the final container replacement. No server reboot performed in this session.
- `/opt/hdqaz-worker`: exactly one existing worker, running uninterrupted for five days at final check.
- Credentials stay separate and private. API config `/opt/hdqaz-bot/telegram-api.env` mode 600. Secrets never printed or committed.
- Temporary compilation swap removed. Temporary ingestion SSH key removed from authorized_keys and local private/public files removed. Further operator work needs newly authorized access.

No new database migration or backend/Vercel configuration was needed. `202609290001_telegram_workflow.sql` is already applied: do not rerun it. Git pushes may trigger normal Vercel CI; new Vercel deployment IDs were not needed or verified for these bot-only changes.

## Normal Movie UI

Movie offers TMDB search first and Manual Entry as fallback. Manual Entry asks one question at a time: title, year, description, country, comma-separated genres, duration, Premium buttons. Optional dubber defaults unset. The clean summary has confirm, Edit, Video and Cancel buttons. Normal movie cards hide `/edit`, `/source UUID`, source/job IDs, raw workflow/error codes and developer instructions. Review link is a button; explicit Publish remains separate. Technical commands remain emergency operator fallbacks only. Queue is one compact screen; selecting a row and refreshing edit that same message.

Send/forward MP4/MOV/MKV/WebM after pressing Video. No SSH, manual Hetzner upload or UUID is needed for normal ingestion. Bot performs no transcoding; it copies completed API files in 1 MiB chunks with size/header/path/symlink/disk checks, partial cleanup, fsync and atomic publication. Existing worker validates and processes media.

## Validation and limits

41 focused Python tests passed locally and inside the production Docker image for the current UX; `git diff --check` passed. No broad suites rerun. Earlier Phase 4 baseline tests/TypeScript/build remain documented in history; no TypeScript changed here.

Actual Telegram test used a short clip, not a multi-GB movie. Local API removes cloud's 20 MB download limit; user Telegram upload limits still apply. Default source maximum is 8 GiB, subject to free disk (three source copies plus reserve). API cache and source retention need operator disk management as usage grows. During a large local download, bot commands are serialized and handled afterward; acceptance/downloading is shown first and job progress after activation is available by Queue/Refresh. No live download percentage is promised.

## First real movie

1. Open @hdqaz_bot and press Movie. Search by title with TMDB; if unavailable or no match, choose Manual Entry.
2. Select a match or answer the manual questions, review the summary, then press Video.
3. Send/forward your actual movie file to this chat.
4. Wait; Queue/Refresh shows processing and Ready.
5. Review the output. Only for your own real reviewed movie, press explicit Publish.

Current ingestion+clean UI milestone is complete. Do not add Series, channel posting, REMAKE or unrelated work without a new task. Remaining unverified milestone: user's first real full-length movie and explicit publication/site playback. Preserve the synthetic fixture unpublished.

## Telegram responsiveness incident — 2026-10-04

Fix commit `d392488` (`Run Telegram movie ingestion asynchronously`) is pushed to `origin/main` and deployed to `/opt/hdqaz-bot`. Movie source staging now runs on a background thread; the polling loop can continue handling commands and buttons during download. Duplicate in-flight media is ignored, download staging remains atomic/retryable, and the existing SourceProvider → Phase 3 worker flow is unchanged. Focused tests passed before deploy: `test_movie.py` 15, `test_bot.py` 17, `test_ingestion.py` 10; compileall and `git diff --check` passed.

Production diagnosis confirmed synchronous Telegram download/staging in the polling path was the original responsiveness risk. The incident movie itself completed to Ready 100 and remains unpublished. The rotated bot token was verified with `getMe` without outputting it; a read-only backend Queue request returned seven rows. Only the bot container was recreated. Local Bot API and the Phase 3 worker remained running and unchanged.

Current production verification is blocked by a competing Telegram runtime/polling lease. Vercel production logs show repeated HTTP 409 responses from `telegram_runtime_lease` (`Bot already running`); the lease lasts 90 seconds. The server has one bot container and one bot process, and this Mac has no second local process. Do not clear the database lease manually or weaken lease checks: first locate and stop the other bot poller on its host, then let the lease expire and confirm the deployed bot becomes healthy and responds to `/start` and Queue. Latest observed bot state: running, unhealthy heartbeat, one restart; Local Bot API running, Phase 3 worker running. `getMe` and backend Queue passed, but no post-deploy real large-file concurrency test was completed.

The temporary SSH key and local keypair were removed. Secret values are not recorded here. No production catalog, HLS, publication, or processing data was modified by this incident work.
