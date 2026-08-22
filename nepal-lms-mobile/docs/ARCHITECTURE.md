# Architecture

This is the "why," not the "what" — read `README.md` first for how to run
the project.

## Stack and why each piece was chosen

| Concern | Choice | Why |
|---|---|---|
| Framework | Expo (managed, New Architecture, SDK 57) | Same React/TypeScript mental model the team already has from `nepal-lms-frontend`. New Architecture (Fabric/JSI) is the current default — no separate opt-in needed. Cloud builds (EAS) mean no Mac is required for iOS. |
| Navigation | Expo Router (file-based) | The current standard for new Expo projects — deep linking, typed routes and web parity come for free. A route's file path *is* its URL; `(group)` folders organize files without adding a URL segment. |
| Styling | NativeWind v4 (Tailwind for RN) | Lets `tailwind.config.js` hold the *exact* colors from the web app's `globals.css` — see the table below. Same utility-class mental model as the web codebase. |
| Server state | TanStack Query | Identical API to how it would be used on web. Caching, retry and refetch-on-reconnect come built in — matters more here than on web, since a phone's connection actually drops. |
| Client state | Zustand | One small store for the session (user, token, auth status). No reducers/boilerplate for something this size — Redux would be over-engineering for a single global slice. |
| Auth token storage | `expo-secure-store` for the token, in-memory (Zustand) for per-request reads | SecureStore is OS-level encrypted storage (Keychain/Keystore) — never `AsyncStorage`, which is plain text on disk. Reading SecureStore is async and hits the OS; doing that on *every* API call would add latency to every screen, so the token is read from memory and only persisted/reloaded at sign-in, sign-out and app cold start. |
| Forms | `react-hook-form` + `zod` | Uncontrolled-input performance (matters for typing latency on lower-end Android devices) plus schema validation that can be shared/mirrored with backend validation rules later. |
| Lists | `@shopify/flash-list` (once real lists exist) | Recycles views instead of mounting every row like `FlatList` does at scale — the difference is very visible on a long students/payments list on a mid-range phone. Small lists can stay on the plain `FlatList` that ships with React Native; this is a "when it matters" choice, not a blanket replacement. |
| Images | `expo-image` | Disk+memory caching and better decode performance than the core `Image` component — relevant the moment course thumbnails or avatars are on screen. |
| Icons | `@expo/vector-icons` (Feather set) | Bundled with Expo, zero extra native linking. Feather is a minimal line-icon set closest in feel to the web app's Lucide icons. |

## Auth: why it can't just reuse the web app's login

The web app uses Sanctum's **stateful cookie SPA** mode — a browser and the
API share a cookie on a trusted first-party origin, with CSRF protection on
top. A mobile app isn't a browser and doesn't participate in that flow.

Sanctum has a second, well-supported mode built for exactly this: **API
tokens** (`personal_access_tokens`, sent as `Authorization: Bearer <token>`).
That's what this app is built against. It is a genuinely small backend
addition — see `docs/ROADMAP.md` Phase 1 — because every permission/policy
check downstream is keyed off the authenticated user, not the auth
mechanism. Nothing about roles, permissions, or the business logic changes.

Flow as implemented in `src/lib/auth/`:

1. `login.tsx` calls `loginWithPassword()` → `POST /api/v1/auth/mobile-login`
   (does not exist on the backend yet) → expects `{ token, user }`.
2. The token is written to SecureStore and the Zustand store
   (`session-store.ts`); the user object is *not* persisted locally.
3. Every subsequent request reads the token from the in-memory store and
   sends it as a Bearer header (`lib/api/client.ts`).
4. On cold start, `hydrate()` reads the token from SecureStore, then
   re-fetches the user from `/api/v1/auth/me` before declaring the session
   "authenticated" — a role or permission change made from the web admin
   panel takes effect on the very next app open, never a stale local copy.
5. A 401 from any request clears the session — the navigation guards in
   each `(role)/_layout.tsx` then redirect to `/login` on the next render.
   No screen has to notice and handle a 401 itself.

## Media and file URLs

The web app's signed media links (payment proof, receipts, recordings) and
public asset URLs (thumbnails, avatars, branding) were both recently fixed
to return **relative** paths (`/media/...`, `/storage/...`), specifically so
they resolve against whatever origin the *browser* is already on and get
proxied by Next.js. A mobile app has no such proxy and no "current origin"
in that sense — it must prefix these paths with the real API base URL
(`API_BASE_URL` from `src/constants/config.ts`) itself. This is a real,
small adjustment to make wherever the app renders one of these URLs — not
a blocker, just don't copy the relative-path assumption from the web
codebase without prefixing it.

## Design tokens

`tailwind.config.js`'s `colors` block is a hand-copy of
`nepal-lms-frontend/src/app/globals.css`'s `--color-*` custom properties.
There is no shared package between the two repos yet — if the web palette
changes, this file needs the same edit made by hand. A `packages/theme`
shared workspace is a reasonable future step once both apps' needs are
stable enough that copy-paste drift becomes a real cost (see "Not done yet"
below) — introducing that machinery before then would be solving a problem
that doesn't exist yet.

## Folder structure

```
src/app/(role)/_layout.tsx   — Tabs navigator + useRequirePortalRole() guard
src/lib/auth/roles.ts        — role → portal-home mapping (mirrors web's
                                preferredPortalHome() / isAdminTier())
src/lib/auth/session-store.ts — the one Zustand store; token + user + status
src/lib/api/client.ts        — fetch wrapper: base URL, Bearer header,
                                error normalization matching the web app's
                                NormalizedApiError shape exactly
```

Admin currently gets its own route group rather than reusing staff's, unlike
the web app (where an admin viewing a staff screen keeps the admin chrome).
That's a deliberate simplification for the scaffold, not a final decision —
revisit once the admin portal is actually being built (Phase 5) and it's
clear how much actually overlaps.

## Not done yet (on purpose)

- **Shared types/contracts package** between web and mobile. Both currently
  hand-maintain their own copy of the API's shapes. Worth doing once mobile
  has enough screens that drift is a recurring papercut, not before.
- **Push notifications.** `expo-notifications` is installed but unwired —
  Phase 6. Needs a device-token registration endpoint on the backend and a
  send-path alongside the existing SMS channel.
- **Offline support.** TanStack Query's cache gives a small amount of this
  for free (a screen you already visited can render from cache on a flaky
  connection) but there's no deliberate offline-first design yet.
- **`app.config.ts` instead of static `app.json`.** Only worth the switch
  once there's an actual need for per-environment build config (different
  bundle ID/name for a staging build, for instance).
