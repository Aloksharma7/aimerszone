# Coding standards

The "smooth, fast, never laggy" requirement is a specific engineering target,
not a slogan — this document is the concrete checklist for hitting it,
plus the project's naming/structure conventions.

## Performance — apply these by default, not as an afterthought

**Lists.** Never `.map()` a growable list into a `ScrollView` — every row
mounts at once, and it gets worse linearly as data grows. Use `FlatList`
for anything small and fixed-ish; use `@shopify/flash-list` (already
installed) for anything that can grow past a screenful — students,
payments, notifications, receipts. FlashList recycles views instead of
mounting every row; the difference is very visible on a mid-range Android
phone with a few hundred rows, invisible with five.

**Images.** Use `expo-image`'s `<Image>`, not the core React Native one —
it caches to disk and memory and decodes off the JS thread. Always set an
explicit `contentFit` and a `placeholder`/`blurhash` for anything loaded
over the network (course thumbnails, avatars) so a slow connection shows a
placeholder instead of a blank gap that then pops in.

**Re-renders.** A component re-rendering when its actual visible output
hasn't changed is the single most common source of "feels laggy" in RN.
Before assuming a screen needs `useMemo`/`useCallback`/`React.memo`,
actually check with the React DevTools Profiler (`npx expo start`, press
`j` for the JS debugger, or the standalone React DevTools) — optimizing
without measuring first tends to add complexity in the wrong places.

**Animations.** Anything that animates (transitions, gestures, loading
states) should run on the UI thread via Reanimated (already installed as an
Expo/Router dependency) rather than driving it from JS-thread state — a
JS-thread animation drops frames the moment anything else on that thread is
busy (a fetch resolving, a list re-rendering), which reads as stutter.

**Navigation.** Expo Router's default stack is already native-stack-backed
(native transitions, not JS-driven ones) — don't reach for a custom
transition unless there's a specific, demonstrated reason to.

**Bundle/startup.** Keep an eye on Metro's bundle output size printed by
`expo export` (checked into CI eventually, or just glanced at per release)
— a startup-time regression is much easier to catch by watching the trend
than by waiting for a user to complain the app feels slow to open.

## Data fetching

- Every server read goes through TanStack Query, not a raw `useEffect` +
  `useState` fetch — that's what gives caching, retry, and
  refetch-on-reconnect for free, and it's the same mental model as the web
  app.
- Mutations invalidate the specific query keys they affect, not a blanket
  refetch-everything — mirrors the "invalidate the specific cache tag, not
  the whole cache" discipline already established on the web backend.
- `apiFetch`'s error shape (`NormalizedApiError`) is the only error type
  code should branch on. Don't parse `error.message` strings to decide
  behavior — check `error.code`.

## Project conventions

- **File naming:** kebab-case for files (`session-store.ts`,
  `sign-out-button.tsx`), matching the web app.
- **Path alias:** `@/` maps to `src/` (matches web's own `@/` → `src/`
  convention) — never a relative `../../../` chain.
- **One state store.** Global client state lives in the one Zustand store
  in `lib/auth/session-store.ts` unless a genuinely separate concern comes
  up. Resist the urge to spin up a new store per feature — most "global"
  state in this app is actually server state and belongs in TanStack Query,
  not Zustand.
- **Styling.** NativeWind `className` is the only styling approach — don't
  mix in `StyleSheet.create` for new components unless something is
  provably impossible in NativeWind (rare). Two parallel styling systems in
  one codebase is a maintenance cost with no offsetting benefit here.
- **Types over `any`.** The API client is fully generic
  (`apiFetch<T>(...)`)  — every call site should supply a real response
  type, mirrored from the backend's actual JSON shape, not `any` or a loose
  `Record<string, unknown>`.
- **Screens vs. components.** A file under `src/app/` is a route and should
  mostly compose components, not contain large inline JSX trees — pull
  anything reused (or just large) into `src/components/`.
