import { db } from "@/lib/db";
import { requirePage } from "@/lib/auth";
import { qty } from "@/lib/format";
import { FilterBar, PageHeader, TableWrap } from "@/components/ui";
import { ActionForm, PrintButton, Submit } from "@/components/forms";
import { saveStockCheck } from "@/actions/inventory";

export const metadata = { title: "Physical stock check" };

export default async function StockCheckPage({ searchParams }: { searchParams: Promise<{ category?: string; location?: string }> }) {
  await requirePage("inventory");
  const sp = await searchParams;
  const categories = await db.category.findMany({ orderBy: { name: "asc" } });
  const products = await db.product.findMany({
    where: {
      active: true,
      ...(sp.category ? { categoryId: Number(sp.category) } : {}),
      ...(sp.location ? { location: { contains: sp.location } } : {}),
    },
    orderBy: [{ location: "asc" }, { name: "asc" }],
    select: { id: true, name: true, sku: true, stock: true, location: true, size: true, color: true, unit: true },
  });
  return (
    <>
      <PageHeader
        title="Physical stock check"
        subtitle="Count what is actually on the shelf. Leave a box empty to skip that item. Differences are corrected and logged."
        back="/inventory"
        actions={<PrintButton label="Print count sheet" />}
      />
      <FilterBar>
        <label>
          <span className="label">Category</span>
          <select name="category" defaultValue={sp.category ?? ""} className="input">
            <option value="">All</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </label>
        <label><span className="label">Rack / location</span><input name="location" defaultValue={sp.location} className="input" placeholder="Rack A" /></label>
      </FilterBar>
      <ActionForm action={saveStockCheck}>
        <div className="card">
          <TableWrap>
            <table className="table">
              <thead><tr><th>Location</th><th>Product</th><th>SKU</th><th className="text-right">System stock</th><th className="w-36">Counted</th></tr></thead>
              <tbody>
                {products.map((p) => (
                  <tr key={p.id}>
                    <td className="text-xs">{p.location ?? "—"}</td>
                    <td>{p.name}{p.size && <span className="text-xs text-gray-500"> · {p.size}</span>}{p.color && <span className="text-xs text-gray-500"> · {p.color}</span>}</td>
                    <td className="font-mono text-xs">{p.sku}</td>
                    <td className="text-right tabular-nums">{qty(p.stock)} {p.unit.toLowerCase()}</td>
                    <td><input name={`count_${p.id}`} type="number" min="0" step="1" className="input py-1" /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableWrap>
        </div>
        <div className="mt-4 flex justify-end no-print">
          <Submit confirm="Update stock to the counted quantities?">Save stock check</Submit>
        </div>
      </ActionForm>
    </>
  );
}
