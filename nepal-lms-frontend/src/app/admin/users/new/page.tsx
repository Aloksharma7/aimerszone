import { CreateUserForm } from "@/components/admin/create-user-form";
import { PageHeader } from "@/components/ui";

export default function AdminCreateUserPage() {
  return (
    <>
      <PageHeader back={{ href: "/admin/users", label: "All users" }}
        eyebrow="Identity and access"
        title="Create an account"
        description="Add a teacher, staff, admin or super admin account. Every new account must set its own password at first sign-in."
      />
      <CreateUserForm />
    </>
  );
}
