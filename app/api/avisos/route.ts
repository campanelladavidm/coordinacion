import { NextRequest, NextResponse } from "next/server";
import { createClient as createSessionClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

function errorServidor(error: unknown) {
  const mensaje = error instanceof Error ? error.message : "Ocurrió un error al administrar avisos.";
  return NextResponse.json({ error: mensaje }, { status: mensaje.includes("Falta SUPABASE_SECRET_KEY") ? 503 : 500 });
}

async function actorDe(request: NextRequest) {
  const session = await createSessionClient();
  const { data: { user }, error } = await session.auth.getUser();
  if (error || !user) return { response: NextResponse.json({ error: "Iniciá sesión para continuar." }, { status: 401 }) };
  let usuarioId = user.id;
  const contextoId = request.headers.get("x-user-context");
  if (contextoId) {
    const { data: rol, error: rolError } = await session.rpc("mi_rol");
    if (rolError) return { response: NextResponse.json({ error: "No se pudo validar tu rol." }, { status: 503 }) };
    if (rol !== "JEFE") return { response: NextResponse.json({ error: "No tenés permiso para operar en el contexto de otro usuario." }, { status: 403 }) };
    usuarioId = contextoId;
  }
  return { usuarioId };
}

function origenPermitido(request: NextRequest) {
  const origin = request.headers.get("origin");
  return !origin || new URL(origin).origin === request.nextUrl.origin;
}

export async function GET(request: NextRequest) {
  const auth = await actorDe(request);
  if ("response" in auth) return auth.response;
  try {
    const admin = createAdminClient();
    const fechaPartes = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Argentina/Buenos_Aires", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
    const hoy = `${fechaPartes.find((parte) => parte.type === "year")?.value}-${fechaPartes.find((parte) => parte.type === "month")?.value}-${fechaPartes.find((parte) => parte.type === "day")?.value}`;
    const [{ data: usuarios, error: usuariosError }, { data: asignaciones, error: asignacionesError }, { data: cerrados, error: cerradosError }] = await Promise.all([
      admin.from("usuarios").select("id,nombre_completo").eq("activo", true).order("nombre_completo"),
      admin.from("aviso_destinatarios").select("aviso_id").eq("usuario_id", auth.usuarioId),
      admin.from("avisos_cerrados").select("aviso_id").eq("usuario_id", auth.usuarioId),
    ]);
    if (usuariosError) throw usuariosError;
    if (!(usuarios ?? []).some((usuario) => usuario.id === auth.usuarioId)) return NextResponse.json({ error: "El usuario no existe o está inactivo." }, { status: 403 });
    if (asignacionesError) throw asignacionesError;
    if (cerradosError) throw cerradosError;
    const ids = (asignaciones ?? []).map((row) => row.aviso_id);
    const cerradosIds = new Set((cerrados ?? []).map((row) => row.aviso_id));
    const avisos = ids.length ? await admin.from("avisos").select("id,texto,desde,hasta").in("id", ids).lte("desde", hoy).gte("hasta", hoy).order("created_at", { ascending: false }) : { data: [], error: null };
    if (avisos.error) throw avisos.error;
    return NextResponse.json({ usuarios: (usuarios ?? []).map((u) => ({ id: u.id, nombre: u.nombre_completo || "Usuario" })), avisos: (avisos.data ?? []).filter((aviso) => !cerradosIds.has(aviso.id)) });
  } catch (error) { return errorServidor(error); }
}

export async function POST(request: NextRequest) {
  if (!origenPermitido(request)) return NextResponse.json({ error: "Origen de solicitud no permitido." }, { status: 403 });
  const auth = await actorDe(request);
  if ("response" in auth) return auth.response;
  try {
    const body = await request.json() as { texto?: unknown; desde?: unknown; hasta?: unknown; destinatarios?: unknown };
    const texto = typeof body.texto === "string" ? body.texto.trim() : "";
    const desde = typeof body.desde === "string" ? body.desde : "";
    const hasta = typeof body.hasta === "string" ? body.hasta : "";
    const destinatarios = Array.isArray(body.destinatarios) ? [...new Set(body.destinatarios.filter((id): id is string => typeof id === "string"))] : [];
    const esFecha = (value: string) => {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
      const fecha = new Date(`${value}T00:00:00Z`);
      return !Number.isNaN(fecha.getTime()) && fecha.toISOString().slice(0, 10) === value;
    };
    if (!texto || texto.length > 200) return NextResponse.json({ error: "El texto debe tener entre 1 y 200 caracteres." }, { status: 400 });
    if (!esFecha(desde) || !esFecha(hasta) || hasta < desde) return NextResponse.json({ error: "Seleccioná un rango de fechas válido." }, { status: 400 });
    if (!destinatarios.length || destinatarios.some((id) => !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id))) return NextResponse.json({ error: "Elegí al menos un destinatario válido." }, { status: 400 });
    const admin = createAdminClient();
    const { data: usuarios, error: usuariosError } = await admin.from("usuarios").select("id").eq("activo", true).in("id", destinatarios);
    if (usuariosError) throw usuariosError;
    if ((usuarios?.length ?? 0) !== destinatarios.length) return NextResponse.json({ error: "La lista incluye usuarios inactivos o inválidos." }, { status: 400 });
    const { data: aviso, error: avisoError } = await admin.from("avisos").insert({ texto, desde, hasta, creado_por: auth.usuarioId }).select("id").single();
    if (avisoError) throw avisoError;
    const { error: asignacionError } = await admin.from("aviso_destinatarios").insert(destinatarios.map((usuario_id) => ({ aviso_id: aviso.id, usuario_id })));
    if (asignacionError) {
      await admin.from("avisos").delete().eq("id", aviso.id);
      throw asignacionError;
    }
    return NextResponse.json({ id: aviso.id }, { status: 201 });
  } catch (error) { return errorServidor(error); }
}

export async function PATCH(request: NextRequest) {
  if (!origenPermitido(request)) return NextResponse.json({ error: "Origen de solicitud no permitido." }, { status: 403 });
  const auth = await actorDe(request);
  if ("response" in auth) return auth.response;
  try {
    const body = await request.json() as { id?: unknown };
    const id = typeof body.id === "string" ? body.id : "";
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) return NextResponse.json({ error: "El aviso no es válido." }, { status: 400 });
    const admin = createAdminClient();
    const { data: asignado, error: lecturaError } = await admin.from("aviso_destinatarios").select("aviso_id").eq("aviso_id", id).eq("usuario_id", auth.usuarioId).maybeSingle();
    if (lecturaError) throw lecturaError;
    if (!asignado) return NextResponse.json({ error: "Este aviso no está dirigido a ese usuario." }, { status: 404 });
    const { error } = await admin.from("avisos_cerrados").upsert({ aviso_id: id, usuario_id: auth.usuarioId });
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (error) { return errorServidor(error); }
}
