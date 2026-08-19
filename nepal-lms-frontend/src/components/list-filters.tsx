import { Filter, Search } from "lucide-react";
import { Button, ButtonLink } from "@/components/ui";
import { cn } from "@/lib/utils";

export type ListFilterField = {
  name: string;
  label: string;
  value?: string;
  options: Array<{ value: string; label: string }>;
};

export function ListFilters({
  searchValue = "",
  searchPlaceholder,
  fields = [],
  resetHref,
  className,
}: {
  searchValue?: string;
  searchPlaceholder: string;
  fields?: ListFilterField[];
  resetHref: string;
  className?: string;
}) {
  const active = Boolean(searchValue.trim() || fields.some((field) => field.value));
  return (
    <form method="get" role="search" className={cn("flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between", className)}>
      <label className="flex h-11 min-w-0 items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 xl:w-80">
        <Search className="h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
        <span className="sr-only">Search records</span>
        <input
          // Canonical name across the product; searchTerm() still accepts ?q= .
          name="search"
          defaultValue={searchValue}
          maxLength={100}
          className="min-w-0 flex-1 bg-transparent text-sm outline-none"
          placeholder={searchPlaceholder}
        />
      </label>
      <div className="flex flex-wrap gap-2">
        {fields.map((field) => (
          <label key={field.name}>
            <span className="sr-only">{field.label}</span>
            <select
              name={field.name}
              aria-label={field.label}
              defaultValue={field.value || ""}
              className="h-11 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-700 outline-none transition focus:border-brand-600 focus:ring-2 focus:ring-brand-100"
            >
              {field.options.map((option) => <option key={`${field.name}:${option.value}`} value={option.value}>{option.label}</option>)}
            </select>
          </label>
        ))}
        {active ? <ButtonLink href={resetHref} variant="outline">Reset</ButtonLink> : null}
        <Button type="submit"><Filter className="h-4 w-4" />Apply</Button>
      </div>
    </form>
  );
}
