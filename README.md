# KPR Pitstop N Sportz – Business Management System

Billing, inventory, purchases, CRM, job cards, expenses, staff and reports for a bike & car accessories shop.
WhatsApp messaging is **not built yet** (planned next). Customer WhatsApp consent is already recorded at billing so the list is ready.

## Run it on a PC

Requirements: Node.js 20+ (tested with Node 24) and a PostgreSQL database.

Copy `.env.example` to `.env`, then fill in `DATABASE_URL` and a long random `AUTH_SECRET`.

```bash
npm install
npm run setup      # creates the database and loads demo data
npm run dev        # open http://localhost:3000
```

Demo logins (change them before real use):

| Role | Username | Password |
|---|---|---|
| Owner | owner | owner123 |
| Manager | manager | manager123 |
| Cashier | cashier | cashier123 |
| Inventory | stock | stock123 |
| Technician | tech | tech123 |

**Going live with real data:** run `npm run seed:clean`. It clears everything and leaves only the staff logins and categories. Then change the owner password, fill in Settings (shop name, address, GSTIN), and import products from Excel (Products → Import).

> Both `npm run seed` and `npm run seed:clean` **wipe the database**. Never run them after going live.

For daily use in the shop, run the production build instead of `dev`:

```bash
npm run build
npm start
```

## Modules

| Module | What it does |
|---|---|
| Dashboard | Today's and this month's sales and profit, 30-day chart, top sellers, alerts (stock, dues, overdue jobs, warranties) |
| POS Billing | Barcode or search entry, GST-inclusive pricing, line and bill discounts, CGST/SGST or IGST, cash/UPI/card/split payments, credit sales, hold/resume bills, quick new customer with vehicle and WhatsApp consent, F2/F9 shortcuts, 80mm and A4 invoices |
| Sales | Invoice list and filters, receive due payments, returns and exchanges (cash/UPI refund or adjust against dues, restock or mark damaged), owner/manager bill cancellation that restores stock |
| Customers (CRM) | Profiles, multiple vehicles, purchase history, total spent and visits, dues with FIFO payment allocation, active warranties, tags, birthdays, segments (bike/car, make/model, inactive 30/60/90 days, dues, opted-in), CSV export |
| Job Cards | Vehicle check-in, technician, labour, parts, Kanban board (Received → Inspection → In Progress → Completed), one-click invoice through POS |
| Products | SKU/barcode, category, brand, variants (size/colour group), bike/car compatibility, HSN/GST, MRP, margin preview, images, warranty, rack location, Excel (CSV) import/export, barcode label printing |
| Inventory | Live stock, full stock ledger, adjustments/damage with reason, physical stock check, reorder list, dead stock, stock value by category |
| Purchases & Suppliers | Purchase entry (updates stock and cost), supplier bill upload, part payments, supplier balances, FIFO supplier payments, purchase returns |
| Expenses & Cash | Expense categories, cash book by payment method, daily cash closing with difference tracking |
| Staff | 5 roles with permissions, attendance, per-staff sales, activity/audit log |
| Reports | P&L, daily/monthly sales, product/category/brand-wise, GST rate and HSN summary, purchases, payment modes, staff performance, top customers, dues, warranty expiry; all exportable to Excel |
| Settings | Shop/invoice details, invoice prefix, GST state, owner-only full JSON backup download |

## Technical notes

- **Stack:** Next.js 16 (App Router, server actions), React 19, Tailwind CSS 4, Prisma 6.
- **Database:** PostgreSQL through Prisma. The tables are created and updated by `npx prisma db push`, which also runs automatically on Render at startup.
- **Render:** the build command is `npm ci --include=dev && npm run build` and the start command is `npm run start:render`. Set the `DATABASE_URL`, `AUTH_SECRET` and `NODE_VERSION` environment variables.
- **Uploads on Render:** the Render disk is wiped on every deploy, so product images and supplier bills uploaded to `./uploads` are lost. Move them to Supabase Storage or S3 before relying on them.
- **Money logic:** selling prices include GST. `src/lib/calc.ts` is shared by the POS screen and the server; the server recalculates everything and never trusts totals sent by the browser.
- **Stock integrity:** each stock change goes through `moveStock()` inside a database transaction and writes a ledger row. A failed sale never changes stock.
- **Uploads** are stored in `./uploads` and served only to logged-in users.
- **Security:** set a long random `AUTH_SECRET` in `.env` before going live. Passwords are bcrypt-hashed and sessions are httpOnly JWT cookies (12 h).

## Next: WhatsApp module (not built)

Official WhatsApp Cloud API: approved templates, one-click broadcast to opted-in customer segments, cost preview, delivery reports, invoice PDF on WhatsApp, payment/warranty reminders, opt-out handling.
