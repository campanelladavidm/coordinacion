import { requireRole } from "@/lib/supabase/authorization";
import { LiquidacionesView } from "@/components/liquidaciones/liquidaciones-view";

export const instant = false;

export default async function LiquiPage() {
  await requireRole(["SUPERVISOR", "JEFE"]);
  return <LiquidacionesView />;
}
