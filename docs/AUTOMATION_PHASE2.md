# Phase 2 processing contract

This implements the backend contract only. No worker, FFmpeg, Telegram bot,
upload, deployment or public video publication is included. Phase 1 must already
exist. Existing catalog/episode values and the HLS player are not changed.

## Deployment

1. Back up the database and test `202609260002_processing_contract.sql` on staging
   with Phase 1 present. **Do not run Phase 1 again on production.**
2. Run the tests below, including the real two-connection PostgreSQL tests.
3. An operator applies the new Phase 2 migration, then deploys the app. This work
   does not apply any production migration. The migration adds only
   `processing_jobs.output_metadata`, its numeric metadata validator and private
   service-role RPCs. It never updates catalog data or publishes a video.
4. Set the private server environment variables below. Confirm deployment logs,
   reverse proxies and future workers redact Authorization and lease tokens.
5. In staging, confirm normal admin access and movie/episode editing still work;
   check queue filters, refresh, Retry, max-attempt messaging and Ready output.
   Anonymous and non-admin browser sessions must not see the queue.
6. Exercise two real worker credentials concurrently through the deployed API;
   check expiry/reclaim, revoked credentials, an interrupted request and repeat
   completion with the same payload. API instances share the database clock and
   row locks; there is no in-memory queue/lock.

No additional app runtime dependency is required. Server files import
`server-only`; the UI imports only DTO types and calls the admin API.

## Server configuration

`.env.example` contains names with empty values only. Generate unique cryptographic
secrets in your deployment secret manager; never use `NEXT_PUBLIC_` variables.

- `AUTOMATION_WORKER_CREDENTIALS`: JSON object mapping a stable worker identifier
  to its own random bearer credential. IDs: 1–64 letters/digits/`_.:-`, beginning
  with a letter or digit. Secrets: 32–512 non-whitespace characters. Each worker
  must have a unique secret, distinct from the producer/admin/service-role keys.
  The authenticated identifier is derived from this mapping, never from a body.
- `AUTOMATION_PRODUCER_TOKEN`: optional separate random secret for a future
  trusted backend/bot to **create only**. A worker cannot create/retry/list jobs.
  Do not provide the bot with worker or Supabase service-role credentials.
- `AUTOMATION_OUTPUT_ORIGINS`: comma-separated exact HTTPS origins, e.g.
  `https://cdn.hdqaz.online`. No wildcard, path, trailing slash, credentials or
  custom port. Completion fails closed if missing/malformed. Allow only CDN
  origins you control, whose manifests can be safely reviewed.
- Existing `SUPABASE_SERVICE_ROLE_KEY` remains on the Next.js server only.
  `BACKEND_ADMIN_TOKEN` remains an admin credential and is never a worker token.

Rotation: deploy a new secret for the same worker ID, then update that worker.
Removing an ID/token rejects subsequent calls. A revoked worker's active jobs
become reclaimable after lease expiry. Keep all API traffic HTTPS. The worker
never gets database credentials. A compromised worker can damage its own claimed
jobs; credentials are for trusted server workers, not untrusted end users.

## API

All responses use `{ "data": ... }` or `{ "error": { "code", "message" } }`,
with `Cache-Control: no-store`. POST bodies are JSON objects, max 16 KiB.
Unknown fields, raw logs, error messages, worker IDs, custom lease durations and
arbitrary metadata are rejected. Cookies use the existing admin authentication;
state-changing browser requests enforce same Origin. Bearer server requests do
not require an Origin header.

| Method / path | Identity | Input / response |
| --- | --- | --- |
| `GET /api/automation/jobs` | Admin | Optional `status`, `limit` (1–50, default 25), `offset` (0–100000). `{items,has_more}`; content/episode labels, safe errors, no lease token. |
| `POST /api/automation/jobs` | Admin or producer | `content_id`, optional/null `episode_id`, UUID `idempotency_key`, optional `max_attempts` (1–10, default 3). Returns 201 + safe job view. |
| `POST /api/automation/jobs/claim` | Worker | `{}`. Returns 200 + claimed view including `lease_token`, or `{data:null}` when nothing is available. |
| `POST /api/automation/jobs/{id}/heartbeat` | Owning worker | `lease_token`, `stage`, `progress_percent`. Returns safe updated view. |
| `POST /api/automation/jobs/{id}/complete` | Owning worker | `lease_token`, `output_manifest_url`, optional `output_metadata`. Returns Ready view. |
| `POST /api/automation/jobs/{id}/fail` | Owning worker | `lease_token`, `error_code`. Returns Failed view. |
| `POST /api/automation/jobs/{id}/retry` | Admin | `{}`. Failed → Queued if attempt budget remains and no other active target exists. |

