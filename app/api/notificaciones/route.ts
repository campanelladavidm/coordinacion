import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { esUuid, obtenerTareasActor, origenTareasPermitido, responderErrorTareas } from "@/lib/tareas-api";

export async function GET(request: NextRequest) {
  const auth = await obtenerTareasActor(request);
  if ("response" in auth) return auth.response;

  try {
    const admin = createAdminClient();
    const [notificationsResult, unreadResult] = await Promise.all([
      admin.from("notificaciones_tareas").select("id,tarea_id,tipo,titulo,mensaje,created_at,leida_at")
        .eq("usuario_id", auth.actor.id).order("created_at", { ascending: false }).limit(1000),
      admin.from("notificaciones_tareas").select("id", { count: "exact", head: true })
        .eq("usuario_id", auth.actor.id).is("leida_at", null),
    ]);

    if (notificationsResult.error) throw notificationsResult.error;
    if (unreadResult.error) throw unreadResult.error;

    return NextResponse.json({
      notificaciones: notificationsResult.data ?? [],
      sinLeer: unreadResult.count ?? 0,
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const code = typeof error === "object" && error !== null && "code" in error ? String(error.code) : "";
    if (code === "PGRST205" || code === "42P01") {
      return NextResponse.json({ error: "Las notificaciones todavía no están activadas en Supabase. Aplicá la migración de notificaciones de tareas." }, { status: 503 });
    }
    return responderErrorTareas(error);
  }
}

export async function PATCH(request: NextRequest) {
  if (!origenTareasPermitido(request)) return NextResponse.json({ error: "Origen de solicitud no permitido." }, { status: 403 });
  const auth = await obtenerTareasActor(request);
  if ("response" in auth) return auth.response;

  try {
    const body = await request.json() as Record<string, unknown>;
    const admin = createAdminClient();
    const leidaAt = new Date().toISOString();

    if (body.todas === true) {
      const { data, error } = await admin.from("notificaciones_tareas").update({ leida_at: leidaAt })
        .eq("usuario_id", auth.actor.id).is("leida_at", null).select("id");
      if (error) throw error;
      return NextResponse.json({ ok: true, actualizadas: data?.length ?? 0 });
    }

    if (!esUuid(body.id)) return NextResponse.json({ error: "La notificación no es válida." }, { status: 400 });
    const { data, error } = await admin.from("notificaciones_tareas").update({ leida_at: leidaAt })
      .eq("id", body.id).eq("usuario_id", auth.actor.id).is("leida_at", null).select("id").maybeSingle();
    if (error) throw error;
    return NextResponse.json({ ok: true, actualizada: Boolean(data) });
  } catch (error) {
    return responderErrorTareas(error);
  }
}
