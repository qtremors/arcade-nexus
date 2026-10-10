# Arcade Nexus backend

FastAPI and SQLite provide local persistence for the React arcade console. Games run in the browser. This backend does not use a WebView, require an online account, or provide competitive anti-cheat.

## Run

From this directory:

```bash
uv sync --locked
uv run python run.py
# Development only:
uv run python run.py --reload
```

The API listens on http://127.0.0.1:8000. Documentation is at /docs; /health checks access to the versioned database. The frontend still uses its existing Vite development workflow; browser launching, static frontend hosting, and executable packaging are separate work.

Copy .env.example to .env if you need custom settings. The .env file and relative DATABASE_URL paths are resolved against this backend directory, so launching from another working directory does not create an accidental second database. HOST and PORT configure the launcher. Reload is off unless explicitly requested.

## Dependencies and checks

pyproject.toml is the canonical dependency declaration, and uv.lock fixes the resolved versions. requirements.txt is a generated compatibility export, not a second hand-maintained dependency list.

```bash
uv run ruff check .
uv run ruff format --check .
uv run pytest
uv run pytest --cov=app --cov-report=term-missing
uv export --locked --no-dev --no-hashes --no-emit-project --output-file requirements.txt
```

Coverage is configured for threads and greenlets because requests and asynchronous SQLAlchemy calls use both. Tests use temporary, isolated file databases and enter the application's actual startup/shutdown lifecycle. They never seed or reset a user's database.

## Database location and upgrades

New installations use the OS application-data directory:

- Windows: %LOCALAPPDATA%/ArcadeNexus
- macOS: ~/Library/Application Support/ArcadeNexus
- Linux: ~/.local/share/ArcadeNexus, respecting XDG_DATA_HOME

An existing backend/arcade_nexus.db takes precedence for compatibility. Set DATABASE_URL explicitly to choose another location. DATA_DIR controls the new-installation location.

Startup runs Alembic migrations before synchronizing the bundled game catalog. Revision 0001 describes the previous v1.4.1 schema. Revision 0002 adds session identities, nullable completion times, database constraints, and indexes. Revision 0003 adds bounded session measurements for jump, altitude and safe-flight achievements. A complete, unversioned v1.4.1 database is adopted automatically; partial or older schemas with missing columns fail with an explicit error rather than being silently stamped.

Before upgrading an existing file, the backend creates a SQLite backup next to it, such as arcade_nexus.pre-legacy.db or arcade_nexus.pre-0001.db. Subsequent attempts create additional backups instead of overwriting earlier ones. The SQLite backup API includes committed WAL data. Schema changes run in an explicit transaction; a failed migration rolls back instead of leaving half-upgraded tables.

```bash
# Upgrade without starting the HTTP server:
uv run python -m app.migrate
# Inspect migration history:
uv run alembic history
```

If legacy rows violate new constraints, startup stops and retains the original data and backup. Repair those rows deliberately or restore a valid backup; the backend does not silently discard or clamp user progress. Make an additional backup before any manual downgrade. Downgrading removes the new session identities and represents unfinished sessions as zero-duration historical records.

To restore, stop all backend processes, preserve the current database and its WAL/SHM files elsewhere, and replace it with the desired backup. Do not replace an actively used SQLite file.

SQLite connections enforce foreign keys, use WAL for file databases, and wait up to ten seconds for locks. A lock that outlasts that wait returns 503 with Retry-After: 1. Normal file databases use connection pooling; shared in-memory databases use StaticPool.

## Profiles and browser tabs

Profiles are local player identities, not authenticated accounts. No signing secret is used.

Create/select a profile before requesting player data. When none is selected, player endpoints return 409 instead of silently creating a new Player. Deleting a profile is a soft deletion: progress remains stored and the username remains reserved. Removing a game from the library only removes membership, not its saves or statistics.

Player endpoints accept X-Profile-ID. An invalid or deleted explicit profile returns 404; the backend never substitutes another profile. Without the header, the selected profile is used for compatibility with older clients.

The current frontend pins each tab to its own selected profile, captures that identity at game launch, and sends it on all player requests. Older clients without the header still share the backend default.

