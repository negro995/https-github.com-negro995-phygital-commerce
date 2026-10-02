import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { Header } from "@/components/header";
import { Providers } from "@/components/providers";
import "./globals.css";

export const metadata: Metadata = {
  title: "Phygital — shop, collect, get rewarded",
  description: "Physical & digital products with soulbound Digital Twins, automatic loyalty rewards and an AI shopping concierge.",
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#4f46e5" };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-dvh">
        <Providers>
          <div className="no-print">
            <Header />
          </div>
          <main>{children}</main>
        </Providers>
      </body>
    </html>
  );
}
