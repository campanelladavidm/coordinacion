import { Suspense } from "react";
import type { ReactNode } from "react";
import { NavLinks } from "@/components/layout/nav-links";
import { WorkspaceFrame } from "@/components/layout/workspace-frame";
import { CalculatorBubble } from "@/components/liquidaciones/calculator-bubble";
import { WikiBubble } from "@/components/wiki/wiki-bubble";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="app-shell">
      <Suspense fallback={<aside className="app-sidebar app-sidebar-loading" aria-hidden="true" />}>
        <NavLinks />
      </Suspense>
      <WorkspaceFrame>{children}</WorkspaceFrame>
      <CalculatorBubble />
      <WikiBubble />
    </div>
  );
}