## Sessions and retry safety

Existing /start and /session requests remain supported. Starting a game now creates an unfinished session record; history includes completed records only. The start response adds session_id and profile_id without removing existing fields.

For safe retries, generate a UUID before starting and reuse it on completion:

```typescript
const api = 'http://localhost:8000/api';
const sessionId = crypto.randomUUID();
const headers = {
  'Content-Type': 'application/json',
  'X-Profile-ID': String(profileId),
};

await fetch(api + '/stats/snake/start', {
  method: 'POST', headers,
  body: JSON.stringify({ session_id: sessionId }),
});

await fetch(api + '/stats/snake/session', {
  method: 'POST', headers,
  body: JSON.stringify({
    session_id: sessionId,
    playtime_seconds: 30,
    score: 50,
    difficulty: 'normal',
  }),
});
```

Repeating a start UUID does not increment the session counter twice. Repeating an identical completion does not add playtime twice. Changing an already completed payload returns 409. A session cannot be completed for another profile or game.

Legacy requests without an ID finish the most recent unfinished session for that profile/game. A standalone legacy completion is also accepted, retaining the old behavior that completion does not increment the start counter. These requests cannot provide reliable deduplication or distinguish simultaneous sessions in different tabs. The current frontend uses session IDs and retains failed completion submissions for retry.

Playtime measures client-reported active seconds and is bounded to one week per completion. Score is bounded to a nonnegative signed 32-bit integer, and difficulty is easy, normal, or hard. Started sessions retain their real start timestamp; standalone legacy records infer one from duration. Sessions still need frontend checkpoints and crash recovery.

Finishing a previously started session remains possible after its game is retired. New starts and new save writes require an active game. Historical saves and statistics remain readable, and retired-game saves can be deleted.

## Saves

There are five slots per profile/game. POST creates or atomically replaces a slot. PUT requires an existing slot and retains optional metadata when omitted; explicit null clears it. Save IDs and original creation times survive overwrites.

JSON payloads are limited to 100 KiB of UTF-8 serialized data, reject non-finite values, and thumbnails have a separate size limit. The complete request body is limited to one MiB, including streamed/chunked bodies. All timestamps are returned as UTC.

The backend preserves the supplied state; the game SDK must serialize and validate the actual simulation. It cannot reconstruct snake positions or obstacles from a score-only frontend payload. Versioned game save formats and SDK restoration remain frontend work.

## Achievements and catalog

Score achievements require a qualifying submitted high score or completed session score. Unlocks are idempotent and scoped to the profile. Existing awards survive upgrades, even if the older API allowed an unqualified unlock.

First Byte requires a recorded score of 10. First-jump uses the recorded jumps measurement. Orbit requires max_altitude of 5000; Ace requires a completed duration of at least 600 seconds with crashed=false. SessionRecord accepts a bounded metrics object containing jumps, max_altitude and crashed; extra fields are rejected, and metrics participate in immutable completion replay checks. Achievement responses include unlock_condition so clients can discover conditions instead of guessing from slugs. Recorded browser measurements and scores are client-controlled; local validation is not anti-cheat.

Game creation is disabled by default. ALLOW_GAME_CREATION=true enables metadata creation for development; it does not install JavaScript game modules, and games absent from the bundled catalog are deactivated at the next catalog sync. Catalog sync never mutates the seed definitions and preserves progress for removed games.

Game search treats percent, underscore, and backslash literally. Catalog pagination uses skip and limit and returns total. Session history also supports skip and limit. Library and achievement endpoints retain their current response shapes, with optional pagination; achievement total/unlocked_count describe the full matching set.

## Local request protections

The launcher binds to loopback by default. Trusted hosts and browser origins are explicit. Mutation requests with an unapproved Origin are rejected even if the browser would otherwise hide the response. Browser requests from the API's own origin are accepted. CORS allows Content-Type and X-Profile-ID; no cookies or credentials are required.

These controls do not authenticate local programs. Keep HOST at 127.0.0.1 for normal use. HTTP API errors avoid exposing SQL statements or echoing full save payloads. Runtime errors are logged locally.

See REVIEW.md for the file-by-file findings and remaining integration work.
