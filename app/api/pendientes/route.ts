import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { PENDIENTE_CATEGORIAS, type PendienteCategoria } from "@/lib/pendientes-catalogo";

const ROLES = ["COORDINADOR", "SUPERVISOR", "JEFE", "SOPORTE"];
const CATEGORY_IDS = new Set<string>(PENDIENTE_CATEGORIAS.map((item) => item.id));

async function authenticatedUser() {
  const session = await createClient();
  const [{ data: { user }, error: authError }, { data: role, error: roleError }] = await Promise.all([
    session.auth.getUser(),
    session.rpc("mi_rol"),
  ]);
  if (authError || !user) return { response: NextResponse.json({ error: "Iniciá sesión para continuar." }, { status: 401 }) };
  if (roleError) return { response: NextResponse.json({ error: "No se pudo validar tu rol." }, { status: 503 }) };
  if (!role || !ROLES.includes(role)) return { response: NextResponse.json({ error: "No tenés permiso para acceder." }, { status: 403 }) };
  return { userId: user.id };
}

function permitted(request: NextRequest) {
  const origin = request.headers.get("origin");
  return !origin || new URL(origin).origin === request.nextUrl.origin;
}

function validDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value;
}

function errorResponse(error: unknown) {
  const message = error instanceof Error ? error.message : "No se pudieron consultar los pendientes.";
  const status = message.includes("SUPABASE_SECRET_KEY") ? 503 : 500;
  return NextResponse.json({ error: message }, { status });
}

export async function GET(request: NextRequest) {
  const auth = await authenticatedUser();
  if ("response" in auth) return auth.response;
  const selectedDate = request.nextUrl.searchParams.get("fecha") ?? new Date().toISOString().slice(0, 10);
  if (!validDate(selectedDate)) return NextResponse.json({ error: "La fecha no es válida." }, { status: 400 });

  const from = new Date(`${selectedDate}T00:00:00.000Z`);
  from.setUTCDate(from.getUTCDate() - 29);
  try {
    const admin = createAdminClient();
    const { data, error } = await admin.from("pendientes_diarios")
      .select("fecha,categoria,cantidad")
      .gte("fecha", from.toISOString().slice(0, 10))
      .lte("fecha", selectedDate)
      .order("fecha", { ascending: true });
    if (error) throw error;
    return NextResponse.json({ registros: data ?? [], fecha: selectedDate });
  } catch (error) { return errorResponse(error); }
}

export async function PUT(request: NextRequest) {
  if (!permitted(request)) return NextResponse.json({ error: "Origen de solicitud no permitido." }, { status: 403 });
  const auth = await authenticatedUser();
  if ("response" in auth) return auth.response;
  try {
    const body = await request.json() as { fecha?: unknown; cantidades?: unknown };
    if (!validDate(body.fecha) || !body.cantidades || typeof body.cantidades !== "object" || Array.isArray(body.cantidades)) {
      return NextResponse.json({ error: "Ingresá una fecha y cantidades válidas." }, { status: 400 });
    }
    const cantidades = body.cantidades as Record<string, unknown>;
    const registros = PENDIENTE_CATEGORIAS.map(({ id }) => {
      const cantidad = cantidades[id];
      return typeof cantidad === "number" && Number.isSafeInteger(cantidad) && cantidad >= 0
        ? { fecha: body.fecha as string, categoria: id as PendienteCategoria, cantidad, creado_por: auth.userId, updated_at: new Date().toISOString() }
        : null;
    });
    if (registros.some((item) => item === null) || Object.keys(cantidades).some((key) => !CATEGORY_IDS.has(key))) {
      return NextResponse.json({ error: "Las cantidades deben ser números enteros iguales o mayores a cero para todas las categorías." }, { status: 400 });
    }
    const admin = createAdminClient();
    const { error } = await admin.from("pendientes_diarios").upsert(registros as NonNullable<(typeof registros)[number]>[], { onConflict: "fecha,categoria" });
    if (error) throw error;
    return NextResponse.json({ ok: true, fecha: body.fecha });
  } catch (error) { return errorResponse(error); }
}
