import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Spoaxio Software", template: "%s · Spoaxio Software" },
  description: "Spoaxio Software – billing, stock, customers and WhatsApp for the shop, works offline",
  applicationName: "Spoaxio Software",
  // iPhone / iPad "Add to Home Screen": opens full screen like an app
  appleWebApp: { capable: true, title: "Spoaxio", statusBarStyle: "black" },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: "#0b0f19",
  width: "device-width",
  initialScale: 1,
};

// Uses the computer's own fonts (Segoe UI on Windows), so nothing is downloaded –
// the app and its build work fully offline.
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-IN" className="h-full antialiased">
      <body className="min-h-full font-sans">{children}</body>
    </html>
  );
}
