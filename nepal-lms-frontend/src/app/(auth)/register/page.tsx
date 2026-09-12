import { RegisterForm } from "@/components/auth-forms";
import { redirectIfAuthenticated } from "@/lib/auth/server";

export default async function RegisterPage() {
  await redirectIfAuthenticated();

  return (
    <>
      <p className="text-sm font-bold uppercase tracking-[0.14em] text-brand-700">Student registration</p>
      <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-950">Create your learning account</h1>
      <p className="mt-3 text-sm leading-6 text-slate-600">Use a mobile number and email address you can access — you&apos;ll need both to sign in and recover your account.</p>
      <RegisterForm />
    </>
  );
}
