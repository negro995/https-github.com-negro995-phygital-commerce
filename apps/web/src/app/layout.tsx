import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { Header } from "@/components/header";
import { Providers } from "@/components/providers";
import "./globals.css";

export const metadata: Metadata = {
  title: "Lazo — comprá, coleccioná y ganá beneficios",
  description: "Productos físicos y digitales con Gemelos Digitales, beneficios de fidelidad automáticos y un asistente de compras con IA.",
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#4f46e5" };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="es-AR">
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
