import type { ReactNode } from "react";
import { requireRole } from "@/lib/supabase/authorization";

export const instant = false;

export default async function CoordinacionesLayout({ children }: Readonly<{ children: ReactNode }>) {
  await requireRole(["COORDINADOR", "SUPERVISOR", "JEFE"]);
  return children;
}
