# Storage, backup and keyboard review

Reviewed on `ag-dev`, 2026-10-14. This pass extends the rendering work in [PERFORMANCE.md](PERFORMANCE.md) without changing graphics quality or game rules.

## Changes and evidence

| Trigger | Result after this change | Regression coverage |
| --- | --- | --- |
| More household profiles or catalog games | Database export uses nine SELECT queries instead of `2 + 7 × players × games`; one player with eight games previously required 58. The snapshot still includes retired games, completed sessions, saves, records, recovery, favorites and awards for active players. | `backend/tests/test_backup.py` checks ownership, retired games, deleted players, complete history and unchanged query count from one to thirteen players. Existing import tests cover transactional copies and replay. |
| Another tab submits a queued result | Pending results reconcile with browser storage; Settings updates on storage events. A failing request does not recreate a durable result already removed by another tab. | Queue unit tests and a two-tab browser journey verify removal, disabled Retry and a single stored completion. |
| Browser storage rejects writes | The queue keeps unsaved results in memory. Full backup export includes those results, current in-memory recovery and preferences. | Backup/queue unit tests simulate unavailable storage; a browser test rejects result writes and verifies the downloaded backup contains the unsaved result. |
| Import contains queued results and recovery for the same session | Both reference the same newly mapped UUID, including the server's existing completed-session mapping. Mismatched keys, unavailable players and incompatible recovery envelopes are reported. | Backup unit tests cover remapping independent of entry order, original-player preservation, malformed entries and failed writes. Existing browser coverage exercises download/import. |
| Performance storage contains `null`, malformed JSON or invalid entries | Settings ignores invalid data and shows at most ten valid measurements. New samples explicitly target 60 FPS. | Performance unit tests and the cross-tab browser journey open Settings with corrupt history. |
| A menu contains disabled/hidden controls, opens a nested dialog, or temporarily has no controls | Tab visits visible enabled controls in the active custom modal, recovers focus from outside it, and gives a native dialog its own keyboard handling. Empty custom modals retain focus; closing restores the previous connected control. | Modal unit tests plus a browser menu journey cover both Tab directions, nested/native dialogs, closed details, disabled controls and focus restoration. |
| Recovery snapshots arrive faster than the local server can accept them | Consecutive waiting snapshots coalesce to the latest board per player/game. Deletes remain ordered barriers and retain session guards. Browser/memory snapshots still update immediately. | A unit test holds one request open, produces 101 snapshots and verifies two writes: the in-flight snapshot and the latest waiting board. Other cases cover failed writes, independent players, clearing queued snapshots and newer-run preservation. |
| A profile refresh overlaps an edit/create/switch, or a refresh fails after creation | Mutations invalidate older list reads; newer revisions start their own refresh. Late activation responses cannot replace a newer selection. Created/deleted players update locally before the refresh. | Deferred-response store tests cover creation, editing, overlapping lists and out-of-order activation. A browser journey simulates an empty installation and a successful create followed by a failed list refresh, then opens the new player's profile. |
| The profile overview loads its statistics | It requests aggregate achievement counts and avoids fetching unused session rows. Opening history still requests the real paginated history. Achievement lists join only the requested page instead of loading every unlocked record. | Browser request assertions reject unused history/full-achievement reads. Backend instrumentation verifies two SELECTs for the summary and three for a page, including profile lookup, with correct ownership and off-page totals. Existing catalog tests cover retired games. |
| Records load slowly or personal/household views change rapidly | Loading is distinct from an empty history. Abandoned requests abort; each view change has a new revision, so a late response or previously cached result cannot appear under the wrong selection. | Component tests cover initial loading, empty/error/retry states, aborted requests and a personal/household/personal response race. |

Closed details are checked explicitly: Chromium can retain layout boxes for hidden descendants, so rectangle checks alone cannot identify their keyboard availability. Decorative menu arrows are also excluded from accessible button names.

## Persistence boundaries

The database import is atomic. Browser entries are restored individually after it commits; invalid entries and storage failures are counted and shown separately. A queued result whose storage write fails remains available for retry/export in that tab, but closing the tab can lose that in-memory fallback. Recovery also attempts a serialized server write independently of browser storage.

Full backup export requires the local server. It includes data from the current browser origin and current tab's memory; it cannot read another origin or another tab's private memory. Server completion receipts remain the authority for idempotent retries. The subsequent six-item follow-up adds Web Locks around queue flushes on supporting browsers and rereads the durable queue after acquiring the lock; direct completion/exit paths still rely on receipts for idempotency.

The follow-up also adds read-only restore previews, bounded automatic server snapshots and crash-screen export. Automatic snapshots keep server-saved state and restore copies; the full browser export includes its own preferences and queued results. See [SIX_IMPROVEMENTS.md](SIX_IMPROVEMENTS.md) for scope, validation and the target-laptop workflow.

## Validation and remaining work

Run `python scripts/check.py --browser` from the repository root for lint, backend/frontend tests, type checking, production build and isolated browser journeys. The current run is recorded in [VALIDATION.md](VALIDATION.md).

Native integrated-GPU performance, power use, physical controllers, assistive-technology use and observed human play remain the acceptance work in [PLAYTEST.md](PLAYTEST.md). The software-rendered browser suite verifies behavior and Full HD buffers, not 60 FPS on a named laptop.
