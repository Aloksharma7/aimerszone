import { FolderTree } from "lucide-react";
import { CategoryManager } from "@/components/admin/category-manager";
import { PageHeader } from "@/components/ui";
import { getAdminCategories } from "@/lib/data/admin";

export default async function StaffCategoriesPage() {
  const categories = await getAdminCategories("/api/v1/staff/categories");

  return (
    <>
      <PageHeader
        eyebrow="Catalogue"
        title="Course categories"
        description="Categories group courses on the public catalogue. At least one is needed before a course can be created."
        actions={
          <div className="flex h-11 items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-4 text-sm font-semibold text-slate-700">
            <FolderTree className="h-4 w-4" />
            {categories.length} {categories.length === 1 ? "category" : "categories"}
          </div>
        }
      />
      <CategoryManager categories={categories} endpointBase="/api/v1/staff/categories" />
    </>
  );
}