Worker requests use `Authorization: Bearer <that worker's credential>` plus the
per-claim lease token in mutation bodies. Admin/producer secrets do not authorize
worker actions. UUID validation covers target IDs, job IDs, idempotency and leases.
Unauthorized workers get 401; missing admin rights get 403. Bad input/targets get
400; active duplicates, expired/stale ownership and non-retryable states get 409.
Unavailable/missing migration or credential configuration gets 503. Responses
never include database error details, stack traces or service-role credentials.

### Target and idempotency

Phase 1's target rules remain: content-level jobs require `contents.type=movie`;
other types require a matching episode. Supporting feature-length anime/cartoon
as a movie target requires a later explicit target-model change. Both the API
and database enforce target correctness; the composite FK enforces episode parent.

The caller creates one UUID idempotency key per logical job and reuses it if a
create response is lost. Same key + same target + same max_attempts returns the
existing job (including terminal jobs); conflicting reuse fails. This does not
automatically retry a failed job. Phase 1's partial unique indexes prevent
multiple active jobs for the same movie or episode, even across API instances.

### Lease and state machine

`queued → downloading → processing → uploading → ready`

Any active stage may become failed. `stage` is the active status, not arbitrary
worker text. Heartbeats can remain in the same stage or advance one step; they
cannot regress/skip. Progress is a global integer 0–100, monotone within one
attempt. It resets on a new claim/retry. Completion is allowed only from uploading
and sets progress=100 plus finished_at. All worker writes are row-locked and check
job ID, authenticated worker ID, matching random lease token, active state and
unexpired database-clock lease **after acquiring the lock**.

Claim uses `FOR UPDATE SKIP LOCKED` within a single database transaction. It
increments attempt_count, creates a new UUID token and gives a **120-second**
lease. Send a heartbeat about every 30 seconds; each successful heartbeat renews
the lease for 120 seconds. Poll an empty queue with bounded backoff/jitter.

Expired active jobs with remaining attempts can be reclaimed; the token rotates
and the old worker cannot write. Claim also sweeps up to 100 expired final-attempt
jobs to Failed (`lease_expired`), without blocking on other workers' locked rows.
No separate scheduler is needed for this cleanup while workers are polling.

Fail stores only an allowlisted code; Phase 1's generated error_message supplies
fixed safe text. Accepted worker codes: download_failed, invalid_media,
processing_failed, upload_failed, internal_error. lease_expired is server-owned.
Ready/failed rows retain the claim identity for safe exact-payload terminal
replays after a lost response; they cannot be heartbeated/changed. Retry clears
the old claim/output, retains attempt_count and max_attempts, and schedules a
5/10/20/... second exponential backoff capped at 300 seconds. At the maximum,
Retry fails. Administrative requeue also respects the active-target unique index.

### Human review boundary

Complete accepts only an approved HTTPS `.m3u8` URL without userinfo, query,
fragment, encoded path characters or path normalization. The API does not fetch
the URL. Optional metadata is a numeric-only whitelist:
`duration_seconds` (>0, ≤604800), `width`/`height` (integer 1–16384), `size_bytes`
(positive safe integer). Raw metadata, source URLs, logs or tokens cannot be
stored through this contract.

Complete updates **only processing_jobs**. The Admin Panel shows Ready, URL,
progress, attempts, timestamps and fixed safe error text. It has no Publish or
Attach button. `contents.hls_url`, `episodes.hls_url` and publication flags remain
unchanged. Phase 3 must add real media verification, source acquisition and a
separately authorized human-review/attachment workflow. A ready job is a worker's
reported result, not proof that the URL points to a playable/approved asset.

## Tests

```sh
node --test tests/automation-validation.test.cjs tests/processing-api.test.cjs
./node_modules/.bin/tsc --noEmit --incremental false
npm run build
```

Real PostgreSQL integration/concurrency test (download test-only tooling into
your chosen temporary directory, not production):

```sh
npm install --prefix /tmp/hdqaz-phase2-test-tools embedded-postgres@18.4.0-beta.17 pg@8
HDQAZ_TEST_TOOLS=/tmp/hdqaz-phase2-test-tools node --test tests/processing-db.test.cjs
```

The runner starts a disposable local cluster on a dynamically selected port,
applies base + Phase 1 + Phase 2 to that **new local database**, tests the Phase 1
SQL regression suite and Phase 2 invariants, and shuts the cluster down. It never
reads production URLs, `.env.local` or DATABASE_URL. Multi-connection tests include
one-job contention, distinct claims, concurrent duplicate create, and a locked
row that another worker must skip. No Docker/Hetzner is used.

The Phase 1 SQL test order was corrected: its cross-parent FK assertion now runs
before an active job for the same episode can mask that FK with a unique error.
Phase 1 migration itself is unchanged.
