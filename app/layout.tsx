import type { Metadata } from "next";
import type { ReactNode } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { DemoDataProvider } from "@/components/providers/demo-data-provider";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Coordinaciones WN", template: "%s | Coordinaciones WN" },
  description: "Coordinación diaria del área de instalaciones.",
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return <html lang="es"><body><DemoDataProvider><AppShell>{children}</AppShell></DemoDataProvider></body></html>;
}
