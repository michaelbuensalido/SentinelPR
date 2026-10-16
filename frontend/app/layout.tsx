import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "SentinelPR",
  description: "Codebase-aware autonomous PR reviewer",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="overflow-x-hidden w-full max-w-full">
      <body className="font-sans antialiased overflow-x-hidden w-full max-w-full">{children}</body>
    </html>
  );
}
