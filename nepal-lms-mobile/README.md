# Aimers Zone — Mobile

The native mobile client for the same LMS as `nepal-lms-api` (backend) and
`nepal-lms-frontend` (web). Same backend, same permissions, same data —
this is a third, independent client, not a wrapped copy of the website.

**Status:** scaffolding complete, no real feature screens built yet. See
[`docs/ROADMAP.md`](docs/ROADMAP.md) for the phased build plan and
[`docs/FEATURE-AUDIT.md`](docs/FEATURE-AUDIT.md) for what from the web app
is (and isn't) in scope for mobile.

## Stack

Expo (React Native, New Architecture) + Expo Router + TypeScript +
NativeWind (Tailwind, same palette as the web app) + TanStack Query +
Zustand + `expo-secure-store`. Full rationale in
[`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

## Before you run it

1. **Copy the env file** and point it at your API:

   ```bash
   cp .env.example .env
   ```

   A physical phone cannot reach `127.0.0.1` or `localhost` — that resolves
   to the phone itself. Put your dev machine's LAN IP in `.env` instead
   (`ipconfig` / `ifconfig`), and make sure the phone and the API are on the
   same Wi-Fi network. `localhost` only works from an emulator/simulator or
   `expo start --web`.

2. **This project needs a Development Build, not Expo Go.** `react-native-keyboard-controller`
   ships native code Expo Go doesn't include, and push notifications
   (Phase 6) will need one too regardless. Build one once per device:

   ```bash
   npx expo run:android   # or: npx expo run:ios (macOS only)
   ```

   After that, `npx expo start` reconnects to the same install for
   day-to-day work — you don't rebuild every time, only when a native
   dependency changes.

3. **The backend has no mobile login endpoint yet.** Sanctum's current auth
   is cookie-session (built for the web SPA); this app expects a token-based
   login. The login screen is already wired to call it — it will 404 until
   Phase 1's backend work lands. See `docs/ROADMAP.md` Phase 1 and
   `src/lib/auth/api.ts`.

## Running

```bash
npm install
npx expo start
```

- `npm run android` / `npm run ios` — open in an emulator/simulator directly.
- `npm run web` — runs in a browser too (Expo Router + NativeWind both
  support web output), useful for a fast look at layout without a device.
- `npm run lint` — ESLint (`eslint-config-expo`).
- `npx tsc --noEmit` — typecheck.

## Project layout

```
src/
  app/                 Expo Router routes (file-based; folder = URL segment,
                        (parens) = route group, invisible in the URL)
    (auth)/             guest-only: login
    (student)/          role-guarded, one folder per portal
    (teacher)/
    (staff)/
    (admin)/
  components/          Shared presentational components
  lib/
    api/                Typed fetch client + shared response/error contracts
    auth/               Session store (Zustand), token storage, role guards
    query-client.ts     TanStack Query defaults
  constants/           Theme tokens (for native APIs that need a raw color,
                        not a className) and env config
```

See `docs/ARCHITECTURE.md` for why each piece is shaped this way.

## Known, accepted `npm audit` findings

The audit flags Metro/Expo CLI's own build-time tooling (an image parser
used while bundling), not runtime app code. The fix path offered would
downgrade Expo to an older SDK, which is a worse trade than the advisory
itself — left as-is deliberately.
