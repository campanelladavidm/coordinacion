import { NextRequest, NextResponse } from "next/server";
import { createClient as createSessionClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { MOTIVOS_NOVEDAD } from "@/lib/novedades";

async function obtenerActor(request?: NextRequest) {
  const session = await createSessionClient();
  const { data: { user }, error: authError } = await session.auth.getUser();
  if (authError || !user) return { response: NextResponse.json({ error: "Iniciá sesión para continuar." }, { status: 401 }) };
  const { data: rol, error: roleError } = await session.rpc("mi_rol");
  if (roleError) return { response: NextResponse.json({ error: "No se pudo validar tu rol." }, { status: 503 }) };
  if (!rol || !["COORDINADOR", "SUPERVISOR", "JEFE"].includes(rol)) {
    return { response: NextResponse.json({ error: "No tenés permiso para acceder a las novedades." }, { status: 403 }) };
  }
  const contextoId = request?.headers.get("x-user-context");
  if (contextoId) {
    if (rol !== "JEFE") return { response: NextResponse.json({ error: "Solo Jefatura puede operar en el contexto de otro usuario." }, { status: 403 }) };
    try {
      const admin = createAdminClient();
      const perfil = await admin.from("usuarios").select("id,nombre_completo,rol_id,activo").eq("id", contextoId).maybeSingle();
      if (perfil.error) throw perfil.error;
      if (!perfil.data?.activo) return { response: NextResponse.json({ error: "El usuario elegido no existe o está inactivo." }, { status: 404 }) };
      const targetRole = await admin.from("roles").select("codigo").eq("id", perfil.data.rol_id).single();
      if (targetRole.error) throw targetRole.error;
      const code = targetRole.data.codigo;
      return { actor: { id: perfil.data.id, rol: code, jefeAutenticadoId: user.id } };
    } catch (error) {
      return { response: errorServidor(error) };
    }
  }
  return { actor: { id: user.id, rol, jefeAutenticadoId: rol === "JEFE" ? user.id : null } };
}

function origenPermitido(request: NextRequest) {
  const origin = request.headers.get("origin");
  return !origin || new URL(origin).origin === request.nextUrl.origin;
}

function errorServidor(error: unknown) {
  const message = error instanceof Error ? error.message : "Ocurrió un error al guardar la novedad.";
  const status = message.includes("Falta SUPABASE_SECRET_KEY") ? 503 : 500;
  return NextResponse.json({ error: message }, { status });
}

async function registrarActuacionJefe(
  admin: ReturnType<typeof createAdminClient>,
  actor: { id: string; jefeAutenticadoId: string | null },
  operation: string,
  rowId: string,
  previous: unknown,
  next: unknown,
) {
  if (!actor.jefeAutenticadoId || actor.jefeAutenticadoId === actor.id) return;
  const { error } = await admin.from("actuaciones_jefe").insert({
    jefe_id: actor.jefeAutenticadoId, usuario_contexto_id: actor.id,
    tabla: "novedades", operacion: operation, fila_id: rowId,
    datos_anteriores: previous, datos_nuevos: next,
  });
  if (error) console.error("No se pudo registrar la auditoría de una novedad.", error);
}

export async function GET(request: NextRequest) {
  const auth = await obtenerActor(request);
  if ("response" in auth) return auth.response;
  try {
    const admin = createAdminClient();
    let query = admin.from("novedades").select("id,fecha,motivo,descripcion,tiempo_devuelto,detalle_devolucion,creado_por,created_at").order("fecha", { ascending: false }).order("created_at", { ascending: false });
    if (auth.actor.rol !== "JEFE") query = query.eq("creado_por", auth.actor.id);
    const { data: rows, error } = await query;
    if (error) throw error;

    const authorIds = [...new Set((rows ?? []).map((row) => row.creado_por))];
    const authors = authorIds.length
      ? await admin.from("usuarios").select("id,nombre_completo").in("id", authorIds)
      : { data: [], error: null };
    if (authors.error) throw authors.error;
    const names = new Map((authors.data ?? []).map((author) => [author.id, author.nombre_completo || "Usuario"]));

    const reviewIds = auth.actor.rol === "JEFE" ? (rows ?? []).map((row) => row.id) : [];
    const reviews = reviewIds.length
      ? await admin.from("novedades_vistas").select("novedad_id").eq("jefe_id", auth.actor.id).in("novedad_id", reviewIds)
      : { data: [], error: null };
    if (reviews.error) throw reviews.error;
    const seen = new Set((reviews.data ?? []).map((review) => review.novedad_id));

    return NextResponse.json({
      rol: auth.actor.rol,
      novedades: (rows ?? []).map((row) => ({
        id: row.id, fecha: row.fecha, motivo: row.motivo, descripcion: row.descripcion,
        tiempoDevuelto: row.tiempo_devuelto, detalleDevolucion: row.detalle_devolucion,
        creadoPor: row.creado_por, nombreUsuario: names.get(row.creado_por) ?? "Usuario",
        createdAt: row.created_at, revisada: seen.has(row.id),
      })),
    });
  } catch (error) {
    return errorServidor(error);
  }
}

export async function POST(request: NextRequest) {
  if (!origenPermitido(request)) return NextResponse.json({ error: "Origen de solicitud no permitido." }, { status: 403 });
  const auth = await obtenerActor(request);
  if ("response" in auth) return auth.response;
  if (auth.actor.rol === "JEFE") return NextResponse.json({ error: "El rol Jefe puede consultar y revisar novedades, pero no cargarlas." }, { status: 403 });
  try {
    const body = await request.json() as Record<string, unknown>;
    const fecha = typeof body.fecha === "string" ? body.fecha : "";
    const motivoSeleccionado = typeof body.motivo === "string" ? body.motivo : "";
    const otroMotivo = typeof body.otroMotivo === "string" ? body.otroMotivo.trim() : "";
    const motivo = motivoSeleccionado === "Otro" ? otroMotivo : motivoSeleccionado;
    const descripcion = typeof body.descripcion === "string" ? body.descripcion.trim() : "";
    const tiempoDevuelto = body.tiempoDevuelto === true;
    const detalleDevolucion = typeof body.detalleDevolucion === "string" ? body.detalleDevolucion.trim() : "";
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha) || Number.isNaN(Date.parse(`${fecha}T00:00:00Z`))) {
      return NextResponse.json({ error: "Ingresá una fecha válida." }, { status: 400 });
    }
    if (!(MOTIVOS_NOVEDAD as readonly string[]).includes(motivoSeleccionado)) return NextResponse.json({ error: "Seleccioná un motivo válido." }, { status: 400 });
    if (!motivo || motivo.length > 80) return NextResponse.json({ error: "Escribí un motivo de hasta 80 caracteres." }, { status: 400 });
    if (!descripcion || descripcion.length > 2000) return NextResponse.json({ error: "La descripción es obligatoria y admite hasta 2000 caracteres." }, { status: 400 });
    if (tiempoDevuelto && (!detalleDevolucion || detalleDevolucion.length > 300)) {
      return NextResponse.json({ error: "Indicá cuándo fue devuelto el tiempo (hasta 300 caracteres)." }, { status: 400 });
    }

    const admin = createAdminClient();
    const { data, error } = await admin.from("novedades").insert({
      fecha, motivo, descripcion, tiempo_devuelto: tiempoDevuelto,
      detalle_devolucion: tiempoDevuelto ? detalleDevolucion : null, creado_por: auth.actor.id,
    }).select("id").single();
    if (error) throw error;
    await registrarActuacionJefe(admin, auth.actor, "INSERT", data.id, null, { fecha, motivo, descripcion, tiempo_devuelto: tiempoDevuelto, detalle_devolucion: tiempoDevuelto ? detalleDevolucion : null });
    return NextResponse.json({ id: data.id }, { status: 201 });
  } catch (error) {
    return errorServidor(error);
  }
}

