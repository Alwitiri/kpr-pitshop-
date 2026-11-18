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
| Customers (CRM) | Profiles, multiple vehicles, purchase history, dues with FIFO payment allocation, active warranties, tags, birthdays, segments, CSV export |
| Job Cards | Vehicle check-in, technician, labour, parts, Kanban board, one-click invoice through POS |
| Products | SKU/barcode, category, brand, variants, bike/car compatibility, HSN/GST, MRP, margin preview, images, warranty, rack location, Excel (CSV) import/export, barcode label printing |
| Inventory | Live stock, stock ledger, adjustments/damage, physical stock check, reorder list, dead stock, stock value by category |
| Purchases & Suppliers | Purchase entry (updates stock and cost), supplier bill upload, part payments, supplier balances, purchase returns |
| Expenses & Cash | Expense categories, cash book by payment method, daily cash closing |
| Staff | 5 roles with permissions, attendance, per-staff sales, activity log |
| Reports | P&L, daily/monthly sales, product/category/brand-wise, GST rate and HSN summary, purchases, payment modes, staff performance, top customers, dues, warranty expiry; all exportable to Excel |
| Settings | Shop/invoice details, backups and restore, network address for other devices |

## Technical notes

- **Stack:** Next.js 16 (App Router, server actions, standalone output), React 19, Tailwind CSS 4, Prisma 6 with SQLite in WAL mode.
- **Packaging:** `scripts/package.mjs` combines the standalone server, a copy of the Node.js that runs the build, `packaging/launcher.js` and the installer scripts. `scripts/make-icon.mjs` draws the icon.
- **Start-up:** `src/instrumentation.ts` → `src/lib/startup.ts` applies migrations, then schedules the daily backups.
- **Money logic:** selling prices include GST. `src/lib/calc.ts` is shared by the POS screen and the server, and the server recalculates everything.
- **Stock integrity:** each stock change goes through `moveStock()` inside a transaction and writes a ledger row.
- **Security:** a random `AUTH_SECRET` is generated per install in `data\config.json`. Passwords are bcrypt-hashed and sessions are httpOnly cookies (12 h). Cookies are not marked secure, because shop devices use plain http on the local network.

## Next: WhatsApp module (not built)

This one part needs internet. Official WhatsApp Cloud API: approved templates, one-click broadcast to opted-in customers, invoice on WhatsApp, payment/warranty reminders.
