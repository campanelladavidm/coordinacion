import Link from "next/link";
import { Suspense } from "react";
import type { ReactNode } from "react";
import { NavLinks } from "@/components/layout/nav-links";
import { SessionControls } from "@/components/layout/session-controls";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <Link className="brand" href="/" aria-label="Coordinaciones WN, inicio">
          <span className="brand-mark">WN</span>
          <span className="brand-copy"><span className="brand-name">Coordinaciones WN</span><span className="brand-caption">Área de instalaciones</span></span>
        </Link>
        <p className="nav-label">Espacio de trabajo</p>
        <Suspense fallback={<nav className="nav-list" aria-label="Navegación principal"><Link className="nav-link" href="/">Calendario</Link></nav>}><NavLinks /></Suspense>
        <div className="sidebar-bottom">Coordinación operativa</div>
      </aside>
      <div className="workspace">
        <header className="topbar"><div className="topbar-tools"><SessionControls /></div></header>
        <main className="main-content">{children}</main>
      </div>
    </div>
  );
}


