import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { db, like } from "@/lib/db";
import { requirePage } from "@/lib/auth";
import { canSeeProfit } from "@/lib/roles";
import { money, qty } from "@/lib/format";
import { Badge, Empty, FilterBar, PageHeader, Pager, TableWrap, qs } from "@/components/ui";
import { ExportCsv } from "@/components/forms";

export const metadata = { title: "Products" };
const PER = 50;

export default async function ProductsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const s = await requirePage("products");
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const q = sp.q?.trim();

  const where: Prisma.ProductWhereInput = { active: sp.status === "inactive" ? false : true };
  if (q) where.OR = [{ name: like(q) }, { sku: like(q) }, { barcode: q }, { variantGroup: like(q) }];
  if (sp.category) where.categoryId = Number(sp.category);
  if (sp.brand) where.brandId = Number(sp.brand);
  if (sp.make || sp.model) {
    where.fitments = { some: { ...(sp.make ? { make: like(sp.make) } : {}), ...(sp.model ? { model: like(sp.model) } : {}) } };
  }

  let products = await db.product.findMany({
    where,
    include: { category: true, brand: true, fitments: true },
    orderBy: { name: "asc" },
  });
  if (sp.stock === "low") products = products.filter((p) => p.stock > 0 && p.stock <= p.minStock);
  if (sp.stock === "out") products = products.filter((p) => p.stock <= 0);

  const total = products.length;
  const rows = products.slice((page - 1) * PER, page * PER);
  const [categories, brands] = await Promise.all([
    db.category.findMany({ orderBy: { name: "asc" } }),
    db.brand.findMany({ orderBy: { name: "asc" } }),
  ]);
  const profit = canSeeProfit(s.role);

  return (
    <>
      <PageHeader
        title="Products"
        subtitle={`${total} items`}
        actions={
          <>
            <ExportCsv
              filename="products.csv"
              rows={[
                ["name", "sku", "barcode", "category", "brand", "size", "color", "hsn", "purchase_price", "selling_price", "mrp", "gst_rate", "stock", "min_stock", "warranty_months", "location"],
                ...products.map((p) => [p.name, p.sku, p.barcode, p.category?.name, p.brand?.name, p.size, p.color, p.hsn, profit ? p.purchasePrice : "", p.sellingPrice, p.mrp, p.gstRate, p.stock, p.minStock, p.warrantyMonths, p.location]),
              ]}
            />
            <Link href="/products/labels" className="btn-outline">Barcode labels</Link>
            <Link href="/products/import" className="btn-outline">Import</Link>
            <Link href="/products/masters" className="btn-outline">Categories & brands</Link>
            <Link href="/products/new" className="btn-primary">+ New product</Link>
          </>
        }
      />
      <FilterBar>
        <label className="min-w-52 flex-1">
          <span className="label">Search</span>
          <input name="q" defaultValue={q} className="input" placeholder="Name, SKU, barcode…" />
        </label>
        <label>
          <span className="label">Category</span>
          <select name="category" defaultValue={sp.category ?? ""} className="input">
            <option value="">All</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </label>
        <label>
          <span className="label">Brand</span>
          <select name="brand" defaultValue={sp.brand ?? ""} className="input">
            <option value="">All</option>
            {brands.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </label>
        <label>
          <span className="label">Stock</span>
          <select name="stock" defaultValue={sp.stock ?? ""} className="input">
            <option value="">All</option>
            <option value="low">Low stock</option>
            <option value="out">Out of stock</option>
          </select>
        </label>
        <label className="w-36">
          <span className="label">Fits make</span>
          <input name="make" defaultValue={sp.make} className="input" placeholder="Royal Enfield" />
        </label>
        <label className="w-36">
          <span className="label">Fits model</span>
          <input name="model" defaultValue={sp.model} className="input" placeholder="Classic 350" />
        </label>
        <label>
          <span className="label">Status</span>
          <select name="status" defaultValue={sp.status ?? ""} className="input">
            <option value="">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </label>
      </FilterBar>

      <div className="card">
        <TableWrap>
          <table className="table">
            <thead>
              <tr>
                <th>Product</th>
                <th>SKU</th>
                <th>Category / Brand</th>
                <th>Fits</th>
                {profit && <th className="text-right">Cost</th>}
                <th className="text-right">Price</th>
                <th className="text-right">GST</th>
                <th className="text-right">Stock</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => {
                const st = p.stock <= 0 ? "OUT" : p.stock <= p.minStock ? "LOW" : "OK";
                return (
                  <tr key={p.id}>
                    <td>
                      <Link href={`/products/${p.id}`} className="link">{p.name}</Link>
                      {(p.size || p.color) && <div className="text-xs text-gray-500">{[p.size, p.color].filter(Boolean).join(" · ")}</div>}
                    </td>
                    <td className="font-mono text-xs">{p.sku}</td>
                    <td className="text-xs">
                      {p.category?.name ?? "—"}
                      <div className="text-gray-500">{p.brand?.name}</div>
                    </td>
                    <td className="max-w-48 text-xs text-gray-600">
                      {p.fitments.length ? p.fitments.map((f) => `${f.make} ${f.model ?? ""}`.trim()).join(", ") : <span className="text-gray-400">Universal</span>}
                    </td>
                    {profit && <td className="text-right tabular-nums">{money(p.purchasePrice)}</td>}
                    <td className="text-right font-medium tabular-nums">{money(p.sellingPrice)}</td>
                    <td className="text-right">{p.gstRate}%</td>
                    <td className="text-right">
                      <Badge status={st}>{qty(p.stock)} {p.unit.toLowerCase()}</Badge>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </TableWrap>
        {rows.length === 0 && <Empty>No products match. <Link className="link" href="/products/new">Add a product</Link></Empty>}
        <Pager page={page} pages={Math.ceil(total / PER)} base={`/products${qs(sp)}`} />
      </div>
    </>
  );
}
