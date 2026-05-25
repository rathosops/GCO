import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "GCO V2",
  description: "Sistema de chamadas GCO V2",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}

