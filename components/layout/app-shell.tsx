import { Suspense } from "react";
import type { ReactNode } from "react";
import { NavLinks } from "@/components/layout/nav-links";
import { SessionControls } from "@/components/layout/session-controls";
import { ThemeToggle } from "@/components/layout/theme-toggle";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="app-shell">
      <header className="topbar">
        <a className="brand" href="/" aria-label="Coordi Westnet, inicio">
          <img className="brand-phone" src="/brand/phone.png" alt="" />
          <img className="brand-wordmark" src="/brand/coordi-westnet.png" alt="Coordi Westnet instalaciones" />
        </a>
        <Suspense fallback={<nav className="nav-list" aria-label="Navegación principal" />}>
          <NavLinks />
        </Suspense>
        <div className="topbar-tools">
          <ThemeToggle />
          <SessionControls />
        </div>
      </header>
      <div className="workspace">
        <main className="main-content">{children}</main>
      </div>
    </div>
  );
}
