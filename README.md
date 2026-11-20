# KPR Pitstop N Sportz – Business Management System

Offline Windows software for a bike & car accessories shop: billing, inventory, purchases, CRM, job cards, expenses, staff and reports.
It runs entirely on the shop's PC with **no internet**. Other devices on the shop Wi-Fi can use it too.
WhatsApp messaging is **not built yet** (planned next). Customer WhatsApp consent is already recorded at billing.

## Install at a client (the shop PC)

1. On your dev PC: `npm run package`. This creates `dist/KPR-Pitstop-<version>/` and a `.zip` of it (about 80 MB).
2. Copy the folder (or unzip the zip) onto the shop PC using a pen drive.
3. Right-click **Install KPR Pitstop.cmd** → *Run as administrator*. Admin is only needed for the firewall rule that lets phones and other counters connect.
4. Double-click the **KPR Pitstop** icon on the desktop. On first launch it asks for the shop name and creates the owner login.

Nothing else is needed on the shop PC: Node.js is bundled, and the window uses Microsoft Edge in app mode, which comes with Windows.

| Folder | Contents |
|---|---|
| `C:\KPR Pitstop\program` | The app, Node.js and the launcher. Replaced on every update. |
| `C:\KPR Pitstop\data` | `kpr.db` (all data), `backups\`, `uploads\`, `logs\`, `config.json`. **Never touched by updates.** |

- **Updating a client:** run the new version's installer. It stops the app, replaces `program`, and on start-up the database is upgraded automatically.
- **Starting automatically:** the app starts in the background when Windows starts (via the registry key `HKCU\...\Run`), and the desktop icon just opens the window.
- **Other devices:** Settings → *Use on other devices* shows the address to open, e.g. `http://192.168.1.5:3780`.
- **Stopping the app:** use Start menu → *Stop KPR Pitstop*. Run this before copying data by hand.
- **Forgotten password:** staff passwords are reset by the owner (*Staff → Edit*). If the owner forgets, open Start menu → **Reset KPR password** on the shop PC (or run `program\launcher.js --reset-password`). It lists every username, sets a new password, re-enables the login, and records the reset in the activity log. It only works on the PC that holds the data.
- **Troubleshooting:** run `program\node\node.exe program\launcher.js --foreground` to see the server output. Logs are in `data\logs`.
- **Uninstalling:** run `powershell -ExecutionPolicy Bypass -File uninstall.ps1`. The data folder is kept.

### Backups

- **Automatic:** a backup is taken every day into `data\backups`, and the last 30 are kept.
- **Manual (owner only):** Settings → *Backups* has *Back up now*, download (to save on a pen drive), and *Restore*. Restore saves a safety copy of the current data first.
- **Advice for the shop owner:** copy a backup to a pen drive every week, because a dead hard disk takes the backups with it.

### Company logo (each shop its own)

