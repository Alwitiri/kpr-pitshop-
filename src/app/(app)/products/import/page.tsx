import { requirePage } from "@/lib/auth";
import { PageHeader, Section } from "@/components/ui";
import { ActionForm, ExportCsv, Submit } from "@/components/forms";
import { importProducts } from "@/actions/products";

export const metadata = { title: "Import products" };

const TEMPLATE = [
  ["name", "sku", "barcode", "category", "brand", "size", "color", "hsn", "unit", "purchase_price", "selling_price", "mrp", "gst_rate", "stock", "min_stock", "warranty_months", "location"],
  ["Steelbird SBA-1 Helmet", "", "", "Helmets", "Steelbird", "M", "Black", "6506", "PCS", "1150", "1650", "1799", "18", "10", "3", "6", "Rack A1"],
];

export default async function ImportPage() {
  await requirePage("products");
  return (
    <>
      <PageHeader title="Import products from Excel" back="/products" />
      <div className="grid gap-5 lg:grid-cols-2">
        <Section title="1. Prepare the sheet">
          <ol className="list-decimal space-y-2 pl-5 text-sm text-gray-700">
            <li>Download the template and open it in Excel.</li>
            <li>One row per product. Only <b>name</b> is required; everything else is optional.</li>
            <li><b>selling_price</b> includes GST. <b>purchase_price</b> excludes GST.</li>
            <li>If a row&apos;s <b>sku</b> already exists, that product is updated (stock is not changed). New rows get stock from the <b>stock</b> column as opening stock.</li>
            <li>New categories and brands are created automatically.</li>
            <li>In Excel choose <b>File → Save As → CSV UTF-8</b>.</li>
          </ol>
          <div className="mt-4">
            <ExportCsv rows={TEMPLATE} filename="kpr-product-template.csv" label="Download template" />
          </div>
        </Section>
        <Section title="2. Upload">
          <ActionForm action={importProducts} className="space-y-4">
            <input type="file" name="file" accept=".csv,text/csv" className="input py-1.5" required />
            <Submit>Import products</Submit>
          </ActionForm>
        </Section>
      </div>
    </>
  );
}
