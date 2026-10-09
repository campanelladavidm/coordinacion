import "server-only";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type AppRole = "COORDINADOR" | "SUPERVISOR" | "JEFE";

export async function requireRole(allowedRoles: readonly AppRole[]) {
  const supabase = await createClient();
  const { data: { user }, error: userError } = await supabase.auth.getUser();

  if (userError || !user) redirect("/login");

  const { data: role, error: roleError } = await supabase.rpc("mi_rol");
  if (roleError) throw new Error("No se pudo validar el rol de acceso.");
  if (!role || !allowedRoles.includes(role as AppRole)) redirect("/");
}