export async function PATCH(request: NextRequest) {
  if (!origenPermitido(request)) return NextResponse.json({ error: "Origen de solicitud no permitido." }, { status: 403 });
  const auth = await obtenerActor(request);
  if ("response" in auth) return auth.response;
  if (auth.actor.rol !== "JEFE") return actualizarNovedad(request, auth.actor);

  try {
    const body = await request.json() as { id?: unknown; revisada?: unknown };
    const id = typeof body.id === "string" ? body.id : "";
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id) || typeof body.revisada !== "boolean") {
      return NextResponse.json({ error: "La novedad o el estado de revisión no son válidos." }, { status: 400 });
    }

    const admin = createAdminClient();
    if (body.revisada) {
      const { error } = await admin.from("novedades_vistas").upsert({ novedad_id: id, jefe_id: auth.actor.id, revisado_at: new Date().toISOString() });
      if (error) throw error;
    } else {
      const { error } = await admin.from("novedades_vistas").delete().eq("novedad_id", id).eq("jefe_id", auth.actor.id);
      if (error) throw error;
    }
    await registrarActuacionJefe(admin, auth.actor, body.revisada ? "REVIEW" : "UNREVIEW", id, { revisada: !body.revisada }, { revisada: body.revisada });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return errorServidor(error);
  }
}

