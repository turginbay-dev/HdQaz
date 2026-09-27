# Phase 3: isolated video worker

## Boundary and deployment status

The worker is `worker/`, a separate Python 3.12 service. Next.js only handles the
existing Phase 2 API. No FFmpeg on the Mac or in Vercel. No Telegram implementation,
publication, catalog update, audio replacement or HLS player modification.

Production Phase 2 SQL was applied on 2026-09-27 after explicit approval. All six
contents, two episodes and one legacy movie matched protected pre-migration
snapshots byte for byte. Private RPC permissions were verified. Do not reapply
Phase 1 or Phase 2. App deployment and server credentials must also be configured;
schema availability alone is not a working production worker.

## Claim, lease and lifecycle

- Each instance receives its own bearer credential, mapped to a stable identity by
  `AUTOMATION_WORKER_CREDENTIALS` in Vercel. Its local ID does not override API identity.
- Idle polling uses 5–60 second exponential backoff with bounded jitter. API failures
  back off too. No database/admin credentials are given to workers.
- A claim is followed immediately by a renewal. A background thread renews every
  30 seconds while downloads, FFmpeg and uploads continue. All stage changes,
  heartbeats and terminal calls are serialized to prevent stale-progress races.
- Downloading → processing → uploading is enforced. Progress comes from copied
  bytes, FFmpeg `out_time_us` / validated duration per rendition, and verified
  uploaded bytes. Fixed validation boundaries do not simulate progress over time.
- Heartbeat uncertainty/401/409/outage fences the attempt immediately. An independent
  80-second monotonic watchdog stops work even if the heartbeat HTTP thread stalls.
  This is shorter than the server's 120-second lease. SIGTERM/SIGINT also cancel.
- FFmpeg runs in its own process group. Cancellation sends TERM, waits at most three
  seconds, then KILL. The abandoned lease expires and Phase 2 reclaims it; the worker
  does not retry jobs itself or bypass max_attempts. Admin Retry remains authoritative.
- Complete/fail allow three exact-payload terminal retries for ambiguous/transient
  responses. Unconfirmed completion retains workspace; it never assumes Ready.

## Sources

`SourceProvider.acquire()` is the extension point for Phase 4 Telegram. Initially,
`MountedSource` reads **only `<job UUID>.media` inside a configured read-only root**.
An operator stages a file atomically before allowing the worker to claim that job.
There is no user-provided URL or arbitrary path, so there is no source URL SSRF.
Symlinks/nonregular files are rejected; bytes stream in 1 MiB chunks. Size, timeout,
free space and cancellation are checked. Original mounted sources are operator-owned
and are never deleted; worker-owned temporary copies are cleaned after Ready.

With multiple workers, supply the same source to each instance or mount a shared
read-only source volume. Workspaces must be distinct per worker. The local mock
storage root must also be distinct. R2 supports multiple workers via unique paths.

## Media preparation and output

FFprobe validates video/audio streams, dimensions 16–8192, finite duration (default
maximum six hours), framerate 1–120 and usable codecs. Supported container inputs:
MOV/MP4, Matroska/WebM, MPEG-TS and AVI. Network protocols and external playlists
are disabled. Full FFmpeg decode with `-xerror -err_detect explode` checks source
and intro before encoding. Intro must include audio and be no longer than 60 seconds.
Watermark must decode as PNG/JPEG/WebP. Missing or invalid assets fail safely.

Both intro and source are re-encoded through normalized scale/pad/SAR/framerate and
48 kHz stereo audio filters, then concatenated. Audio timing is referenced to the
video start timestamp, preserving stream offsets. Watermark keeps its aspect ratio,
uses 10% of output width and configurable corner/opacity. Branding is mounted read-only.

Each suitable rendition is encoded sequentially to limit RAM:

- 1920×1080 bounding box, then 1280×720; aspect ratio preserved, even dimensions.
- Downscale only. Duplicate dimensions are removed: a 720p source gets one 720p
  rendition; 360p stays 360p. Actual dimensions are written into the master playlist.
