import { db } from "@/lib/db";
import { requirePage } from "@/lib/auth";
import { PageHeader, Section } from "@/components/ui";
import { ActionForm, Submit } from "@/components/forms";
import { deleteMaster, saveBrand, saveCategory } from "@/actions/products";

export const metadata = { title: "Categories & brands" };

export default async function MastersPage() {
  await requirePage("products");
  const [categories, brands] = await Promise.all([
    db.category.findMany({ orderBy: { name: "asc" }, include: { _count: { select: { products: true } } } }),
    db.brand.findMany({ orderBy: { name: "asc" }, include: { _count: { select: { products: true } } } }),
  ]);
  return (
    <>
      <PageHeader title="Categories & brands" back="/products" />
      <div className="grid gap-5 lg:grid-cols-2">
        <Section title={`Categories (${categories.length})`}>
          <ActionForm action={saveCategory} resetOnSuccess className="mb-4">
            <div className="flex gap-2">
              <input name="name" className="input" placeholder="New category name" required />
              <select name="type" className="input w-32">
                <option value="BOTH">Bike & Car</option>
                <option value="BIKE">Bike</option>
                <option value="CAR">Car</option>
              </select>
              <Submit>Add</Submit>
            </div>
          </ActionForm>
          <ul className="divide-y divide-gray-100">
            {categories.map((c) => (
              <li key={c.id} className="flex items-center justify-between py-2 text-sm">
                <span>
                  {c.name} <span className="text-xs text-gray-400">· {c.type.toLowerCase()} · {c._count.products} items</span>
                </span>
                {c._count.products === 0 && (
                  <form action={deleteMaster}>
                    <input type="hidden" name="id" value={c.id} />
                    <input type="hidden" name="kind" value="category" />
                    <button className="text-xs text-red-600 hover:underline">Delete</button>
                  </form>
                )}
              </li>
            ))}
          </ul>
        </Section>
        <Section title={`Brands (${brands.length})`}>
          <ActionForm action={saveBrand} resetOnSuccess className="mb-4">
            <div className="flex gap-2">
              <input name="name" className="input" placeholder="New brand name" required />
              <Submit>Add</Submit>
            </div>
          </ActionForm>
          <ul className="divide-y divide-gray-100">
            {brands.map((c) => (
              <li key={c.id} className="flex items-center justify-between py-2 text-sm">
                <span>
                  {c.name} <span className="text-xs text-gray-400">· {c._count.products} items</span>
                </span>
                {c._count.products === 0 && (
                  <form action={deleteMaster}>
                    <input type="hidden" name="id" value={c.id} />
                    <input type="hidden" name="kind" value="brand" />
                    <button className="text-xs text-red-600 hover:underline">Delete</button>
                  </form>
                )}
              </li>
            ))}
          </ul>
        </Section>
      </div>
    </>
  );
}
