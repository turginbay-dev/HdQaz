# HD Qaz Phase 3 production activation — 2026-09-29

Production activation passed. Phase 4 was not started.

- Implementation base: `6a3ce61`. Production environment activation deployment:
  `BvKTwGz7kGLbj7P72Ad9rquLBw54` (Ready).
- Production worker credential matches Hetzner: authenticated ownership probe reached
  the expected HTTP 409; unauthenticated claim remains HTTP 401. Credentials were
  never printed or committed. Output origin is `https://cdn.hdqaz.online`.
- R2 endpoint was normalized to the account endpoint (bucket is a separate setting).
  Bucket access and disposable upload/read/delete passed; disposable objects removed.
- Cloudflare default urllib requests returned HTTP 403/error 1010. Honest identification
  as `HDQaz-Worker/1.0 (+https://hdqaz.online)` passed full CDN verification. No Cloudflare
  security setting, IP bypass, browser impersonation, or redirect policy was changed.
- Original `Intro HdQAZ.mov` preserved. Its H.264/AAC streams were remuxed losslessly to
  `/assets/intro.mp4`; intro and logo passed actual image FFmpeg decoding/probing.
- Isolated unpublished fixture content: `d81e62e1-4df2-45c5-b2b6-862bb62fdfc1`.
  Job: `ae8ab0e0-cac8-44ae-9124-f52749af1edc`. Fixture setup used the private database
  create RPC; claim, heartbeat and completion used the real production Next.js API.
- Production E2E passed on attempt 1: synthetic 1080p source, actual intro/logo,
  adaptive HLS, actual R2, every CDN object verified by size/SHA-256, Supabase Ready.
  Output: 18.71 seconds, 1920x1080 primary rendition, 12,588,714 bytes total.
- Admin browser shows Ready, 100%, attempt 1/3 and the candidate manifest URL.
  Fixture remains unpublished with null catalog HLS; retained for human review.
- Exactly one Compose worker runs with `unless-stopped`; Docker is boot-enabled.
  Container restart and actual server reboot passed. Boot ID changed, the same single
  container returned running, and the completed job retained attempt 1 with no active jobs.
- Original six contents, two episodes and one legacy movie match protected baseline
  snapshots byte-for-byte. No original HLS URL or publication flag changed.
- Validation: 34 Linux worker tests (rerun after CDN fix), 18 regression/API tests,
  13 real PostgreSQL concurrency/integration tests; TypeScript and production build
  passed. Docker image build passed. Production health returned HTTP 200.
- No new migration. No Telegram, TMDB, automatic publication, or player changes.

## Operational boundaries

Sources are operator-staged as `<job UUID>.media` on the Linux server. Ready outputs
require human review; no publication automation exists. HDR, rotated/anamorphic input,
subtitles and alternate audio remain outside Phase 3. Remote orphan cleanup remains
manual. Runtime assets and environment files stay server-only.

**READY FOR PHASE 4: YES** — readiness only; implementation is not authorized here.
