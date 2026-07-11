import type { Metadata } from "next";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";

import { Toaster } from "@/components/ui/sonner";

export const metadata: Metadata = {
  title: {
    default: "Pollon · Polla del Mundial 2026",
    template: "%s · Pollon",
  },
  description:
    "Predice los resultados del Mundial 2026 y compite con tus amigos.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body>
        {children}
        <Toaster />
        <Analytics />
      </body>
    </html>
  );
}
