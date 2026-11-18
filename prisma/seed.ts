/**
 * Seed script.
 *   npm run seed          → staff logins + shop settings + DEMO data (products, customers, sales…)
 *   npm run seed:clean    → staff logins + shop settings + categories only (for go-live)
 *
 * WARNING: both commands wipe the existing database first.
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { calcBill, saleStatus } from "../src/lib/calc";

const db = new PrismaClient();
const DEMO = process.env.SEED_DEMO !== "0";

const daysAgo = (d: number, h = 11) => {
  const t = new Date();
  t.setDate(t.getDate() - d);
  t.setHours(h, Math.floor(Math.random() * 59), 0, 0);
  return t;
};
const pick = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)];

async function wipe() {
  // order matters for FKs
  const tables = [
    "SaleReturn", "Payment", "SaleItem", "Sale", "HeldBill", "JobCardPart", "JobCard",
    "PurchaseReturn", "SupplierPayment", "PurchaseItem", "Purchase", "StockMovement",
    "ProductFitment", "Product", "Vehicle", "Customer", "Supplier", "Category", "Brand",
    "Expense", "DayClose", "Attendance", "AuditLog", "User", "Counter", "ShopSettings",
  ];
  for (const t of tables) await db.$executeRawUnsafe(`DELETE FROM "${t}"`);
  await db.$executeRawUnsafe(`DELETE FROM sqlite_sequence`).catch(() => {});
}

async function next(name: string, prefix: string) {
  const c = await db.counter.upsert({ where: { name }, create: { name, value: 1 }, update: { value: { increment: 1 } } });
  return `${prefix}-${String(c.value).padStart(5, "0")}`;
}

async function main() {
  await wipe();

  await db.shopSettings.create({
    data: {
      id: 1,
      shopName: "KPR Pitstop N Sportz",
      tagline: "Bike & Car Accessories",
      address: "Main Road, (update shop address in Settings)",
      phone: "+91 90000 00000",
      stateName: "Tamil Nadu",
      stateCode: "33",
      invoicePrefix: "KPR",
    },
  });

  const hash = (p: string) => bcrypt.hashSync(p, 10);
  const users = await Promise.all([
    db.user.create({ data: { name: "Owner", username: "owner", passwordHash: hash("owner123"), role: "OWNER" } }),
    db.user.create({ data: { name: "Shop Manager", username: "manager", passwordHash: hash("manager123"), role: "MANAGER" } }),
    db.user.create({ data: { name: "Billing Counter", username: "cashier", passwordHash: hash("cashier123"), role: "CASHIER" } }),
    db.user.create({ data: { name: "Stock Keeper", username: "stock", passwordHash: hash("stock123"), role: "INVENTORY" } }),
    db.user.create({ data: { name: "Technician", username: "tech", passwordHash: hash("tech123"), role: "TECHNICIAN" } }),
  ]);

  const catNames: [string, string][] = [
    ["Helmets", "BIKE"], ["Riding Gear", "BIKE"], ["Bike Lights & Electricals", "BIKE"], ["Bike Body Parts", "BIKE"],
    ["Bike Care & Lubricants", "BIKE"], ["Bike Locks & Security", "BIKE"], ["Car Seat Covers", "CAR"], ["Car Mats", "CAR"],
    ["Car Electronics", "CAR"], ["Car Care", "CAR"], ["Car Exterior", "CAR"], ["Tyres & Tubes", "BOTH"], ["Batteries", "BOTH"],
    ["Mobile Holders & Chargers", "BOTH"], ["Service / Labour", "BOTH"],
  ];
  const cats: Record<string, number> = {};
  for (const [name, type] of catNames) cats[name] = (await db.category.create({ data: { name, type } })).id;

  if (!DEMO) {
    console.log("Clean seed done. Login: owner / owner123 (change it immediately).");
    return;
  }

  const brandNames = ["Steelbird", "Vega", "Studds", "Rynox", "Motul", "Castrol", "Philips", "Osram", "Bosch", "Exide", "Amaron", "3M", "Generic", "Autofurnish", "Kozdiko", "Pioneer", "MRF", "Michelin", "Royal Enfield Genuine"];
  const brands: Record<string, number> = {};
  for (const b of brandNames) brands[b] = (await db.brand.create({ data: { name: b } })).id;

  const s1 = await db.supplier.create({ data: { name: "Sri Murugan Auto Distributors", contactPerson: "Ramesh", phone: "9840011111", gstin: "33AAAAA0000A1Z5", address: "Wholesale Market", openingBalance: 0 } });
  const s2 = await db.supplier.create({ data: { name: "Chennai Helmet House", contactPerson: "Karthik", phone: "9840022222", address: "Ritchie Street" } });
  const s3 = await db.supplier.create({ data: { name: "Lubes & Care Agencies", contactPerson: "Suresh", phone: "9840033333" } });
  const s4 = await db.supplier.create({ data: { name: "Car Accessories Wholesale Hub", contactPerson: "Imran", phone: "9840044444" } });

  type P = { name: string; cat: string; brand: string; sup: number; cost: number; sell: number; mrp: number; gst: number; stock: number; min: number; war?: number; hsn?: string; size?: string; color?: string; group?: string; fit?: [string, string, string?][] };
  const products: P[] = [
    { name: "Steelbird SBA-1 Full Face Helmet", cat: "Helmets", brand: "Steelbird", sup: s2.id, cost: 1150, sell: 1650, mrp: 1799, gst: 18, stock: 14, min: 4, war: 6, hsn: "6506", size: "M", color: "Black", group: "SBA-1" },
    { name: "Steelbird SBA-1 Full Face Helmet", cat: "Helmets", brand: "Steelbird", sup: s2.id, cost: 1150, sell: 1650, mrp: 1799, gst: 18, stock: 3, min: 4, war: 6, hsn: "6506", size: "L", color: "Black", group: "SBA-1" },
    { name: "Vega Crux Open Face Helmet", cat: "Helmets", brand: "Vega", sup: s2.id, cost: 720, sell: 1050, mrp: 1150, gst: 18, stock: 10, min: 3, war: 6, hsn: "6506", size: "M", color: "Red" },
    { name: "Studds Ninja Elite Helmet", cat: "Helmets", brand: "Studds", sup: s2.id, cost: 980, sell: 1390, mrp: 1495, gst: 18, stock: 0, min: 3, war: 6, hsn: "6506", size: "L", color: "Matt Black" },
    { name: "Rynox Air GT Riding Gloves", cat: "Riding Gear", brand: "Rynox", sup: s2.id, cost: 1450, sell: 1990, mrp: 2150, gst: 12, stock: 6, min: 2, hsn: "6116", size: "L" },
    { name: "Riding Knee Guard (Pair)", cat: "Riding Gear", brand: "Generic", sup: s1.id, cost: 320, sell: 599, mrp: 699, gst: 12, stock: 12, min: 4, hsn: "6307" },
    { name: "Philips H4 Headlight Bulb 12V 60/55W", cat: "Bike Lights & Electricals", brand: "Philips", sup: s1.id, cost: 210, sell: 349, mrp: 395, gst: 28, stock: 40, min: 10, war: 3, hsn: "8539" },
    { name: "LED Fog Lamp with Switch (Pair)", cat: "Bike Lights & Electricals", brand: "Generic", sup: s1.id, cost: 650, sell: 1199, mrp: 1499, gst: 18, stock: 8, min: 3, war: 6, hsn: "8512", fit: [["Royal Enfield", "Classic 350"], ["Royal Enfield", "Hunter 350"], ["Bajaj", "Pulsar"]] },
    { name: "Osram Night Breaker H4", cat: "Bike Lights & Electricals", brand: "Osram", sup: s1.id, cost: 540, sell: 799, mrp: 899, gst: 28, stock: 2, min: 5, war: 6, hsn: "8539" },
    { name: "Classic 350 Crash Guard (Black)", cat: "Bike Body Parts", brand: "Generic", sup: s1.id, cost: 1250, sell: 1950, mrp: 2200, gst: 18, stock: 5, min: 2, hsn: "8714", fit: [["Royal Enfield", "Classic 350"]] },
    { name: "Bullet Leg Guard Chrome", cat: "Bike Body Parts", brand: "Generic", sup: s1.id, cost: 1400, sell: 2150, mrp: 2400, gst: 18, stock: 4, min: 2, hsn: "8714", fit: [["Royal Enfield", "Bullet 350"], ["Royal Enfield", "Classic 350"]] },
    { name: "Activa Seat Cover Premium", cat: "Bike Body Parts", brand: "Generic", sup: s1.id, cost: 180, sell: 399, mrp: 450, gst: 12, stock: 25, min: 6, hsn: "6304", fit: [["Honda", "Activa 6G"], ["Honda", "Activa 125"]] },
    { name: "Pulsar Tank Pad Sticker", cat: "Bike Body Parts", brand: "Generic", sup: s1.id, cost: 60, sell: 149, mrp: 199, gst: 18, stock: 30, min: 5, hsn: "4911", fit: [["Bajaj", "Pulsar 150"], ["Bajaj", "Pulsar NS200"]] },
    { name: "Royal Enfield Saddle Stay", cat: "Bike Body Parts", brand: "Royal Enfield Genuine", sup: s1.id, cost: 1100, sell: 1600, mrp: 1750, gst: 18, stock: 3, min: 1, hsn: "8714", fit: [["Royal Enfield", "Classic 350"], ["Royal Enfield", "Meteor 350"]] },
    { name: "Motul 7100 4T 10W50 1L", cat: "Bike Care & Lubricants", brand: "Motul", sup: s3.id, cost: 620, sell: 845, mrp: 880, gst: 18, stock: 36, min: 12, hsn: "2710" },
    { name: "Castrol Power1 Ultimate 15W50 1L", cat: "Bike Care & Lubricants", brand: "Castrol", sup: s3.id, cost: 480, sell: 650, mrp: 690, gst: 18, stock: 24, min: 12, hsn: "2710" },
    { name: "Motul C2 Chain Lube 150ml", cat: "Bike Care & Lubricants", brand: "Motul", sup: s3.id, cost: 220, sell: 330, mrp: 350, gst: 18, stock: 18, min: 6, hsn: "3403" },
    { name: "Bike Disc Lock with Alarm", cat: "Bike Locks & Security", brand: "Generic", sup: s1.id, cost: 450, sell: 899, mrp: 999, gst: 18, stock: 7, min: 2, war: 3, hsn: "8301" },
    { name: "Bike Body Cover Waterproof", cat: "Bike Locks & Security", brand: "Autofurnish", sup: s4.id, cost: 260, sell: 549, mrp: 699, gst: 12, stock: 15, min: 4, hsn: "6307" },
    { name: "Swift Leatherette Seat Cover Set", cat: "Car Seat Covers", brand: "Autofurnish", sup: s4.id, cost: 3400, sell: 5499, mrp: 6200, gst: 28, stock: 3, min: 1, hsn: "9401", fit: [["Maruti Suzuki", "Swift", "CAR"]] },
    { name: "Creta Leatherette Seat Cover Set", cat: "Car Seat Covers", brand: "Autofurnish", sup: s4.id, cost: 4800, sell: 7499, mrp: 8200, gst: 28, stock: 2, min: 1, hsn: "9401", fit: [["Hyundai", "Creta", "CAR"]] },
    { name: "7D Car Floor Mat - Hatchback", cat: "Car Mats", brand: "Kozdiko", sup: s4.id, cost: 1900, sell: 3200, mrp: 3800, gst: 18, stock: 4, min: 2, hsn: "5705" },
    { name: "Pioneer Bluetooth Car Stereo", cat: "Car Electronics", brand: "Pioneer", sup: s4.id, cost: 4200, sell: 5800, mrp: 6490, gst: 18, stock: 3, min: 1, war: 12, hsn: "8527" },
    { name: "Reverse Parking Camera", cat: "Car Electronics", brand: "Generic", sup: s4.id, cost: 900, sell: 1799, mrp: 2199, gst: 18, stock: 6, min: 2, war: 6, hsn: "8525" },
    { name: "Car Dashboard Camera 1080p", cat: "Car Electronics", brand: "Generic", sup: s4.id, cost: 1700, sell: 2999, mrp: 3499, gst: 18, stock: 1, min: 2, war: 6, hsn: "8525" },
    { name: "3M Car Shampoo 250ml", cat: "Car Care", brand: "3M", sup: s3.id, cost: 180, sell: 275, mrp: 299, gst: 18, stock: 20, min: 6, hsn: "3405" },
    { name: "3M Dashboard Polish", cat: "Car Care", brand: "3M", sup: s3.id, cost: 230, sell: 340, mrp: 375, gst: 18, stock: 14, min: 4, hsn: "3405" },
    { name: "Microfiber Cloth (Pack of 3)", cat: "Car Care", brand: "Generic", sup: s3.id, cost: 90, sell: 199, mrp: 249, gst: 12, stock: 40, min: 10, hsn: "6307" },
    { name: "Car Door Visor (Set of 4)", cat: "Car Exterior", brand: "Generic", sup: s4.id, cost: 520, sell: 999, mrp: 1199, gst: 18, stock: 5, min: 2, hsn: "8708", fit: [["Maruti Suzuki", "Swift", "CAR"], ["Maruti Suzuki", "Baleno", "CAR"]] },
    { name: "MRF Zapper 90/90-17 Tyre", cat: "Tyres & Tubes", brand: "MRF", sup: s1.id, cost: 1650, sell: 2150, mrp: 2290, gst: 28, stock: 6, min: 2, war: 12, hsn: "4011" },
    { name: "Michelin Pilot Street 100/80-17", cat: "Tyres & Tubes", brand: "Michelin", sup: s1.id, cost: 2350, sell: 2990, mrp: 3150, gst: 28, stock: 0, min: 2, war: 12, hsn: "4011" },
    { name: "Exide Xplore 12V 5Ah Bike Battery", cat: "Batteries", brand: "Exide", sup: s1.id, cost: 1350, sell: 1750, mrp: 1890, gst: 28, stock: 5, min: 2, war: 24, hsn: "8507" },
    { name: "Amaron 12V 35Ah Car Battery", cat: "Batteries", brand: "Amaron", sup: s1.id, cost: 4100, sell: 5200, mrp: 5600, gst: 28, stock: 2, min: 1, war: 48, hsn: "8507" },
    { name: "Bike Mobile Holder with USB Charger", cat: "Mobile Holders & Chargers", brand: "Generic", sup: s1.id, cost: 380, sell: 799, mrp: 999, gst: 18, stock: 22, min: 5, war: 3, hsn: "8504" },
    { name: "Car Dual USB Fast Charger", cat: "Mobile Holders & Chargers", brand: "Generic", sup: s4.id, cost: 150, sell: 349, mrp: 499, gst: 18, stock: 3, min: 5, war: 3, hsn: "8504" },
    { name: "Old Stock Chrome Mirror (Vintage)", cat: "Bike Body Parts", brand: "Generic", sup: s1.id, cost: 220, sell: 450, mrp: 500, gst: 18, stock: 9, min: 2, hsn: "7009" },
  ];

  const created: { id: number; sell: number; cost: number; gst: number; name: string; hsn?: string; war?: number; stock: number }[] = [];
  let i = 0;
  for (const p of products) {
    i++;
    const sku = `KPR-${String(i).padStart(4, "0")}`;
    const row = await db.product.create({
      data: {
        name: p.name, sku, barcode: `890${String(100000000 + i)}`, categoryId: cats[p.cat], brandId: brands[p.brand], supplierId: p.sup,
        purchasePrice: p.cost, sellingPrice: p.sell, mrp: p.mrp, gstRate: p.gst, stock: p.stock, minStock: p.min, warrantyMonths: p.war ?? 0,
        hsn: p.hsn, size: p.size, color: p.color, variantGroup: p.group, location: `Rack ${String.fromCharCode(65 + (i % 6))}${(i % 4) + 1}`,
        fitments: p.fit ? { create: p.fit.map(([make, model, type]) => ({ make, model, vehicleType: type ?? "BIKE" })) } : undefined,
      },
    });
    await db.stockMovement.create({ data: { productId: row.id, type: "OPENING", qty: p.stock, balanceAfter: p.stock, note: "Opening stock", userId: users[0].id, createdAt: daysAgo(120) } });
    created.push({ id: row.id, sell: p.sell, cost: p.cost, gst: p.gst, name: p.name, hsn: p.hsn, war: p.war, stock: p.stock });
  }
  // backdate the dead stock item
  await db.product.update({ where: { id: created[created.length - 1].id }, data: { createdAt: daysAgo(200) } });

  // Customers
  const custData: [string, string, string, string, string?, boolean?][] = [
    ["Arun Kumar", "9876500001", "Royal Enfield", "Classic 350", "TN 09 AB 1234", true],
    ["Priya S", "9876500002", "Honda", "Activa 6G", "TN 10 CD 5678", true],
    ["Mohammed Rafi", "9876500003", "Bajaj", "Pulsar NS200", "TN 07 EF 9012", true],
    ["Vignesh R", "9876500004", "Royal Enfield", "Hunter 350", "TN 22 GH 3456", false],
    ["Lakshmi Narayanan", "9876500005", "Maruti Suzuki", "Swift", "TN 01 IJ 7890", true],
    ["Deepak Raj", "9876500006", "Hyundai", "Creta", "TN 05 KL 2345", true],
    ["Sathish M", "9876500007", "TVS", "Apache RTR 160", "TN 11 MN 6789", false],
    ["Karthika", "9876500008", "Honda", "Activa 125", "TN 12 OP 1122", true],
  ];
  const customers = [];
  for (const [name, phone, make, model, reg, opt] of custData) {
    const isCar = ["Maruti Suzuki", "Hyundai"].includes(make);
    const c = await db.customer.create({
      data: {
        name, phone, tags: isCar ? "car-owner" : "bike-owner", whatsappOptIn: !!opt, optInAt: opt ? daysAgo(30) : null, optInSource: opt ? "counter" : null,
        createdAt: daysAgo(60),
        vehicles: { create: [{ type: isCar ? "CAR" : "BIKE", make, model, regNo: reg, year: 2021 + Math.floor(Math.random() * 4) }] },
      },
      include: { vehicles: true },
    });
    customers.push(c);
  }

  // Purchases (last 45 days)
  for (const [d, sup, items, paidPct] of [
    [40, s2.id, [0, 2, 3], 1],
    [25, s3.id, [14, 15, 16], 1],
    [12, s1.id, [6, 7, 29, 31], 0.5],
    [5, s4.id, [21, 22, 23], 0],
  ] as [number, number, number[], number][]) {
    const lines = items.map((ix) => {
      const p = created[ix];
      const q = 5;
      const tax = Math.round(p.cost * q * p.gst) / 100;
      return { productId: p.id, qty: q, unitCost: p.cost, gstRate: p.gst, taxAmount: tax, total: p.cost * q + tax };
    });
    const subtotal = lines.reduce((a, l) => a + l.unitCost * l.qty, 0);
    const taxTotal = lines.reduce((a, l) => a + l.taxAmount, 0);
    const total = Math.round(subtotal + taxTotal);
    const number = await next("purchase", "PO");
    const pur = await db.purchase.create({
      data: { number, supplierId: sup, supplierBillNo: `INV/${1000 + d}`, date: daysAgo(d), subtotal, taxTotal, total, paidAmount: Math.round(total * paidPct), items: { create: lines }, createdById: users[3].id },
    });
    if (paidPct > 0) await db.supplierPayment.create({ data: { supplierId: sup, purchaseId: pur.id, amount: Math.round(total * paidPct), method: "BANK", date: daysAgo(d) } });
    // purchases already reflected in opening stock numbers – record movement with zero net to keep ledger readable
    for (const l of lines) {
      const prod = await db.product.update({ where: { id: l.productId }, data: { stock: { increment: l.qty } } });
      await db.stockMovement.create({ data: { productId: l.productId, type: "PURCHASE", qty: l.qty, balanceAfter: prod.stock, refType: "Purchase", refId: pur.id, userId: users[3].id, createdAt: daysAgo(d) } });
    }
  }

  // Sales over last 30 days
  const sellable = created.slice(0, created.length - 1).filter((p) => p.stock > 0);
  for (let d = 30; d >= 0; d--) {
    const n = 2 + Math.floor(Math.random() * 4);
    for (let k = 0; k < n; k++) {
      const cust = Math.random() < 0.6 ? pick(customers) : null;
      const chosen = [...new Set([pick(sellable), pick(sellable), ...(Math.random() < 0.4 ? [pick(sellable)] : [])])];
      const lines = chosen.map((p) => ({ productId: p.id, name: p.name, hsn: p.hsn, qty: 1, unitPrice: p.sell, discount: 0, gstRate: p.gst }));
      const bill = calcBill(lines, Math.random() < 0.2 ? 50 : 0, false);
      const credit = cust && Math.random() < 0.12;
      const paid = credit ? Math.round(bill.total * 0.5) : bill.total;
      const date = daysAgo(d, 10 + Math.floor(Math.random() * 9));
      const invoiceNo = await next("invoice", "KPR");
      const costTotal = chosen.reduce((a, p) => a + p.cost, 0);
      const sale = await db.sale.create({
        data: {
          invoiceNo, customerId: cust?.id, vehicleId: cust?.vehicles[0]?.id, date, createdAt: date, subtotal: bill.subtotal, discount: bill.discount,
          taxableValue: bill.taxableValue, cgst: bill.cgst, sgst: bill.sgst, igst: 0, taxTotal: bill.taxTotal, roundOff: bill.roundOff,
          total: bill.total, paidAmount: paid, costTotal, status: saleStatus(bill.total, paid), userId: pick([users[0].id, users[2].id, users[1].id]),
          items: {
            create: bill.lines.map((l, ix) => ({
              productId: l.productId, name: l.name, hsn: l.hsn, qty: l.qty, unitPrice: l.unitPrice, discount: l.discount, gstRate: l.gstRate,
              taxableValue: l.taxableValue, taxAmount: l.taxAmount, total: l.total, costPrice: chosen[ix].cost,
              warrantyUntil: chosen[ix].war ? new Date(date.getTime() + chosen[ix].war! * 30 * 864e5) : null,
            })),
          },
          payments: { create: [{ amount: paid, method: pick(["CASH", "UPI", "UPI", "CARD"]), date, customerId: cust?.id }] },
        },
      });
      for (const p of chosen) {
        const prod = await db.product.update({ where: { id: p.id }, data: { stock: { decrement: 1 } } });
        if (prod.stock < 0) await db.product.update({ where: { id: p.id }, data: { stock: 0 } });
        await db.stockMovement.create({ data: { productId: p.id, type: "SALE", qty: -1, balanceAfter: Math.max(0, prod.stock), refType: "Sale", refId: sale.id, createdAt: date } });
      }
    }
  }

  // Expenses
  for (const [d, cat, amt, note] of [
    [28, "RENT", 25000, "Shop rent"], [26, "ELECTRICITY", 3200, "EB bill"], [20, "TRANSPORT", 800, "Stock pickup"],
    [15, "TEA_SNACKS", 450, ""], [10, "MAINTENANCE", 1500, "Shutter repair"], [3, "SALARY", 15000, "Advance – staff"], [0, "TEA_SNACKS", 120, ""],
  ] as [number, string, number, string][]) {
    await db.expense.create({ data: { date: daysAgo(d), category: cat, amount: amt, method: amt > 2000 ? "BANK" : "CASH", note, userId: users[0].id } });
  }

  // Job cards
  const jc1 = await db.jobCard.create({
    data: { number: await next("jobcard", "JOB"), customerId: customers[0].id, vehicleId: customers[0].vehicles[0].id, technicianId: users[4].id, status: "IN_PROGRESS", complaint: "Fit LED fog lamps and crash guard", labourCharge: 500, estimate: 3650, receivedAt: daysAgo(0, 10) },
  });
  await db.jobCardPart.create({ data: { jobCardId: jc1.id, productId: created[7].id, qty: 1, unitPrice: created[7].sell } });
  await db.jobCard.create({
    data: { number: await next("jobcard", "JOB"), customerId: customers[4].id, vehicleId: customers[4].vehicles[0].id, technicianId: users[4].id, status: "RECEIVED", complaint: "Install reverse parking camera", labourCharge: 400, estimate: 2200, receivedAt: daysAgo(0, 12) },
  });

  // Attendance for today
  for (const u of users) await db.attendance.create({ data: { userId: u.id, date: new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date()), status: "PRESENT" } });

  console.log("Demo seed done.");
  console.log("Logins: owner/owner123 · manager/manager123 · cashier/cashier123 · stock/stock123 · tech/tech123");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
