# Telegram movie ingestion deployment

Real production Telegram forward test passed on 2026-10-04: workflow bf016618-d83e-4cb0-b81f-205d7d3f446c, job cfb7e251-46c5-412f-8586-31244fcc45b2 reached Ready 100. Target remained unpublished with no attached HLS and no publication audit. CDN master, variant and segment returned HTTP 200. Do not publish this synthetic fixture. Final focused suite: 35 tests.

## Architecture

Private Telegram API (`tdlib/telegram-bot-api`, pinned e3e9dd8e5b3d7ab8537cd5a10dc31d5ffa8f82d1) downloads files in local mode. It has no exposed host ports. Bot reads its private data volume read-only and copies completed MP4/MOV/MKV/WebM media to the existing source inbox in 1 MiB chunks, then hard-links through existing Sources.stage. Existing Phase 2 create/activate and Phase 3 MountedSource/FFmpeg/R2 pipeline remain unchanged. No database migration is required.

Bot requests getFile only after numeric admin authorization and explicit draft selection via Video button. UUIDs are internal. Telegram filenames are never used as destination paths. Size, media header, path containment, symlinks, immutable source handoff, disk reserve and atomic finalization are checked. Worker still performs full media probing/decoding. Interrupted copies clean their partial file; replay uses a deterministic source identity. Separate credentials remain separate.

Manual title/year/description/country/genres/duration/premium prompts use a persistent local SQLite conversation store. Supabase remains the workflow/job authority. Back up runtime/state alongside private API runtime. Uploads are serialized; the bot sends acceptance/downloading before waiting for local API download, with a one-hour timeout. Commands queued during a large download are handled afterward. This MVP does not promise live download percentages. Existing job progress is available after activation via Queue/Refresh. Max source default 8 GiB; disk admission also applies. Telegram user account upload limits still apply.

## Operator installation (not a normal movie-upload step)

- Keep `.env` unchanged except configuration additions if needed. Private `telegram-api.env` contains only TELEGRAM_API_ID and TELEGRAM_API_HASH, mode 600.
- Create runtime/state and runtime/telegram-data/tmp owned by 10001:10001; private directories mode 700.
- Build `TelegramApi.Dockerfile` and bot image; run focused bot tests.
- Use both compose files: `docker compose -f compose.yaml -f compose.local-api.yaml`.
- Start API first, with no host ports. Check API is listening internally before stopping bot.
- Stop exactly one old bot, call Telegram cloud logOut without printing token/URL, then start exactly one bot with local API overlay. Never run cloud/local pollers simultaneously.
- Cloud rollback after logOut can require 10 minutes; do not churn endpoints. Preserve offset and private API data. Verify health and API auth, then real admin-originated test upload.
- Keep secrets, logs, compiled binaries and runtime out of Git. Docker context excludes private env and logs.

## Real acceptance test

Use a fresh synthetic movie draft, fill manual prompts, press Video, send/forward a short test video from the whitelisted user's Telegram account. Observe automatic job creation and existing worker claim, Ready 100 and CDN manifest. Confirm target remains unpublished with HLS unattached. Do not click Publish for the fixture. Mocked updates/API calls are not a substitute for this test.

## First real movie

/start → Movie → Manual entry → answer prompts → Video → send/forward an MP4/MOV/MKV/WebM file → wait for processing → Queue/Refresh → Ready → review manifest → explicit Publish only for your real reviewed movie. `/edit` and `/source UUID` remain operator emergency fallbacks.
