import type { ReactNode } from "react";
import { requireRole } from "@/lib/supabase/authorization";

export const instant = false;

export default async function ConfiguracionesLayout({ children }: Readonly<{ children: ReactNode }>) {
  await requireRole(["SUPERVISOR", "JEFE"]);
  return children;
}
