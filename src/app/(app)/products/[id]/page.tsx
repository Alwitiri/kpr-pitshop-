import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requirePage } from "@/lib/auth";
import { canSeeProfit } from "@/lib/roles";
import { getSettings } from "@/lib/server-utils";
import { fmtDateTime, money, qty } from "@/lib/format";
import { label } from "@/lib/calc";
import { Badge, PageHeader, Section, Stat, TableWrap } from "@/components/ui";
import { ProductForm } from "@/components/product-form";
import { Barcode } from "@/components/barcode";
import { deleteProduct } from "@/actions/products";
import { Submit } from "@/components/forms";

export default async function ProductPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ saved?: string }> }) {
  const s = await requirePage("products");
  const id = Number((await params).id);
  const sp = await searchParams;
  const p = await db.product.findUnique({ where: { id }, include: { fitments: true, category: true, brand: true } });
  if (!p) notFound();

  const [categories, brands, suppliers, settings, movements, sold, variants] = await Promise.all([
    db.category.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    db.brand.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    db.supplier.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    getSettings(),
    db.stockMovement.findMany({ where: { productId: id }, orderBy: { createdAt: "desc" }, take: 25, include: { user: { select: { name: true } } } }),
    db.saleItem.aggregate({ where: { productId: id, sale: { status: { not: "CANCELLED" } } }, _sum: { qty: true, total: true, returnedQty: true } }),
    p.variantGroup
      ? db.product.findMany({ where: { variantGroup: p.variantGroup, id: { not: id } }, select: { id: true, name: true, size: true, color: true, stock: true } })
      : Promise.resolve([]),
  ]);
  const profit = canSeeProfit(s.role);
  const st = p.stock <= 0 ? "OUT" : p.stock <= p.minStock ? "LOW" : "OK";

  return (
    <>
      <PageHeader
        title={p.name}
        subtitle={<span className="font-mono">{p.sku}</span>}
        back="/products"
        actions={
          <>
            <Link href={`/inventory/adjust?product=${p.id}`} className="btn-outline">Adjust stock</Link>
            <Link href={`/products/labels?ids=${p.id}`} className="btn-outline">Print label</Link>
            <form action={deleteProduct}>
              <input type="hidden" name="id" value={p.id} />
              <Submit className="btn-danger" confirm="Delete this product? If it has sales/purchases it will be deactivated instead.">Delete</Submit>
            </form>
          </>
        }
      />
      {sp.saved && <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">Product created.</div>}

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="In stock" value={<Badge status={st}>{qty(p.stock)} {p.unit.toLowerCase()}</Badge>} hint={`Alert below ${qty(p.minStock)}`} />
        <Stat label="Units sold (all time)" value={qty((sold._sum.qty ?? 0) - (sold._sum.returnedQty ?? 0))} />
        <Stat label="Sales value" value={money(sold._sum.total)} />
        {profit && <Stat label="Stock value (cost)" value={money(p.stock * p.purchasePrice)} />}
      </div>

      <div className="grid gap-5 xl:grid-cols-[1fr_360px]">
        <ProductForm
          p={{ ...p, fitments: p.fitments }}
          categories={categories}
          brands={brands}
          suppliers={suppliers}
          defaultMinStock={settings.defaultMinStock}
        />
        <div className="space-y-5">
          <Section title="Barcode">
            <div className="flex flex-col items-center gap-3">
              <Barcode value={p.barcode || p.sku} />
              {p.imageUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={p.imageUrl} alt={p.name} className="max-h-48 rounded-lg border object-contain" />
              )}
            </div>
          </Section>
          {variants.length > 0 && (
            <Section title={`Other variants · ${p.variantGroup}`} pad={false}>
              <ul className="divide-y divide-gray-100 text-sm">
                {variants.map((v) => (
                  <li key={v.id} className="flex justify-between px-4 py-2">
                    <Link className="link" href={`/products/${v.id}`}>{[v.size, v.color].filter(Boolean).join(" · ") || v.name}</Link>
                    <span className="tabular-nums">{qty(v.stock)}</span>
                  </li>
                ))}
              </ul>
            </Section>
          )}
          <Section title="Stock history" pad={false} actions={<Link className="link text-xs" href={`/inventory/movements?product=${p.id}`}>View all</Link>}>
            <TableWrap>
              <table className="table">
                <tbody>
                  {movements.map((m) => (
                    <tr key={m.id}>
                      <td className="text-xs">
                        <div className="font-medium">{label(m.type)}</div>
                        <div className="text-gray-500">{fmtDateTime(m.createdAt)}{m.user ? ` · ${m.user.name}` : ""}</div>
                      </td>
                      <td className={`text-right font-semibold tabular-nums ${m.qty < 0 ? "text-red-600" : "text-emerald-600"}`}>
                        {m.qty > 0 ? "+" : ""}{qty(m.qty)}
                      </td>
                      <td className="text-right text-xs text-gray-500 tabular-nums">{qty(m.balanceAfter)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableWrap>
          </Section>
        </div>
      </div>
    </>
  );
}