- H.264 high profile, yuv420p, CRF 21, medium preset by default; configurable threads.
- VBV nominal budgets: 5.5 Mbps (1080 box), 2.8 Mbps (720 box), 1.5 Mbps for a single
  sub-720 rendition. Maxrate is 1.5× and buffer 3× nominal; audio AAC 160 kbps stereo.
- CFR 24–30 fps based on source, closed GOP and forced aligned keyframes every six
  seconds. VOD HLS uses MPEG-TS segments, independent-segments, ENDLIST and relative
  paths. Master, variant and segment names are deterministic within each workspace.
- FFmpeg's temporary playlist writes prevent local partially written manifests.

Every playlist and reference is parsed and constrained to safe relative paths;
missing, zero-byte, duplicate, unexpected, encrypted or external-reference output
fails validation. All generated variants are probed and fully decoded; dimensions,
streams and duration must match expectations within max(1 second, 2%).

Rotated, anamorphic and HDR sources are deliberately rejected until explicit
rotation/SAR/tone-mapping support is added. This prevents silent distorted/HDR-to-SDR
releases. Subtitles, multiaudio preservation, deinterlacing and loudness mastering
are not implemented. Human visual/audio review remains required.

## R2 and verification

R2 was confirmed by the operator. `R2Storage` uses pinned boto3/botocore with an
explicit R2 endpoint, bucket and credentials; no ambient AWS credential chain.
Only allow a real R2 endpoint matching the configured account/jurisdiction domain.
The custom CDN origin must also be in Next.js `AUTOMATION_OUTPUT_ORIGINS`.

Keys use `candidates/<job>-<attempt>-<random release ID>/...`; release IDs are never
lease tokens. Each upload uses a fresh prefix, not an existing published path.
Segments upload first, variant playlists next, master last. Transient operations
retry at most three times with bounded exponential delay. Reads remain streaming
and lease-aware. Each object has HLS/TS content type, immutable cache headers and
SHA-256 metadata. Before proceeding, HEAD verifies size/hash metadata and a public
CDN GET streams the **whole object**, comparing size and SHA-256 to local bytes.
Redirects and transformed responses are refused. Only after all files are verified
can complete mark Ready. This incurs additional CDN traffic but verifies actual bytes.

The local adapter verifies destination bytes and atomically renames a completed
package. It is test-only: the production loop refuses to claim with local storage.
Only the integration test explicitly enables local completion against disposable DB.
No production Ready result is fabricated for a mock URL.

Remote failed candidate objects are not automatically deleted; configure monitoring
and an operator audit against Ready/review records before removing orphan prefixes.
Do not apply an indiscriminate lifecycle deletion rule to approved assets. The worker
never overwrites catalog HLS URLs, and human review/attachment remains a later phase.

## Cleanup and security

Each job owns a randomized directory under an exclusive locked workspace. Successful
API-confirmed Ready removes source copy and HLS temporary files. Failures retain files
for at most the configured age/byte budget; startup and idle checks prune stale owned
directories and reclaim space. Cleanup checks ownership markers, rejects symlinks and
uses symlink-safe removal; it cannot remove the workspace root or outside files.
Input source mounts and finalized local releases are not cleanup targets.

The container uses UID/GID 10001, read-only root filesystem, no capabilities, no-new-
privileges, bounded PIDs/memory/CPU and a small tmpfs. FFmpeg subprocesses receive a
minimal environment without API/R2 secrets. Argument arrays are used, never shell
interpolation. Output logs include only safe events, validated IDs, status/progress
and allowlisted codes; raw exception text, stack traces, source URLs and credentials
are never written to processing_jobs or logs. Secrets are in a permission-600 env file,
not the image, repository, browser bundle or Next.js worker code.

## Hetzner run guide (one worker initially)

1. Finish Phase 2 Vercel deployment and configure its worker credential mapping and
   output origins. Confirm missing worker auth returns 401 and admin queue loads.
2. Install/enable Docker using its official packages. Docker is already present on
   the inspected server. Build this directory with `docker compose build`.
