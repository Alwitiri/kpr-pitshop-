import Link from "next/link";
import { db } from "@/lib/db";
import { requirePage } from "@/lib/auth";
import { canSeeProfit } from "@/lib/roles";
import { getSettings } from "@/lib/server-utils";
import { deadStock } from "@/lib/queries";
import { fmtDate, money, money0, qty } from "@/lib/format";
import { Badge, Empty, PageHeader, Section, Stat, TableWrap } from "@/components/ui";
import { ExportCsv } from "@/components/forms";

export const metadata = { title: "Inventory" };

export default async function InventoryPage() {
  const s = await requirePage("inventory");
  const settings = await getSettings();
  const products = await db.product.findMany({ where: { active: true }, include: { category: true, supplier: { select: { name: true } } }, orderBy: { name: "asc" } });
  const dead = await deadStock(settings.deadStockDays);
  const profit = canSeeProfit(s.role);

  const units = products.reduce((a, p) => a + Math.max(0, p.stock), 0);
  const costValue = products.reduce((a, p) => a + Math.max(0, p.stock) * p.purchasePrice, 0);
  const saleValue = products.reduce((a, p) => a + Math.max(0, p.stock) * p.sellingPrice, 0);
  const low = products.filter((p) => p.stock > 0 && p.stock <= p.minStock);
  const out = products.filter((p) => p.stock <= 0);
  const reorder = [...out, ...low];

  const byCat = new Map<string, { units: number; cost: number; sale: number; items: number }>();
  for (const p of products) {
    const k = p.category?.name ?? "Uncategorised";
    const r = byCat.get(k) ?? { units: 0, cost: 0, sale: 0, items: 0 };
    r.items++;
    r.units += Math.max(0, p.stock);
    r.cost += Math.max(0, p.stock) * p.purchasePrice;
    r.sale += Math.max(0, p.stock) * p.sellingPrice;
    byCat.set(k, r);
  }

  return (
    <>
      <PageHeader
        title="Inventory"
        subtitle="Live stock across all products"
        actions={
          <>
            <Link href="/inventory/movements" className="btn-outline">Stock ledger</Link>
            <Link href="/inventory/stock-check" className="btn-outline">Physical stock check</Link>
            <Link href="/inventory/adjust" className="btn-primary">Adjust / damage</Link>
          </>
        }
      />
      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Stat label="Active products" value={products.length} hint={`${qty(units)} units in shop`} />
        {profit && <Stat label="Stock value (cost)" value={money0(costValue)} />}
        <Stat label="Stock value (selling)" value={money0(saleValue)} />
        <Stat label="Low stock" value={low.length} tone={low.length ? "warn" : "good"} href="/products?stock=low" />
        <Stat label="Out of stock" value={out.length} tone={out.length ? "bad" : "good"} href="/products?stock=out" />
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <Section
          title={`Reorder list (${reorder.length})`}
          pad={false}
          actions={
            <ExportCsv
              filename="reorder-list.csv"
              label="Export"
              rows={[["Product", "SKU", "Supplier", "Stock", "Min", "Suggested order"], ...reorder.map((p) => [p.name, p.sku, p.supplier?.name, p.stock, p.minStock, Math.max(1, p.minStock * 2 - p.stock)])]}
            />
          }
        >
          <TableWrap>
            <table className="table">
              <thead>
                <tr><th>Product</th><th>Supplier</th><th className="text-right">Stock</th><th className="text-right">Min</th><th className="text-right">Order</th></tr>
              </thead>
              <tbody>
                {reorder.map((p) => (
                  <tr key={p.id}>
                    <td><Link className="link" href={`/products/${p.id}`}>{p.name}</Link>{p.size && <span className="text-xs text-gray-500"> · {p.size}</span>}</td>
                    <td className="text-xs text-gray-600">{p.supplier?.name ?? "—"}</td>
                    <td className="text-right"><Badge status={p.stock <= 0 ? "OUT" : "LOW"}>{qty(p.stock)}</Badge></td>
                    <td className="text-right tabular-nums">{qty(p.minStock)}</td>
                    <td className="text-right font-semibold tabular-nums">{qty(Math.max(1, p.minStock * 2 - p.stock))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableWrap>
          {!reorder.length && <Empty>All products are above their minimum stock.</Empty>}
        </Section>

        <Section title={`Dead stock – not sold in ${settings.deadStockDays} days (${dead.length})`} pad={false}>
          <TableWrap>
            <table className="table">
              <thead>
                <tr><th>Product</th><th>Last sold</th><th className="text-right">Stock</th>{profit && <th className="text-right">Value (cost)</th>}</tr>
              </thead>
              <tbody>
                {dead.map((p) => (
                  <tr key={p.id}>
                    <td><Link className="link" href={`/products/${p.id}`}>{p.name}</Link></td>
                    <td className="text-xs text-gray-600">{p.lastSold ? fmtDate(p.lastSold) : "Never"}</td>
                    <td className="text-right tabular-nums">{qty(p.stock)}</td>
                    {profit && <td className="text-right tabular-nums">{money(p.stock * p.purchasePrice)}</td>}
                  </tr>
                ))}
              </tbody>
            </table>
          </TableWrap>
          {!dead.length && <Empty>No dead stock. Everything is moving.</Empty>}
        </Section>

        <Section title="Stock value by category" pad={false} className="xl:col-span-2">
          <TableWrap>
            <table className="table">
              <thead>
                <tr><th>Category</th><th className="text-right">Items</th><th className="text-right">Units</th>{profit && <th className="text-right">Cost value</th>}<th className="text-right">Selling value</th></tr>
              </thead>
              <tbody>
                {[...byCat.entries()].sort((a, b) => b[1].sale - a[1].sale).map(([k, r]) => (
                  <tr key={k}>
                    <td>{k}</td>
                    <td className="text-right tabular-nums">{r.items}</td>
                    <td className="text-right tabular-nums">{qty(r.units)}</td>
                    {profit && <td className="text-right tabular-nums">{money(r.cost)}</td>}
                    <td className="text-right tabular-nums">{money(r.sale)}</td>
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
