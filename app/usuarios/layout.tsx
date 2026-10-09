import type { ReactNode } from "react";
import { requireRole } from "@/lib/supabase/authorization";

export const instant = false;

export default async function UsuariosLayout({ children }: Readonly<{ children: ReactNode }>) {
  await requireRole(["JEFE"]);
  return children;
}
