import { SimpleAuthForm } from "@/components/auth-forms";
import { redirectIfAuthenticated } from "@/lib/auth/server";

export default async function Page() {
  await redirectIfAuthenticated();

  return <SimpleAuthForm type="reset" />;
}
