# Frontend

React/TypeScript console with lazy Canvas/WebGL games. From the repository root use `python arcade.py --setup`, then `python arcade.py --dev`; see [setup](../README.md) and [architecture](../DEVELOPMENT.md).

For frontend-only editing: `npm ci`, then `npm run dev` with the backend running on port 8000. `npm run lint`, `npm run test:unit`, and `npm run build` validate changes locally. `npx playwright install chromium` installs the browser for `npm run test:e2e`; the suite manages isolated servers and database data.

Game tuning and modes live in `../catalog.json`, loaders in `src/games/descriptors.ts`, session effects in `src/hooks/useGameSession.ts`, and presentation in `src/components/GameCanvas.tsx`. See the [SDK contract](src/sdk/README.md). No CI/CD is configured.
