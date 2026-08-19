# Fix: the login page renders while already signed in

You reported that `/login` still loads after signing in as an administrator.
That is a frontend gap, not a backend one — the `(auth)` route group has no
guest guard, so those pages render regardless of session state.

The backend already provides everything needed: `GET /api/v1/auth/me` returns
`portal_home` and `required_action`, and answers 401 when there is no session.

## 1. Add the helper

In `src/lib/auth/server.ts`, alongside `requirePortalAccess`:

```ts
/**
 * Guest-only pages. Sends an already-authenticated visitor to their portal
 * instead of showing a sign-in form they do not need.
 *
 * Pages that resolve a required action — change-password, two-factor-challenge,
 * verify-email — must NOT use this: those legitimately require a session.
 */
export async function redirectIfAuthenticated(): Promise<void> {
  const user = await getSessionUser();
  if (!user) return;

  // A pending required action wins: finish that before entering the portal.
  const requiredPath = requiredActionPath(user);
  if (requiredPath) redirect(requiredPath);

  redirect(preferredPortalHome(user));
}
```

`requiredActionPath` is already defined in that file but not exported — leave it
as-is; the helper sits in the same module.

## 2. Call it from the four guest pages

`src/app/(auth)/login/page.tsx`:

```tsx
import { LoginForm } from "@/components/auth-forms";
import { redirectIfAuthenticated } from "@/lib/auth/server";

export default async function LoginPage() {
  await redirectIfAuthenticated();
  return (
    <>
      {/* unchanged markup */}
      <LoginForm />
    </>
  );
}
```

Note the component becomes `async`. Do the same in:

- `src/app/(auth)/register/page.tsx`
- `src/app/(auth)/forgot-password/page.tsx`
- `src/app/(auth)/reset-password/page.tsx`

Do **not** add it to `change-password`, `two-factor-challenge` or
`verify-email`.

## 3. Why not middleware

`proxy.ts` only checks whether the session cookie is present, not whether it is
valid. Redirecting on cookie presence alone would trap someone with a stale
cookie in a loop between `/login` and their portal. Calling `/auth/me` from the
page asks the server the real question, and 401 correctly means "show the form".

## Related: returnTo

`requirePortalAccess` already sends unauthenticated visitors to
`/login?returnTo=...`, and `LoginForm` reads it through `safeInternalPath`.
That path is unaffected by this change — the guard only fires when a session
already exists.
