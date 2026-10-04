# HD Qaz checkpoint — 2026-10-04

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

Movie → Manual Entry asks one question at a time: title, year, description, country, comma-separated genres, duration, Premium buttons. Optional dubber defaults unset. Clean summary has Edit, Video and Cancel. Normal movie cards hide `/edit`, `/source UUID`, source/job IDs, raw workflow/error codes and developer instructions. Review link is a button; explicit Publish remains separate. Technical commands remain emergency operator fallbacks only.

Send/forward MP4/MOV/MKV/WebM after pressing Video. No SSH, manual Hetzner upload or UUID is needed for normal ingestion. Bot performs no transcoding; it copies completed API files in 1 MiB chunks with size/header/path/symlink/disk checks, partial cleanup, fsync and atomic publication. Existing worker validates and processes media.

## Validation and limits

35 focused Python tests passed locally and inside final production Docker image; git diff --check passed. No broad suites rerun. Earlier Phase 4 baseline tests/TypeScript/build remain documented in history; no TS changed here.

Actual Telegram test used a short clip, not a multi-GB movie. Local API removes cloud's 20 MB download limit; user Telegram upload limits still apply. Default source maximum is 8 GiB, subject to free disk (three source copies plus reserve). API cache and source retention need operator disk management as usage grows. During a large local download, bot commands are serialized and handled afterward; acceptance/downloading is shown first and job progress after activation is available by Queue/Refresh. No live download percentage is promised.

## First real movie

1. Open @hdqaz_bot, press Movie, then Manual Entry.
2. Answer the questions, review summary, press Video.
3. Send/forward your actual movie file to this chat.
4. Wait; Queue/Refresh shows processing and Ready.
5. Review the output. Only for your own real reviewed movie, press explicit Publish.

Current ingestion+clean UI milestone is complete. Do not add Series, channel posting, REMAKE or unrelated work without a new task. Remaining unverified milestone: user's first real full-length movie and explicit publication/site playback. Preserve the synthetic fixture unpublished.
