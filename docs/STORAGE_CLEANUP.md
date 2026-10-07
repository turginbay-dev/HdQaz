# Local storage maintenance

The existing cleanup executor owns automatic **local-only** maintenance. Its explicit full-content deletion path remains separate; automatic maintenance never calls R2 or Supabase Storage deletion. Worker verification/upload/Ready and human publication remain unchanged.

- Worker attempt directories have inherited advisory locks. FFmpeg inherits both workspace and source locks, protecting media if its parent exits. Confirmed Ready/failed workspaces are removed; unconfirmed terminal outcomes remain for an authoritative scanner.
- The scanner checks private backend state, terminal jobs, leases, unchanged progress, file sizes/mtime and process locks. Stale jobs require at least 30 minutes without heartbeat/progress/file change, no live lease and no process lock. Conditional DB updates fence heartbeat/claim/retry races. Unknown state retains files. Live/hung-but-unproven processes are retained, not killed based on age.
- Shared sources are retained while any workflow is draft/staging or any referencing job nonterminal. Transfer coordination and source inode locks prevent ingestion/processing races. Original handoffs remain in the existing read-only SourceProvider layout; no pipeline relocation.
- Source retry uses durable Telegram file_id through the existing bot, bounded streaming and a per-attempt background recovery. Legacy manually staged sources without a Telegram file_id require re-sending the source; they cannot be magically re-created. No SSH/UUID is required for ordinary Telegram recovery.
- Only explicitly recorded Telegram getFile cache files under videos/documents may be removed. Unmapped historical cache files are retained. Telegram database/session/global cache directories are never purged.
- Disk pressure triggers a safe scan at 80%; >=90% pauses new claiming, never deletes healthy active processing. A stale/unavailable maintenance report also pauses new claims. Resume follows a fresh safe report.
- `/disk`, `/status`, `/cleanup` are private whitelist-only. Notifications are important-event based with durable per-recipient acknowledgement. Unknown send results are not blindly resent.

## Configuration / rollout

Cleanup container: `CLEANUP_ENABLED=true`, `STALE_HEARTBEAT_MINUTES=10`, `STALE_PROGRESS_MINUTES=30`, `ORPHAN_MAX_AGE_MINUTES=60`, `DISK_WARNING_PERCENT=80`, `DISK_CRITICAL_PERCENT=90`, `CLEANUP_INTERVAL_SECONDS=600`. Default enabled is **false** for staged rollout. Heartbeat/stale/orphan minimums reject unsafe values.

Private shared control directory `/opt/hdqaz-worker/runtime/control`, UID/GID 10001, mode 700, contains a regular `source-lock`, non-secret health/events and recovery requests. Mount as `/control` in worker/bot/existing cleanup. `WORKER_CONTROL_ROOT=/control`, `BOT_CONTROL_ROOT=/control`. No credentials cross these mounts.

Migration `202610070001_storage_stale_error.sql` requires PostgreSQL 17 and preserves the generated error-message column. Apply only after its rollback test and production authorization. Deploy private backend before enabling cleanup. Deploy worker/bot only while idle; verify source recovery before deleting existing media. Docker JSON logs already rotate 10MB×3 (cleanup 5MB×2); no prune commands.

## Rollback

Set `CLEANUP_ENABLED=false` in cleanup.env and restart only cleanup. Existing processing can continue using fresh health reports. Restore saved pre-deploy code/images/compose for worker/bot/cleanup while idle; remove control mount/environment when restoring the old implementation. The backward-compatible diagnostic extension can remain. Do not revert it while STALE_JOB_CLEANUP records exist. Removed temporary media is re-fetched from its source provider, not restored by rollback. R2 media stays intact.

## Validation

Isolated Linux containers: 40 worker tests (including short FFmpeg), 71 bot tests, 25 cleanup tests. Focused Node API/cleanup: 12 tests. TypeScript passed. Generated-expression extension passed a temporary-table rollback assertion on production PostgreSQL 17.6. See PHASE4_CHECKPOINT.md for actual deployment state; these test results alone do not imply production activation.
