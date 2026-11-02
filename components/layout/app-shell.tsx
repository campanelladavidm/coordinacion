import { Suspense } from "react";
import type { ReactNode } from "react";
import { NavLinks } from "@/components/layout/nav-links";
import { SessionControls } from "@/components/layout/session-controls";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { TaskNotifications } from "@/components/layout/task-notifications";
import { WorkspaceFrame } from "@/components/layout/workspace-frame";
import { CalculatorBubble } from "@/components/liquidaciones/calculator-bubble";
import { WikiBubble } from "@/components/wiki/wiki-bubble";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="app-shell">
      <header className="topbar">
        <a className="brand" href="/" aria-label="Coordi Westnet, inicio">
          <img className="brand-wordmark" src="/brand/coordi-westnet.png" alt="Coordi Westnet instalaciones" />
        </a>
        <Suspense fallback={<nav className="nav-list" aria-label="Navegación principal" />}>
          <NavLinks />
        </Suspense>
        <div className="topbar-tools">
          <ThemeToggle />
          <TaskNotifications />
          <SessionControls />
        </div>
      </header>
      <WorkspaceFrame>{children}</WorkspaceFrame>
      <CalculatorBubble />
      <WikiBubble />
    </div>
  );
}