async function actualizarNovedad(request: NextRequest, actor: { id: string; rol: string; jefeAutenticadoId: string | null }) {
  try {
    const body = await request.json() as Record<string, unknown>;
    const id = typeof body.id === "string" ? body.id : "";
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) return NextResponse.json({ error: "La novedad no es válida." }, { status: 400 });
    const fecha = typeof body.fecha === "string" ? body.fecha : "";
    const motivoSeleccionado = typeof body.motivo === "string" ? body.motivo : "";
    const otroMotivo = typeof body.otroMotivo === "string" ? body.otroMotivo.trim() : "";
    const motivo = motivoSeleccionado === "Otro" ? otroMotivo : motivoSeleccionado;
    const descripcion = typeof body.descripcion === "string" ? body.descripcion.trim() : "";
    const tiempoDevuelto = body.tiempoDevuelto === true;
    const detalleDevolucion = typeof body.detalleDevolucion === "string" ? body.detalleDevolucion.trim() : "";
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha) || Number.isNaN(Date.parse(`${fecha}T00:00:00Z`))) return NextResponse.json({ error: "Ingresá una fecha válida." }, { status: 400 });
    if (!(MOTIVOS_NOVEDAD as readonly string[]).includes(motivoSeleccionado)) return NextResponse.json({ error: "Seleccioná un motivo válido." }, { status: 400 });
    if (!motivo || motivo.length > 80) return NextResponse.json({ error: "Escribí un motivo de hasta 80 caracteres." }, { status: 400 });
    if (!descripcion || descripcion.length > 2000) return NextResponse.json({ error: "La descripción es obligatoria y admite hasta 2000 caracteres." }, { status: 400 });
    if (tiempoDevuelto && (!detalleDevolucion || detalleDevolucion.length > 300)) return NextResponse.json({ error: "Indicá cuándo fue devuelto el tiempo (hasta 300 caracteres)." }, { status: 400 });

    const admin = createAdminClient();
    const { data: previous, error: readError } = await admin.from("novedades").select("id,fecha,motivo,descripcion,tiempo_devuelto,detalle_devolucion,creado_por").eq("id", id).eq("creado_por", actor.id).maybeSingle();
    if (readError) throw readError;
    if (!previous) return NextResponse.json({ error: "No se encontró una novedad propia para editar." }, { status: 404 });
    const next = { fecha, motivo, descripcion, tiempo_devuelto: tiempoDevuelto, detalle_devolucion: tiempoDevuelto ? detalleDevolucion : null };
    const { error } = await admin.from("novedades").update(next).eq("id", id).eq("creado_por", actor.id);
    if (error) throw error;
    await registrarActuacionJefe(admin, actor, "UPDATE", id, previous, next);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return errorServidor(error);
  }
}

export async function DELETE(request: NextRequest) {
  if (!origenPermitido(request)) return NextResponse.json({ error: "Origen de solicitud no permitido." }, { status: 403 });
  const auth = await obtenerActor(request);
  if ("response" in auth) return auth.response;
  if (auth.actor.rol === "JEFE") return NextResponse.json({ error: "Jefatura debe elegir el usuario que cargó la novedad." }, { status: 403 });
  try {
    const body = await request.json() as { id?: unknown };
    const id = typeof body.id === "string" ? body.id : "";
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) return NextResponse.json({ error: "La novedad no es válida." }, { status: 400 });
    const admin = createAdminClient();
    const { data: previous, error: readError } = await admin.from("novedades").select("id,fecha,motivo,descripcion,tiempo_devuelto,detalle_devolucion,creado_por").eq("id", id).eq("creado_por", auth.actor.id).maybeSingle();
    if (readError) throw readError;
    if (!previous) return NextResponse.json({ error: "No se encontró una novedad propia para eliminar." }, { status: 404 });
    const { error } = await admin.from("novedades").delete().eq("id", id).eq("creado_por", auth.actor.id);
    if (error) throw error;
    await registrarActuacionJefe(admin, auth.actor, "DELETE", id, previous, null);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return errorServidor(error);
  }
}
