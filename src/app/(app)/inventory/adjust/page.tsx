import Link from "next/link";
import { db } from "@/lib/db";
import { requirePage } from "@/lib/auth";
import { pickerProducts } from "@/lib/queries";
import { fmtDateTime, qty } from "@/lib/format";
import { label } from "@/lib/calc";
import { PageHeader, Section, TableWrap } from "@/components/ui";
import { ActionForm, Submit } from "@/components/forms";
import { ProductPicker } from "@/components/product-picker";
import { adjustStock } from "@/actions/inventory";

export const metadata = { title: "Adjust stock" };

export default async function AdjustPage({ searchParams }: { searchParams: Promise<{ product?: string }> }) {
  await requirePage("inventory");
  const pid = Number((await searchParams).product) || undefined;
  const [products, recent] = await Promise.all([
    pickerProducts(),
    db.stockMovement.findMany({
      where: { type: { in: ["ADJUSTMENT", "DAMAGE", "STOCK_CHECK"] } },
      include: { product: { select: { name: true, id: true } }, user: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
  ]);
  return (
    <>
      <PageHeader title="Adjust stock / record damage" back="/inventory" />
      <div className="grid gap-5 lg:grid-cols-[420px_1fr]">
        <Section title="New adjustment">
          <ActionForm action={adjustStock} className="space-y-4">
            <div>
              <span className="label">Product</span>
              <ProductPicker products={products} name="productId" defaultId={pid} />
            </div>
            <label className="block">
              <span className="label">Type</span>
              <select name="mode" className="input">
                <option value="ADD">Add stock (found / correction +)</option>
                <option value="REMOVE">Remove stock (lost / correction −)</option>
                <option value="DAMAGE">Damaged / defective</option>
                <option value="SET">Set exact stock</option>
              </select>
            </label>
            <label className="block">
              <span className="label">Quantity</span>
              <input name="qty" type="number" step="1" min="0" className="input" required />
            </label>
            <label className="block">
              <span className="label">Reason / note</span>
              <input name="note" className="input" placeholder="e.g. Helmet visor cracked" />
            </label>
            <Submit>Save adjustment</Submit>
          </ActionForm>
        </Section>
        <Section title="Recent adjustments" pad={false}>
          <TableWrap>
            <table className="table">
              <thead><tr><th>When</th><th>Product</th><th>Type</th><th className="text-right">Qty</th><th>Note</th><th>By</th></tr></thead>
              <tbody>
                {recent.map((m) => (
                  <tr key={m.id}>
                    <td className="text-xs">{fmtDateTime(m.createdAt)}</td>
                    <td><Link className="link" href={`/products/${m.product.id}`}>{m.product.name}</Link></td>
                    <td className="text-xs">{label(m.type)}</td>
                    <td className={`text-right font-semibold tabular-nums ${m.qty < 0 ? "text-red-600" : "text-emerald-600"}`}>{m.qty > 0 ? "+" : ""}{qty(m.qty)}</td>
                    <td className="text-xs text-gray-600">{m.note}</td>
                    <td className="text-xs">{m.user?.name}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableWrap>
        </Section>
      </div>
    </>
  );
}