3. Create `runtime/{work,sources,assets,storage}` under `worker/`. Work/storage must
   be writable by UID 10001. Sources/assets must be readable by UID 10001 and mounted
   read-only; do not expose them via a public HTTP server.
4. Copy `.env.example` to `.env`, chmod 600, and fill required fields. Empty optional
   numeric fields use defaults. For the inspected ~34 GiB free / 4 GiB RAM server,
   start with max source 8 GiB, reserve 4 GiB, two threads, one worker. Longer media
   may require a larger disk: output-space estimation will reject insufficient space.
5. Configure API `https://hdqaz.online`, workspace `/work`, source root `/sources`,
   intro `/assets/intro.mp4`, watermark `/assets/logo.png`, storage root `/storage`,
   adapter `r2`, and output origin `https://cdn.hdqaz.online` once confirmed for the
   selected bucket. Copy authentic intro/logo assets; synthetic tests are not branding.
6. Configure an R2 object Read/Write credential scoped to the selected bucket. Set
   endpoint, bucket, key ID and secret in server `.env`. Configure CDN custom domain
   and CORS for hdqaz.online GET/HEAD/Range playback. Never give worker service_role.
7. Stage a nonpublished synthetic test source, create an admin test job, start one
   worker, and check Ready + actual playback/branding/audio. Do not use a published
   production movie as a destructive test target.
8. `docker compose up -d`; `systemctl enable docker` ensures Docker starts on reboot;
   `restart: unless-stopped` restarts the container. `docker compose stop` sends SIGTERM
   with 45-second grace. Restart recovery uses lease expiry, not local ownership guesses.
9. Monitor container exit/restart state, queue age/failed jobs, disk and R2 orphan
   storage. Docker logs rotate at 10 MiB × 3. No public worker HTTP port is required.

Do not start the production loop until credentials, assets, deployment and CDN checks
are complete. The validation image on the server is not an active production worker.

## Configuration names

See `worker/.env.example` for the complete names-only template. API base, worker ID,
worker token, workspace/source/asset/storage paths and output origin are required.
R2 requires R2_ENDPOINT_URL, R2_BUCKET, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY.
Optional controls cover polling, heartbeat, input bytes/duration, disk reserve,
processing/source timeouts, failure retention, FFmpeg threads/preset and watermark.

## Validation commands

Run logic checks anywhere; media tests explicitly skip on non-Linux. Use Linux Docker
for the authoritative suite:

```sh
docker build -t hdqaz-worker:test worker
docker run --rm --memory 2g --cpus 2 --pids-limit 128 --cap-drop ALL \
  --security-opt no-new-privileges --read-only --tmpfs /tmp:size=1g,mode=1777 \
  hdqaz-worker:test python -m unittest discover -s tests -v
```

The R2 test uses real boto3 HTTP PUT/HEAD and streamed CDN GET against a local HTTP
fixture, including a transient 503 and checksum corruption. It is not a real R2 test.

For the complete API/database path, start `worker/tests/phase2_bridge.cjs` from an
HDQAZ_REPO environment pointing to the main repository, with the Phase 2 embedded-
postgres test tools installed. It listens only on loopback port 18440, creates its
own disposable database on 18439 and loads the actual Phase 2 Next route handlers.
Its Supabase transport is replaced with a parameterized PostgreSQL adapter; admin
auth uses an integration-only credential. No production environment is read.
Forward that loopback port through SSH to Linux and run `tests/e2e_phase2.py` with
PYTHONPATH=/app:/app/tests. The script creates a test job through the admin route,
claims via actual worker HTTP auth, processes synthetic media, verifies mock storage,
completes to real PostgreSQL Ready and checks the admin queue response and unchanged
catalog. Stop the bridge with SIGTERM to shut down/remove its disposable cluster.

## Primary references

- https://ffmpeg.org/ffmpeg-formats.html (VOD HLS and independent segments)
- https://ffmpeg.org/ffmpeg-filters.html (concat, scaling, audio and watermark filters)
- https://developers.cloudflare.com/r2/get-started/s3/ (R2 S3 endpoint/SDK)
- https://developers.cloudflare.com/r2/api/s3/api/ (R2 compatibility)
