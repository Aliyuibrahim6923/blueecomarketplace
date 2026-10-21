import type { Metadata } from "next";
import { ActionForm } from "@/components/form/action-form";
import { CheckboxField, SubmitButton, TextField } from "@/components/form/fields";
import { Card, CardContent, CardHeader, CardTitle, PageHeader } from "@/components/ui/primitives";
import { saveCategoryAction } from "@/features/admin/actions";
import { createClient } from "@/lib/supabase/server";
import type { Category } from "@/types/domain";

export const metadata: Metadata = { title: "Categories" };

export default async function AdminCategoriesPage() {
  const supabase = await createClient();
  const { data } = await supabase.from("categories").select("*").order("sort_order");
  const categories = (data ?? []) as Category[];
  return (
    <>
      <PageHeader title="Product categories" description="Deactivate a category to hide it from new listings and filters. Changes are audited." />
      <div className="grid gap-4 lg:grid-cols-2">
        {categories.map((c) => (
          <Card key={c.id}>
            <CardContent>
              <ActionForm action={saveCategoryAction} hidden={{ id: c.id }}>
                <div className="grid gap-3 sm:grid-cols-2">
                  <TextField name="name" label="Name" defaultValue={c.name} required />
                  <TextField name="slug" label="Slug" defaultValue={c.slug} required />
                </div>
                <TextField name="description" label="Description" defaultValue={c.description ?? ""} />
                <div className="flex flex-wrap items-end gap-4">
                  <TextField name="sortOrder" label="Order" type="number" defaultValue={String(c.sort_order)} className="w-24" />
                  <CheckboxField name="isActive" label="Active" defaultChecked={c.is_active} />
                  <SubmitButton size="sm" variant="outline">
                    Save
                  </SubmitButton>
                </div>
              </ActionForm>
            </CardContent>
          </Card>
        ))}
        <Card>
          <CardHeader>
            <CardTitle>Add category</CardTitle>
          </CardHeader>
          <CardContent>
            <ActionForm action={saveCategoryAction} resetOnSuccess>
              <div className="grid gap-3 sm:grid-cols-2">
                <TextField name="name" label="Name" required />
                <TextField name="slug" label="Slug" required hint="lowercase-with-hyphens" />
              </div>
              <TextField name="description" label="Description" />
              <div className="flex flex-wrap items-end gap-4">
                <TextField name="sortOrder" label="Order" type="number" defaultValue={String(categories.length + 1)} className="w-24" />
                <CheckboxField name="isActive" label="Active" defaultChecked />
                <SubmitButton size="sm">Add</SubmitButton>
              </div>
            </ActionForm>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
