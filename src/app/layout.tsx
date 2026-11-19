import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "KPR Pitstop", template: "%s · KPR Pitstop" },
  description: "Business management system for KPR Pitstop N Sportz",
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
