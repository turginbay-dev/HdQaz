# Automation Phase 1 deployment

No production database was modified by implementation. No worker, bot, upload,
job execution endpoint, or automatic publishing is included. Queue claims/lease
renewals and legal state transitions must be implemented atomically in Phase 2;
the fields alone are not a concurrent-worker protocol.

## Deployment order

1. Back up production and restore a staging copy. Confirm all earlier migrations
   are applied. Inspect the actual episodes constraints; the migration expects
   the original `episodes_content_id_episode_number_key` constraint.
2. Review `supabase/migrations/202609260001_automation_foundation.sql`.
   Apply it to staging first, then execute the rollback-only SQL test below.
3. Test the admin/public flows below on staging.
4. Apply the reviewed migration to production yourself using Supabase SQL Editor
   (the file includes a transaction), or psql with an approved connection.
   Deploy the updated app AFTER the migration: content reads now require seasons.
5. Do not roll back to the old app after creating HLS-less drafts without first
   checking its assumptions. Preserve this additive schema; do not drop tables.

Commands (connection credentials belong in a secure environment / pgpass, never
in the repository or chat; PG* must point to the intended database):

```sh
# Staging first. Production execution remains a manual operator action.
psql -X -v ON_ERROR_STOP=1 -f supabase/migrations/202609260001_automation_foundation.sql
# Staging ONLY; inserts fixtures and rolls them all back.
psql -X -v ON_ERROR_STOP=1 -f tests/automation-foundation.sql
node --test tests/automation-validation.test.cjs
./node_modules/.bin/tsc --noEmit --incremental false
npm run build
```

`npm run lint` currently opens ESLint setup because this repository has no ESLint
configuration. Implementation also ran a programmatic TypeScript recommended
lint on changed TS/TSX files without altering the project's lint setup.

## Manual mapping (no automatic Season 1)

Existing episodes retain `season_id = NULL`; their IDs, numbers, slugs, HLS URLs
and publication flags are unchanged. The Admin Panel labels these as unmapped.
Create a verified season using the admin form, edit each confirmed episode and
select its season. Saving an existing episode keeps its original slug even when
its season/number changes. Do not infer season numbers from episode order.
Large mappings should be reviewed by episode UUID before a separate transaction.
Unmapped episodes may remain unmapped indefinitely; the UI still supports them.

New season episodes generate `s<season>-e<episode>` slugs. The existing global
`(content_id, slug)` uniqueness remains, so a preexisting identical slug causes a
conflict instead of silently changing a public URL. Episode numbers are unique
within each season; unmapped episode numbers remain unique within their content.
Conflicting historical slugs need an explicitly reviewed new-episode slug via
API, never an automatic rename of existing URLs.

Audit legacy published episodes with blank HLS:

```sql
select id, content_id, slug
from public.episodes
where is_published and (hls_url is null or btrim(hls_url) = '');
```

The new published-HLS check is NOT VALID to avoid rewriting/rejecting old data
at migration time, but it checks every future insert/update. Repair those URLs
or deliberately unpublish affected records after review, then run:

```sql
alter table public.episodes validate constraint episodes_published_hls_required;
```

## Acceptance checks

- Existing `/<slug>?episode=<old-slug>#player` plays the same episode.
- Create Season 1 Episode 1 and Season 2 Episode 1; both save and have distinct URLs.
- Create a draft without HLS; reload admin; it remains draft and is absent publicly.
- Publishing without HLS fails; add `.m3u8`, publish, and verify playback.
- Map/renumber a legacy episode: its existing URL remains unchanged.
- Wrong-content season/episode IDs fail (API checks plus composite database FKs).
- Non-admin season POST fails; draft/public auth behavior remains unchanged.
- Anonymous and authenticated users cannot select/insert/update processing_jobs.
- Service role can create movie/episode jobs, but a movie job requires type=movie,
  and an episode job must match its parent content and a non-movie target.
- Duplicate active jobs/idempotency keys, out-of-range progress, cross-parent
  targets, ready-without-output and failed-without-error are rejected.
- Movie CRUD, dubbers, hero settings, episode delete and public episode navigation
  still work. Queue references intentionally prevent deleting job-linked content
  or episodes; handle job retention explicitly before such deletion.

## Security and scope

Queue has RLS and no public/authenticated policies or privileges. Only server
service_role has access; no queue route or browser database calls were added.
Errors use an allowlisted code and database-generated fixed message, never raw
stderr. Do not store signed/token-bearing URLs in output_manifest_url. Phase 2
must validate output locations and retain secrets outside queue payloads.

No changes to legacy movies, HLS player implementation, authentication, or
production data. Movie job currently means contents.type=movie; feature
anime/dorama/cartoon processing needs an explicit later target contract.

Modified existing files: content types, validation, repository, admin form,
public episode labels. Added files: seasons POST route, episode preparation
helper, processing types, migration, regression tests and this runbook.
