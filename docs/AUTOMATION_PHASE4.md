# Phase 4: private Telegram administration

The Telegram bot is a private remote for the Next.js API. Supabase owns workflow,
revision, deduplication, publication and channel-delivery state. The existing Linux
worker still owns probing, branding, FFmpeg, adaptive HLS, R2 and CDN verification.
No media processing or large network download happens in the bot or Vercel.

## Services and credentials

`bot/` is a Python 3.12 standard-library service, with long polling and no public port.
`POST /api/telegram/admin` requires a distinct bearer credential. User operations also
require a numeric ID from the backend whitelist. The bot independently verifies the
Telegram sender ID, private chat type and matching chat ID. Usernames never authorize.
The bot never holds a Supabase service-role key, worker credential or general admin token.

Vercel Production variables:

- `TELEGRAM_BACKEND_TOKEN`: independently generated secret, shared only with bot.
- `TELEGRAM_ADMIN_USER_IDS`: comma-separated positive numeric Telegram IDs.
- `TMDB_ACCESS_TOKEN`: existing TMDB read token, metadata only.
- `TELEGRAM_CHANNEL_MODE`: `disabled` by default; `test` then explicitly `live`.
- `TELEGRAM_CHANNEL_ID`: configured destination (`-100...` or public `@username`).
- `TELEGRAM_TEST_CHANNEL_ID`: required exact match for test mode; test destination must
  be a private channel (no username), checked with Telegram before sending.
- `TELEGRAM_SITE_URL`: HTTPS site origin, normally `https://hdqaz.online`.

Hetzner bot `.env` (root-owned, mode 600):

- `TELEGRAM_BOT_TOKEN`, `TELEGRAM_ADMIN_USER_IDS`, `TELEGRAM_BACKEND_TOKEN`.
- `HDQAZ_API_BASE_URL=https://hdqaz.online`.
- `BOT_SOURCE_ROOT=/handoff`, `BOT_MAX_SOURCE_BYTES=8589934592`.

Worker environment does not change. Keep runtime assets, env files and credentials
out of git, images, messages and logs. The supplied credential file under the worker
folder is a provisioning input, not a reason to expose bot credentials to the worker.

## Admin workflow

Send `/start` in a private chat. Choose Movie or Series, enter a TMDB search title,
then explicitly select a result. Results use Kazakh localization; missing overview
falls back to English. TMDB IDs, fields and image paths are validated. Supported genre
IDs map to existing Kazakh genre labels. Metadata is an enrichment draft, not an update
to an existing title. Selecting a new TMDB identity requires a new draft after selection.

Use `/edit title=...`, `/edit description=...`, `/edit year=2026`,
`/edit is_premium=false`, `/dubbers`, `/edit dubber_id=UUID`.
Series also supports `/existing title`, `/use UUID`, `/edit season_number=1`,
`/edit episode_number=1`, `/edit episode_title=...`, `/edit episode_description=...`.
Existing series metadata is not overwritten; seasons are reused, and published episodes
or targets with existing HLS cannot be replaced through this workflow.

### Safe source reference

An operator stages an authorized immutable file on Hetzner at:
`/opt/hdqaz-worker/runtime/sources/inbox/<source UUID>.media`.
It must be a nonempty regular file within the configured size limit, owned by UID 10001
and mode 0444. No symlinks or arbitrary paths/URLs are accepted. Set ownership and mode
only after upload finishes; do not modify an inode after submission.

The bot sees this directory and the worker source directory through ONE mount at
`/handoff`, which permits an atomic hard link without copying the media. The worker's
existing source mount stays read-only. Do not put inbox and destination on different
filesystems or separate container mounts. Direct Telegram file ingestion is deliberately
not implemented: it would require additional large-file API infrastructure and token
handoff. This is a safe source-reference workflow, not a Telegram downloader.

Send `/source UUID`, review the title/episode/source summary, and confirm processing.
A private transaction creates the draft target and calls the existing Phase 2
`automation_create_job`. `next_attempt_at=infinity` holds it in that same transaction.
After the hard link is verified, activation makes the job claimable. Crash between these
steps leaves a visible Staging workflow that `/queue` can resume safely. The bot never
sends its Telegram token or source credentials in a processing job.

## Review and publication

`/queue` or Refresh shows safe status/progress/error codes; no one-second DB polling.
Ready only exposes the candidate manifest for review. The explicit “Тексердім — жариялау”
button invokes a row-locked transaction that checks actor, revision, job/target binding,
Ready state, exact allowlisted manifest and absence of existing target HLS/publication.
It attaches output, publishes the intended new target and writes audit/outbox atomically.
Repeated Publish is idempotent. Existing unpublished series parents require web review;
only new Phase 4 TMDB titles may be made visible by this transaction.

Reject retains the Ready candidate but makes the workflow non-publishable. Start a new
draft/source for a replacement. Retry applies only to Failed jobs and uses Phase 2's
existing attempt/backoff/max-attempt model. Old callback revisions are rejected.
Admin Web Queue remains compatible and labels Published/Rejected review state correctly.

## Public channel delivery and uncertainty

Posting is disabled until explicitly configured. Publish creates a private outbox row;
only a published title/episode may supply a channel payload. A post contains poster,
title/year and a site watch link with Telegram UTM parameters. Failed posting never
rolls back publication. Test mode additionally refuses channels with a public username.

A unique outbox row and claim token prevent concurrent sends. A definite Telegram 4xx
rejection is Failed and may be retried explicitly (maximum five attempts). Timeout,
5xx, crash or lost acknowledgement is **Uncertain**; it is never automatically resent.
Telegram sendMessage/sendPhoto has no application idempotency-key contract, so claiming
exactly-once delivery across an ambiguous network failure would be incorrect. An operator
must inspect the configured channel and reconcile an uncertain row with its actual
message ID, or establish that no post exists before scheduling another delivery.

## Recovery and deployment

Bot update offset and singleton lease live in Supabase. A 20-second heartbeat renews a
90-second lease; local fencing stops mutations after 60 seconds without renewal. Docker
uses `unless-stopped`, no capabilities, a read-only root, bounded RAM/CPU/logs and a
health heartbeat. Persistent API failure exits the process for Docker recovery. A fresh
instance waits for the old DB lease to expire. Callback revision/idempotency receipts
protect catalog mutations even if Telegram redelivers an update.

Apply only `202609290001_telegram_workflow.sql`, after backup, disposable PostgreSQL tests
and comparison of existing production rows. It creates six private tables and three
private RPCs, without changing existing tables/rows. Do not rerun Phase 1 or Phase 2.
Then deploy the API, configure credentials, build the bot image, and start ONE bot.
Run isolated movie and series workflows, verify Ready, test explicit publication only
on newly created test records, and verify private-channel delivery before live mode.
Do not use published production titles as test fixtures.

## Validation

- `node --test tests/automation-validation.test.cjs tests/processing-api.test.cjs tests/telegram-api.test.cjs`
- `HDQAZ_TEST_TOOLS=... node --test tests/processing-db.test.cjs tests/telegram-db.test.cjs`
- `npx tsc --noEmit --incremental false`; `npm run build`.
- Build `bot/Dockerfile` on Linux; run `python -m unittest discover -s tests -v` in image.
- Keep the Phase 3 Linux worker test suite passing; no production users/channels in tests.

References: https://core.telegram.org/bots/api,
https://developer.themoviedb.org/docs/search-and-query-for-details.
TMDB provides metadata; this product is not endorsed or certified by TMDB.
