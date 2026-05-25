import type { Metadata } from "next";
import "./globals.css";

import { tenantConfig } from "@/lib/tenant";

export const metadata: Metadata = {
  title: tenantConfig.appName,
  description: tenantConfig.description,
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