Each installation is branded for its own business:
- **First-run setup** asks for the shop name, tagline and an optional **logo**.
- **Settings → Company logo** uploads, replaces or removes it. PNG, JPG or WEBP up to 2 MB; square works best.
- **Where it appears:** the login screen (with the shop's name and tagline), the menu, and the 80 mm (black and white) and A4 bills.
- **No logo:** the shop's initials are shown instead.

The logo file is kept in `data\branding`. The `.db` backups contain the shop's data but not the logo image. When moving to a new PC, copy the whole `data` folder, or upload the logo again.

### Barcodes & scanner

Any USB or Bluetooth barcode scanner in "keyboard" mode works with no setup. Most scanners come in this mode.

| Where | What scanning does |
|---|---|
| **New / edit product** | Scan the maker's barcode into the Barcode box. No barcode? Click **Generate**, or leave it empty and a shop EAN-13 code (`21…`) is created on save. |
| **After saving a product** | A **Print N stickers** button prints one label for each piece in stock. |
| **Products → Print barcode stickers** | Pick the sticker type: thermal rolls 50×25 / 38×25 / 50×30 mm, or A4 sheets with 65 or 24 per sheet. Choose whether to show price/MRP and the shop name. Set the quantity per product, or scan an item to add one more sticker. |
| **Purchase → Print barcode stickers for these items** | Labels for everything just received, with the quantity set to the quantity received. |
| **POS billing** | Scan an item to add it to the bill; scan again to increase the quantity. An unknown code offers **Add as new product**. |
| **New purchase** | Scan an item to add it to the purchase. Unknown codes can be added as new products. |
| **Physical stock check** | Scan every piece on the shelf, and the counted quantity goes up by one per scan. |
| **Anywhere else** | Scanning a product opens it (counter staff instead see its price and stock). Scanning the barcode on a printed bill opens that bill for returns or reprints. |
| **Sidebar "Scan / find"** | Type or scan a barcode or bill number. |

Printed bills (80 mm and A4) carry the invoice number as a barcode.

## Development

```bash
npm install
npm run dev          # http://localhost:3000. First visit creates tables and shows the setup screen
npm run seed         # OPTIONAL: wipe the dev database and load demo data (logins below)
```

Demo logins after `npm run seed`: `owner/owner123`, `manager/manager123`, `cashier/cashier123`, `stock/stock123`, `tech/tech123`.

`npm run seed` and `npm run seed:clean` **wipe the database**. Never run them against a client's `kpr.db`.

### Changing the database structure

1. Edit `prisma/schema.prisma`.
2. Run `npm run migration:new short_name`. This writes the next file in `prisma/migrations-sql/`.
3. Restart the app. Every installed copy applies new migration files automatically on start-up and records them in the `_AppMigration` table.

## Modules

| Module | What it does |
|---|---|
| Dashboard | Today's and this month's sales and profit, 30-day chart, top sellers, alerts (stock, dues, overdue jobs, warranties) |
| POS Billing | Barcode or search entry, GST-inclusive pricing, line and bill discounts, CGST/SGST or IGST, cash/UPI/card/split payments, credit sales, hold/resume bills, quick new customer with vehicle and WhatsApp consent, F2/F9 shortcuts, 80mm and A4 invoices |
| Sales | Invoice list and filters, receive due payments, returns and exchanges, owner/manager bill cancellation that restores stock |
| Customers (CRM) | Profiles, multiple vehicles, purchase history, dues with FIFO payment allocation, active warranties, tags, birthdays, contact history (calls, visits, complaints), automatic segments (Champions, Loyal, New, At risk, Lost…), CSV export, **Excel (CSV) import from old records** with vehicles and opening dues |
| Follow-ups | Daily call list (overdue / today / upcoming), mark done with the customer's answer and book the next call, snooze, assign to staff; menu badge shows how many are due. Payment follow-ups close themselves when the bill is paid |
| Customer insights | Segments with suggested actions, repeat rate, lifetime value, new customers per month, new vs returning sales, busiest hours and weekdays, top vehicle makes, follow-up performance by staff |
| Job Cards | Vehicle check-in, technician, labour, parts, Kanban board, one-click invoice through POS |
| Products | SKU/barcode, category, brand, variants, bike/car compatibility, HSN/GST, MRP, margin preview, images, warranty, rack location, Excel (CSV) import/export, barcode label printing |
| Inventory | Live stock, stock ledger, adjustments/damage, physical stock check, reorder list, dead stock, stock value by category |
| Purchases & Suppliers | Purchase entry (updates stock and cost), supplier bill upload, part payments, supplier balances, purchase returns |
| Expenses & Cash | Expense categories, cash book by payment method, daily cash closing |
| Staff | 5 roles, **owner-editable permissions** (Staff → Permissions: each screen plus abilities like seeing profit, changing price at billing, cancelling bills, deleting expenses, importing), attendance, per-staff sales, activity log |
| Reports | P&L, daily/monthly sales, product/category/brand-wise, GST rate and HSN summary, purchases, payment modes, staff performance, top customers, dues, warranty expiry; all exportable to Excel |
| Settings | Shop/invoice details, **workflows & automation** (Settings → Workflows), backups and restore, network address for other devices |

### Workflows (custom automation)

Each rule says *when* something happens, *after how many days*, and *what follow-up to create* (with `{customer}`, `{vehicle}`, `{invoice}`, `{job}`, `{amount}`, `{item}` in the title), optionally only for bills above an amount and given to one staff member.

| When | Starts |
|---|---|
| Bill made / bill left unpaid | Right after billing (POS) |
| Job completed / vehicle delivered | When the job card status changes or its invoice is made |
| Birthday coming / warranty ending / customer inactive | Checked every hour in the background (and on opening Follow-ups) |

Seven rules are installed by default (inactive-customer is off). A rule never creates the same follow-up twice.

## Technical notes

- **Stack:** Next.js 16 (App Router, server actions, standalone output), React 19, Tailwind CSS 4, Prisma 6 with SQLite in WAL mode.
- **Packaging:** `scripts/package.mjs` combines the standalone server, a copy of the Node.js that runs the build, `packaging/launcher.js` and the installer scripts. `scripts/make-icon.mjs` draws the icon.
- **Start-up:** `src/instrumentation.ts` → `src/lib/startup.ts` applies migrations, then schedules the daily backups.
- **Money logic:** selling prices include GST. `src/lib/calc.ts` is shared by the POS screen and the server, and the server recalculates everything.
- **Stock integrity:** each stock change goes through `moveStock()` inside a transaction and writes a ledger row.
- **Security:** a random `AUTH_SECRET` is generated per install in `data\config.json`. Passwords are bcrypt-hashed and sessions are httpOnly cookies (12 h). Cookies are not marked secure, because shop devices use plain http on the local network.

## Next: WhatsApp module (not built)

This one part needs internet. Official WhatsApp Cloud API: approved templates, one-click broadcast to opted-in customers, invoice on WhatsApp, payment/warranty reminders.
