# Manual acceptance and playtest

Automated checks cannot establish enjoyment, native GPU performance or physical-device compatibility. Use a fresh throwaway profile, export before testing an existing household, and record browser/OS/controller/display refresh rate.

1. After installing dependencies, disconnect Internet (keep loopback available), launch `python arcade.py`, and play all five titles. Stop/restart and verify players, favorites and saves remain.
2. Use only a controller to create a player with the on-screen keyboard, browse Games, start, pause, save, resume and quit. Unplug/reconnect during play. Verify no stuck motion or action leaks. Check a second controller model and Bluetooth/wired paths.
3. Abruptly terminate the browser during an active run, reopen the same origin, and Continue. Compare to the latest five-second snapshot. Repeat while the server is temporarily stopped; restart it and retry pending results.
4. Export, import as copies, and check restored slots, records, awards and preference values. Keep the original player and verify their data did not change.
5. Play all three Breakout sectors honestly. Record reaction difficulty, last-brick cleanup time, aiming fairness and earned medal. Compare easy/normal/hard records. Verify armor and explosive bricks are understandable.
6. Fly all twelve gates, then deliberately miss gates and crash. Compare scores. Test gentle analog adjustments and free-flight world cycling. Check gate readability against all backgrounds.
7. In 2048, lose with undo available; recover and continue. Reach 2048; keep playing. Compare challenge mode. Check Snake maze/sprint and Raptor obstacle reaction windows.
8. Test keyboard-only menus, 200% zoom, 800×600, system reduced motion, sound disabled, and visible focus. Check table sorting and modal focus returns.
9. Observe a new player without coaching for ten minutes. Note time to first play, objective comprehension, first failure, whether they restart voluntarily, confusion, frustration and comments about fairness. Do not label balance finished based solely on automated tests.
10. On a declared baseline laptop, capture cold launch and warm replay, frame p50/p95 (Settings export), browser heap snapshots after ten entry/restart/exit cycles, and input-to-visible-response video. Compare 60/120/144 Hz displays. Do not optimize based on software WebGL numbers from the test runner.

Record observations and concrete follow-ups in TASKS.md. There is no CI/CD requirement.
