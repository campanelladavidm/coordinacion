"use client";

import { Suspense, type ReactNode } from "react";
import { usePathname } from "next/navigation";

function ActiveWorkspace({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const isCalendar = pathname === "/";

  return (
    <div className={`workspace${isCalendar ? " is-calendar-workspace" : ""}`}>
      <main className="main-content">{children}</main>
    </div>
  );
}

export function WorkspaceFrame({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={<div className="workspace"><main className="main-content">{children}</main></div>}>
      <ActiveWorkspace>{children}</ActiveWorkspace>
    </Suspense>
  );
}
