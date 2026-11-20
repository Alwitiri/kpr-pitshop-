import { db } from "@/lib/db";
import { requirePage } from "@/lib/auth";
import { can } from "@/lib/roles";
import { pickerProducts } from "@/lib/queries";
import { getSettings } from "@/lib/server-utils";
import { PosScreen, type PosPreload } from "./pos-screen";

export const metadata = { title: "POS Billing" };

export default async function PosPage({ searchParams }: { searchParams: Promise<{ job?: string }> }) {
  const s = await requirePage("pos");
  const jobId = Number((await searchParams).job) || null;
  const [products, settings] = await Promise.all([pickerProducts(), getSettings()]);

  let preload: PosPreload | null = null;
  if (jobId) {
    const job = await db.jobCard.findUnique({
      where: { id: jobId },
      include: { customer: { include: { vehicles: true } }, parts: { include: { product: true } }, sale: true },
    });
    if (job && !job.sale) {
      preload = {
        jobCardId: job.id,
        jobNumber: job.number,
        customer: job.customer,
        vehicleId: job.vehicleId,
        lines: [
          ...job.parts.map((p) => ({ productId: p.productId, name: p.product.name, hsn: p.product.hsn, qty: p.qty, unitPrice: p.unitPrice, discount: 0, gstRate: p.product.gstRate, stock: p.product.stock })),
          ...(job.labourCharge > 0 ? [{ productId: null, name: `Labour / fitting charges (${job.number})`, hsn: "9987", qty: 1, unitPrice: job.labourCharge, discount: 0, gstRate: 18, stock: 0 }] : []),
        ],
      };
    }
  }

  return (
    <PosScreen
      products={products}
      canEditPrice={can(s.role, "editPrice")}
      canAddProduct={can(s.role, "products")}
      preload={preload}
      shopState={settings.stateName}
      autoReceipt={settings.receiptAutoPrint}
      receiptLabel={`Print receipt (${settings.receiptWidth.replace("mm", " mm")})`}
    />
  );
}
