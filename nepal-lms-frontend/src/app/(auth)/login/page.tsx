import { LoginForm } from "@/components/auth-forms";
import { redirectIfAuthenticated } from "@/lib/auth/server";

export default async function LoginPage() {
  // Already signed in? Go to the portal instead of showing the form again.
  await redirectIfAuthenticated();

  return (
    <>
      <p className="text-sm font-bold uppercase tracking-[0.14em] text-brand-700">Welcome back</p>
      <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-950">Login to your workspace</h1>
      <p className="mt-3 text-sm leading-6 text-slate-600">Students, teachers and staff use the same secure login.</p>
      <LoginForm />
    </>
  );
}
