import { NextRequest, NextResponse } from "next/server";
import { createClient as createSessionClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const ROLES = ["COORDINADOR", "SUPERVISOR", "JEFE", "SOPORTE"];

export type TareasActor = { id: string; rol: string };

export async function obtenerTareasActor(request: NextRequest) {
  const session = await createSessionClient();
  const { data: { user }, error: userError } = await session.auth.getUser();
  if (userError || !user) return { response: NextResponse.json({ error: "Iniciá sesión para continuar." }, { status: 401 }) };
  const { data: rolReal, error: roleError } = await session.rpc("mi_rol");
  if (roleError) return { response: NextResponse.json({ error: "No se pudo validar tu rol." }, { status: 503 }) };
  if (!rolReal || !ROLES.includes(rolReal)) return { response: NextResponse.json({ error: "No tenés permiso para acceder a Tareas." }, { status: 403 }) };

  const contextoId = request.headers.get("x-user-context");
  let actor: TareasActor = { id: user.id, rol: rolReal };
  if (contextoId) {
    if (rolReal !== "JEFE") return { response: NextResponse.json({ error: "Solo Jefatura puede operar en el contexto de otro usuario." }, { status: 403 }) };
    const admin = createAdminClient();
    const { data: profile, error } = await admin.from("usuarios").select("id,rol_id,activo").eq("id", contextoId).maybeSingle();
    if (error) return { response: NextResponse.json({ error: "No se pudo validar el usuario seleccionado." }, { status: 500 }) };
    if (!profile?.activo) return { response: NextResponse.json({ error: "El usuario seleccionado no existe o está inactivo." }, { status: 404 }) };
    const { data: role, error: roleLookupError } = await admin.from("roles").select("codigo").eq("id", profile.rol_id).single();
    if (roleLookupError || !role || !ROLES.includes(role.codigo)) return { response: NextResponse.json({ error: "El rol del usuario seleccionado no es válido." }, { status: 403 }) };
    actor = { id: profile.id, rol: role.codigo };
  }

  const admin = createAdminClient();
  const { data: active, error: activeError } = await admin.from("usuarios").select("id").eq("id", actor.id).eq("activo", true).maybeSingle();
  if (activeError) return { response: NextResponse.json({ error: "No se pudo validar tu usuario." }, { status: 500 }) };
  if (!active) return { response: NextResponse.json({ error: "Tu usuario está inactivo." }, { status: 403 }) };
  return { actor };
}

export function origenTareasPermitido(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  try {
    const originHost = new URL(origin).host.toLowerCase();
    // Behind Vercel/reverse proxies nextUrl.origin can resolve to the deployment
    // host instead of the public alias the browser used. Compare with the host
    // values forwarded from the incoming request instead.
    const hosts = [request.headers.get("host"), request.headers.get("x-forwarded-host")]
      .flatMap((value) => value ? value.split(",").map((host) => host.trim().toLowerCase()) : []);
    return hosts.includes(originHost);
  } catch {
    return false;
  }
}

export function responderErrorTareas(error: unknown) {
  const message = error instanceof Error ? error.message : "Ocurrió un error al procesar la tarea.";
  return NextResponse.json({ error: message }, { status: message.includes("Falta SUPABASE_SECRET_KEY") ? 503 : 500 });
}

export const esUuid = (value: unknown): value is string => typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

export const esSupervisor = (rol: string) => rol === "SUPERVISOR" || rol === "JEFE";
