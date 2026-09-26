# Privacy Policy for Arcade Nexus

**Last Updated:** 2026-10-20

Arcade Nexus runs a browser console and a local server on your computer. This document describes the information they store and exchange.

## 1. Local player data

Player names and avatars, favorites, saves, results, playtime, records, and achievements are stored in a local SQLite database. Profiles separate household players; they are not online accounts or authentication.

## 2. Browser storage

The browser stores preferences, the active player selection, pending results, recovery data, and a bounded history of local performance measurements. Storage belongs to the browser origin. Changing browsers, profiles, or ports can make that browser data unavailable. If persistent storage fails, the open tab may retain unsaved data in memory until it is exported or saved.

## 3. Network behavior

The browser sends gameplay and profile requests to the local server. The default server address is `127.0.0.1`; keep it on loopback for trusted household use. Normal play uses bundled assets and fonts and does not require Internet access after setup.

Installing dependencies requires Internet access. Opening an external source, support, or library link uses your browser and the destination's own data practices. The repository README includes remotely hosted status badges. The static project website uses bundled fonts and images.

## 4. Analytics and advertising

The application has no advertising, third-party analytics, or remote telemetry integration. The optional FPS and rendering measurements shown in Settings remain local unless you export or share them.

## 5. Backups and exported files

JSON exports can contain player names, progress, preferences, saves, and pending results. Server snapshots contain server-saved data and are stored beside the selected database. You control exported files and any sharing of them. Import creates player copies while preserving existing players; browser preferences may be replaced after confirmation.

## 6. Data removal and limitations

Profiles can be managed through the console. To remove all retained data, stop the server and remove the selected database and its backups, then clear storage for the console's browser origin and any exported files you no longer need. Profile deletion alone does not remove previously created snapshots or exports. Local storage is not encrypted by the application.

## 7. Source and policy changes

The source is available for inspection on [GitHub](https://github.com/qtremors/arcade-nexus). This policy should change whenever data storage, network behavior, or integrations change.

---

[Back to README](README.md)
