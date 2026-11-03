import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient as createSessionClient } from "@/lib/supabase/server";
import { requestOriginIsAllowed } from "@/lib/security/request-origin";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

async function autenticar(request: NextRequest) {
  const session = await createSessionClient();
  const { data: { user }, error } = await session.auth.getUser();
  if (error || !user) return { response: NextResponse.json({ error: "Iniciá sesión para continuar." }, { status: 401 }) };

  const { data: rolReal, error: roleError } = await session.rpc("mi_rol");
  if (roleError || (rolReal !== "JEFE" && rolReal !== "SUPERVISOR")) {
    return { response: NextResponse.json({ error: "Los descuentos están disponibles solo para Jefe y Supervisor." }, { status: 403 }) };
  }

  let usuarioId = user.id;
  const contextoId = request.headers.get("x-user-context");
  if (contextoId) {
    if (rolReal !== "JEFE") return { response: NextResponse.json({ error: "Solo Jefatura puede operar en el contexto de otro usuario." }, { status: 403 }) };
    const admin = createAdminClient();
    const perfil = await admin.from("usuarios").select("id,activo").eq("id", contextoId).maybeSingle();
    if (perfil.error || !perfil.data?.activo) return { response: NextResponse.json({ error: "El usuario de contexto no está disponible." }, { status: 404 }) };
    usuarioId = perfil.data.id;
  }
  return { usuarioId };
}

function periodoValido(mes: unknown, anio: unknown) {
  return Number.isInteger(Number(mes)) && Number(mes) >= 1 && Number(mes) <= 12
    && Number.isInteger(Number(anio)) && Number(anio) >= 2000 && Number(anio) <= 2200;
}

function errorBase(error: unknown) {
  const code = error && typeof error === "object" && "code" in error ? String(error.code) : "";
  if (code === "42P01") return NextResponse.json({ error: "Falta aplicar la migración 202611030001_liquidaciones_descuentos.sql en Supabase." }, { status: 503 });
  if (code === "42703") return NextResponse.json({ error: "Falta aplicar la migración 202611040001_liquidaciones_descuentos_numero_cliente.sql en Supabase." }, { status: 503 });
  const message = error instanceof Error ? error.message : "No se pudieron guardar los descuentos.";
  if (message.includes("Falta SUPABASE_SECRET_KEY")) return NextResponse.json({ error: message }, { status: 503 });
  return NextResponse.json({ error: message }, { status: 500 });
}

export async function GET(request: NextRequest) {
  const auth = await autenticar(request);
  if ("response" in auth) return auth.response;
  const mes = Number(request.nextUrl.searchParams.get("mes"));
  const anio = Number(request.nextUrl.searchParams.get("anio"));
  if (!periodoValido(mes, anio)) return NextResponse.json({ error: "Seleccioná un mes y año válidos." }, { status: 400 });

  try {
    const admin = createAdminClient();
    const result = await admin.from("liquidaciones_descuentos").select("id,ticket,numero_cliente,realiza_id,pertenece_id,motivo,created_at").eq("mes", mes).eq("anio", anio).order("created_at").order("id");
    if (result.error) throw result.error;
    const descuentos = (result.data ?? []).map((row) => ({ id: row.id, ticket: row.ticket, numeroCliente: row.numero_cliente ?? "", realizaId: row.realiza_id ?? "", perteneceId: row.pertenece_id ?? "", motivo: row.motivo }));
    return NextResponse.json({ descuentos });
  } catch (error) { return errorBase(error); }
}

export async function POST(request: NextRequest) {
  if (!requestOriginIsAllowed(request)) return NextResponse.json({ error: "Origen de solicitud no permitido." }, { status: 403 });
  const auth = await autenticar(request);
  if ("response" in auth) return auth.response;

  try {
    const body = await request.json() as Record<string, unknown>;
    const mes = Number(body.mes);
    const anio = Number(body.anio);
    const id = typeof body.id === "string" ? body.id : "";
    const ticket = typeof body.ticket === "string" ? body.ticket.trim() : "";
    const numeroCliente = typeof body.numeroCliente === "string" ? body.numeroCliente.trim() : "";
    const realizaId = typeof body.realizaId === "string" ? body.realizaId : "";
    const perteneceId = typeof body.perteneceId === "string" ? body.perteneceId : "";
    const motivo = typeof body.motivo === "string" ? body.motivo.trim() : "";
    if (!periodoValido(mes, anio) || !uuid.test(id) || ticket.length > 80 || numeroCliente.length > 80 || motivo.length > 1500
      || (realizaId && !uuid.test(realizaId)) || (perteneceId && !uuid.test(perteneceId))) {
      return NextResponse.json({ error: "Revisá los datos del descuento." }, { status: 400 });
    }

    const admin = createAdminClient();
    const idsEmpresa = [...new Set([realizaId, perteneceId].filter(Boolean))];
    if (idsEmpresa.length) {
      const empresas = await admin.from("tercerizadas").select("id").in("id", idsEmpresa);
      if (empresas.error) throw empresas.error;
      if ((empresas.data ?? []).length !== idsEmpresa.length) return NextResponse.json({ error: "Seleccioná una tercerizada válida." }, { status: 400 });
    }

    const existing = await admin.from("liquidaciones_descuentos").select("id,mes,anio,creado_por").eq("id", id).maybeSingle();
    if (existing.error) throw existing.error;
    if (existing.data && (existing.data.mes !== mes || existing.data.anio !== anio)) {
      return NextResponse.json({ error: "El descuento no pertenece al período seleccionado." }, { status: 404 });
    }
    const values = { mes, anio, ticket, numero_cliente: numeroCliente, realiza_id: realizaId || null, pertenece_id: perteneceId || null, motivo, actualizado_por: auth.usuarioId, updated_at: new Date().toISOString() };
    const saved = existing.data
      ? await admin.from("liquidaciones_descuentos").update(values).eq("id", id).eq("mes", mes).eq("anio", anio).select("id,ticket,numero_cliente,realiza_id,pertenece_id,motivo").single()
      : await admin.from("liquidaciones_descuentos").insert({ id, ...values, creado_por: auth.usuarioId }).select("id,ticket,numero_cliente,realiza_id,pertenece_id,motivo").single();
    if (saved.error) throw saved.error;
    const row = saved.data;
    return NextResponse.json({ descuento: { id: row.id, ticket: row.ticket, numeroCliente: row.numero_cliente ?? "", realizaId: row.realiza_id ?? "", perteneceId: row.pertenece_id ?? "", motivo: row.motivo } });
  } catch (error) { return errorBase(error); }
}

export async function DELETE(request: NextRequest) {
  if (!requestOriginIsAllowed(request)) return NextResponse.json({ error: "Origen de solicitud no permitido." }, { status: 403 });
  const auth = await autenticar(request);
  if ("response" in auth) return auth.response;

  try {
    const body = await request.json() as Record<string, unknown>;
    const id = typeof body.id === "string" ? body.id : "";
    const mes = Number(body.mes);
    const anio = Number(body.anio);
    if (!uuid.test(id) || !periodoValido(mes, anio)) return NextResponse.json({ error: "Descuento o período inválido." }, { status: 400 });
    const admin = createAdminClient();
    const deleted = await admin.from("liquidaciones_descuentos").delete().eq("id", id).eq("mes", mes).eq("anio", anio).select("id").maybeSingle();
    if (deleted.error) throw deleted.error;
    if (!deleted.data) return NextResponse.json({ error: "El descuento ya no existe en este período." }, { status: 404 });
    return NextResponse.json({ eliminado: true });
  } catch (error) { return errorBase(error); }
}
