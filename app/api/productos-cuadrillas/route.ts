import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const ROLES = ["COORDINADOR", "SUPERVISOR", "JEFE", "SOPORTE"];
const EDITORES = ["SUPERVISOR", "JEFE"];
const PRODUCTOS = {
  fibra: "producto_fibra",
  wireless: "producto_wireless",
  fibra_iptv: "producto_fibra_iptv",
  wireless_iptv: "producto_wireless_iptv",
  insitu: "producto_insitu",
  gamer: "producto_gamer",
  home_max: "producto_home_max",
} as const;
type ProductColumn = typeof PRODUCTOS[keyof typeof PRODUCTOS];

async function actor(request: NextRequest) {
  const session = await createClient();
  const { data: { user }, error: userError } = await session.auth.getUser();
  if (userError || !user) return { response: NextResponse.json({ error: "Iniciá sesión para continuar." }, { status: 401 }) };
  const { data: realRole, error: roleError } = await session.rpc("mi_rol");
  if (roleError) return { response: NextResponse.json({ error: "No se pudo validar tu rol." }, { status: 503 }) };
  if (!realRole || !ROLES.includes(realRole)) return { response: NextResponse.json({ error: "No tenés permiso para ver los productos por cuadrilla." }, { status: 403 }) };

  const contextId = request.headers.get("x-user-context");
  if (!contextId) return { rol: realRole };
  if (realRole !== "JEFE") return { response: NextResponse.json({ error: "Solo Jefatura puede operar en el contexto de otro usuario." }, { status: 403 }) };
  try {
    const admin = createAdminClient();
    const { data: profile, error } = await admin.from("usuarios").select("id,rol_id,activo").eq("id", contextId).maybeSingle();
    if (error) throw error;
    if (!profile?.activo) return { response: NextResponse.json({ error: "El usuario seleccionado no existe o está inactivo." }, { status: 404 }) };
    const { data: role, error: roleLookupError } = await admin.from("roles").select("codigo").eq("id", profile.rol_id).single();
    if (roleLookupError) throw roleLookupError;
    if (!ROLES.includes(role.codigo)) return { response: NextResponse.json({ error: "El rol seleccionado no es válido." }, { status: 403 }) };
    return { rol: role.codigo };
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : "No se pudo validar el usuario seleccionado.";
    return { response: NextResponse.json({ error: message }, { status: message.includes("SUPABASE_SECRET_KEY") ? 503 : 500 }) };
  }
}

function errorResponse(cause: unknown) {
  const message = cause instanceof Error ? cause.message : "No se pudieron guardar los productos de las cuadrillas.";
  return NextResponse.json({ error: message }, { status: message.includes("SUPABASE_SECRET_KEY") ? 503 : 500 });
}

function origenPermitido(request: NextRequest) {
  const origin = request.headers.get("origin");
  return !origin || new URL(origin).origin === request.nextUrl.origin;
}

export async function GET(request: NextRequest) {
  const auth = await actor(request);
  if ("response" in auth) return auth.response;
  try {
    const admin = createAdminClient();
    const columns = Object.values(PRODUCTOS).join(",");
    const { data, error } = await admin.from("cuadrillas").select(`id,nombre,orden,${columns}`).eq("activo", true).order("orden").order("nombre");
    if (error) throw error;
    return NextResponse.json({ cuadrillas: data ?? [], canEdit: EDITORES.includes(auth.rol) });
  } catch (cause) { return errorResponse(cause); }
}

export async function PATCH(request: NextRequest) {
  if (!origenPermitido(request)) return NextResponse.json({ error: "Origen de solicitud no permitido." }, { status: 403 });
  const auth = await actor(request);
  if ("response" in auth) return auth.response;
  if (!EDITORES.includes(auth.rol)) return NextResponse.json({ error: "Solo Supervisor y Jefatura pueden cambiar estas opciones." }, { status: 403 });

  try {
    const body = await request.json() as { cuadrillaId?: unknown; producto?: unknown; checked?: unknown };
    const cuadrillaId = typeof body.cuadrillaId === "string" ? body.cuadrillaId : "";
    const producto = typeof body.producto === "string" && body.producto in PRODUCTOS ? body.producto as keyof typeof PRODUCTOS : null;
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(cuadrillaId) || !producto || typeof body.checked !== "boolean") {
      return NextResponse.json({ error: "La cuadrilla o el producto no son válidos." }, { status: 400 });
    }
    const admin = createAdminClient();
    const column = PRODUCTOS[producto];
    const changes = { [column]: body.checked } as Partial<Record<ProductColumn, boolean>>;
    const { data, error } = await admin.from("cuadrillas").update(changes).eq("id", cuadrillaId).eq("activo", true).select("id").maybeSingle();
    if (error) throw error;
    if (!data) return NextResponse.json({ error: "No se encontró una cuadrilla activa." }, { status: 404 });
    return NextResponse.json({ ok: true, checked: body.checked });
  } catch (cause) { return errorResponse(cause); }
}
