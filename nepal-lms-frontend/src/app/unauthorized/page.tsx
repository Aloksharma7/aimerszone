import { ArrowLeft, ShieldX } from "lucide-react";
import { ButtonLink } from "@/components/ui";
import { preferredPortalHome } from "@/lib/auth/roles";
import { getSessionUser } from "@/lib/auth/server";

/*
 * This page used to offer only "Return to login" and "Go to public site".
 *
 * Anyone reaching it is almost always already signed in — requirePermission()
 * redirects here — so the only routes out were to sign out or leave the
 * product entirely. It now sends them back to their own portal, and says who
 * can grant the access rather than describing the enforcement model.
 */
export default async function UnauthorizedPage() {
  const user = await getSessionUser();
  const home = user ? preferredPortalHome(user) : null;

  return (
    <main id="main-content" className="flex min-h-screen items-center justify-center bg-canvas px-4">
      <div className="w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-card sm:p-10">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-50 text-amber-700">
          <ShieldX className="h-8 w-8" />
        </div>
        <p className="mt-6 text-sm font-bold uppercase tracking-[0.16em] text-amber-700">Access denied</p>
        <h1 className="mt-3 text-3xl font-bold text-slate-950">You don&rsquo;t have access to this page</h1>
        <p className="mt-3 leading-7 text-slate-600">
          {user
            ? "Your account is signed in, but this page needs a permission your role doesn't include. An administrator can grant it if you need it."
            : "Sign in with an account that has access to this page."}
        </p>
        <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
          {home ? (
            <ButtonLink href={home}>
              <ArrowLeft className="h-4 w-4" />
              Back to my dashboard
            </ButtonLink>
          ) : (
            <ButtonLink href="/login">
              <ArrowLeft className="h-4 w-4" />
              Return to login
            </ButtonLink>
          )}
          <ButtonLink href={user ? "/student/support" : "/"} variant="outline">
            {user ? "Contact support" : "Go to public site"}
          </ButtonLink>
        </div>
      </div>
    </main>
  );
}
