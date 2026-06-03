import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Pollon — Polla del Mundial 2026",
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
      <body>{children}</body>
    </html>
  );
}
