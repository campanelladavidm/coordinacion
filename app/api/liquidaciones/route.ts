import { NextRequest, NextResponse } from "next/server";
import { createClient as createSessionClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

type Rol = "COORDINADOR" | "SUPERVISOR" | "JEFE";
type FormulaVinculo = { conceptoId: string; modo: "FIJO" | "PORCENTAJE"; valor: number } | { conceptoId: string; adicional: number };
type Concepto = {
  id: string; nombre: string; tipo: "SUMA" | "RESTA"; cantidad: number;
  precio: number; nota: string; enlace: string; formula?: FormulaVinculo;
};

async function actor(request: NextRequest) {
  const session = await createSessionClient();
  const { data: { user }, error } = await session.auth.getUser();
  if (error || !user) return { response: NextResponse.json({ error: "Iniciá sesión para continuar." }, { status: 401 }) };
  const { data: rolReal, error: errorRol } = await session.rpc("mi_rol");
  if (errorRol || !rolReal || !["COORDINADOR", "SUPERVISOR", "JEFE"].includes(rolReal)) {
    return { response: NextResponse.json({ error: "No se pudo validar tu rol." }, { status: 403 }) };
  }
  if (rolReal !== "JEFE" && rolReal !== "SUPERVISOR") {
    return { response: NextResponse.json({ error: "El módulo Liqui está disponible solo para Jefe y Supervisor." }, { status: 403 }) };
  }
  let rolEfectivo = rolReal as Rol;
  let usuarioId = user.id;
  const contextoId = request.headers.get("x-user-context");
  if (contextoId) {
    if (rolReal !== "JEFE") return { response: NextResponse.json({ error: "Solo Jefatura puede operar en el contexto de otro usuario." }, { status: 403 }) };
    const admin = createAdminClient();
    const perfil = await admin.from("usuarios").select("id,rol_id,activo").eq("id", contextoId).maybeSingle();
    if (perfil.error || !perfil.data?.activo) return { response: NextResponse.json({ error: "El usuario de contexto no está disponible." }, { status: 404 }) };
    const rol = await admin.from("roles").select("codigo").eq("id", perfil.data.rol_id).single();
    if (rol.error) return { response: NextResponse.json({ error: "No se pudo validar el rol del usuario seleccionado." }, { status: 503 }) };
    rolEfectivo = rol.data.codigo as Rol;
    usuarioId = perfil.data.id;
  }
  return { actor: { usuarioId, rol: rolEfectivo, rolAutenticado: rolReal as Rol } };
}

function jsonError(error: unknown) {
  const message = error instanceof Error ? error.message : "Ocurrió un error al guardar la liquidación.";
  const code = error && typeof error === "object" && "code" in error ? String(error.code) : "";
  if (code === "42P01" || message.includes("public.liquidaciones") || message.includes("public.liquidaciones_exportaciones")) {
    return NextResponse.json({ error: "Falta aplicar en Supabase la migración 202610150005_liquidaciones.sql." }, { status: 503 });
  }
  const status = message.includes("Falta SUPABASE_SECRET_KEY") ? 503 : 500;
  return NextResponse.json({ error: message }, { status });
}

function origenPermitido(request: NextRequest) {
  const origin = request.headers.get("origin");
  return !origin || new URL(origin).origin === request.nextUrl.origin;
}

function validarConceptos(value: unknown): Concepto[] | null {
  if (!Array.isArray(value) || value.length > 300) return null;
  const result: Concepto[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") return null;
    const row = item as Record<string, unknown>;
    if (typeof row.id !== "string" || typeof row.nombre !== "string" || row.nombre.length > 120) return null;
    if (row.tipo !== "SUMA" && row.tipo !== "RESTA") return null;
    const cantidad = Number(row.cantidad);
    const precio = Number(row.precio);
    if (!Number.isFinite(cantidad) || cantidad < 0 || !Number.isFinite(precio) || precio < 0) return null;
    const formulaRaw = row.formula;
    let formula: Concepto["formula"];
    if (formulaRaw !== undefined) {
      if (!formulaRaw || typeof formulaRaw !== "object") return null;
      const parsed = formulaRaw as Record<string, unknown>;
      if (typeof parsed.conceptoId !== "string") return null;
      if (parsed.modo === "FIJO" || parsed.modo === "PORCENTAJE") {
        const valor = Number(parsed.valor);
        if (!Number.isFinite(valor) || valor < 0) return null;
        formula = { conceptoId: parsed.conceptoId, modo: parsed.modo, valor };
      } else {
        const adicional = Number(parsed.adicional);
        if (!Number.isFinite(adicional) || adicional < 0) return null;
        formula = { conceptoId: parsed.conceptoId, adicional };
      }
    }
    result.push({
      id: row.id, nombre: row.nombre.trim(), tipo: row.tipo, cantidad, precio,
      nota: typeof row.nota === "string" ? row.nota.slice(0, 200).trim() : "",
      enlace: typeof row.enlace === "string" ? row.enlace.slice(0, 1000).trim() : "",
      ...(formula ? { formula } : {}),
    });
  }
  const ids = new Set(result.map((item) => item.id));
  if (result.some((item) => item.formula && (!ids.has(item.formula.conceptoId) || item.formula.conceptoId === item.id))) return null;
  return result;
}

function periodoValido(mes: unknown, anio: unknown) {
  return Number.isInteger(Number(mes)) && Number(mes) >= 1 && Number(mes) <= 12 && Number.isInteger(Number(anio)) && Number(anio) >= 2000 && Number(anio) <= 2200;
}

export async function GET(request: NextRequest) {
  const auth = await actor(request);
  if ("response" in auth) return auth.response;
  const mes = Number(request.nextUrl.searchParams.get("mes"));
  const anio = Number(request.nextUrl.searchParams.get("anio"));
  if (!periodoValido(mes, anio)) return NextResponse.json({ error: "Seleccioná un mes y año válidos." }, { status: 400 });
  try {
    const admin = createAdminClient();
    const [tercerizadas, liquidaciones, exportacion] = await Promise.all([
      admin.from("tercerizadas").select("id,nombre,activo").order("orden").order("nombre"),
      admin.from("liquidaciones").select("id,tercerizada_id,mes,anio,estado,conceptos,finalizado_por,finalizado_at,updated_at").eq("mes", mes).eq("anio", anio),
      admin.from("liquidaciones_exportaciones").select("nombre_archivo,created_at").eq("mes", mes).eq("anio", anio).maybeSingle(),
    ]);
      if (tercerizadas.error) throw tercerizadas.error;
    if (liquidaciones.error) throw liquidaciones.error;
    if (exportacion.error) throw exportacion.error;
    return NextResponse.json({ rol: auth.actor.rol, tercerizadas: tercerizadas.data ?? [], liquidaciones: liquidaciones.data ?? [], exportacion: exportacion.data });
  } catch (error) { return jsonError(error); }
}

export async function POST(request: NextRequest) {
  if (!origenPermitido(request)) return NextResponse.json({ error: "Origen de solicitud no permitido." }, { status: 403 });
  const auth = await actor(request);
  if ("response" in auth) return auth.response;
  try {
    const body = await request.json() as Record<string, unknown>;
    const admin = createAdminClient();
    if (body.operacion === "guardar") {
      const mes = Number(body.mes); const anio = Number(body.anio);
      const tercerizadaId = typeof body.tercerizadaId === "string" ? body.tercerizadaId : "";
      const conceptos = validarConceptos(body.conceptos);
      if (!periodoValido(mes, anio) || !tercerizadaId || !conceptos) return NextResponse.json({ error: "Revisá los datos de la liquidación." }, { status: 400 });
      const actual = await admin.from("liquidaciones").select("id,estado,creado_por").eq("tercerizada_id", tercerizadaId).eq("mes", mes).eq("anio", anio).maybeSingle();
      if (actual.error) throw actual.error;
      if (actual.data?.estado === "FINALIZADA" && !["JEFE", "SUPERVISOR"].includes(auth.actor.rolAutenticado)) {
        return NextResponse.json({ error: "La liquidación está finalizada. Solo Jefe o Supervisor pueden editarla." }, { status: 403 });
      }
      const estado = actual.data?.estado ?? "BORRADOR";
      const saved = await admin.from("liquidaciones").upsert({
        tercerizada_id: tercerizadaId, mes, anio, conceptos, estado,
        creado_por: actual.data?.creado_por ?? auth.actor.usuarioId,
        ...(estado === "FINALIZADA" ? {} : { finalizado_por: null, finalizado_at: null }), updated_at: new Date().toISOString(),
      }, { onConflict: "tercerizada_id,mes,anio" }).select("id,estado,finalizado_at,updated_at").single();
      if (saved.error) throw saved.error;
      return NextResponse.json({ liquidacion: saved.data });
    }
    if (body.operacion === "cambiar_estado") {
      const mes = Number(body.mes); const anio = Number(body.anio);
      const tercerizadaId = typeof body.tercerizadaId === "string" ? body.tercerizadaId : "";
      const estado = body.estado;
      if (!periodoValido(mes, anio) || !tercerizadaId || (estado !== "BORRADOR" && estado !== "FINALIZADA")) return NextResponse.json({ error: "Estado o período inválido." }, { status: 400 });
      const actual = await admin.from("liquidaciones").select("estado,conceptos,creado_por").eq("tercerizada_id", tercerizadaId).eq("mes", mes).eq("anio", anio).maybeSingle();
      if (actual.error) throw actual.error;
      if (actual.data?.estado === "FINALIZADA" && estado === "BORRADOR" && !["JEFE", "SUPERVISOR"].includes(auth.actor.rolAutenticado)) return NextResponse.json({ error: "Solo Jefe o Supervisor pueden reabrir una liquidación finalizada." }, { status: 403 });
      const changed = await admin.from("liquidaciones").upsert({
        tercerizada_id: tercerizadaId, mes, anio, conceptos: actual.data?.conceptos ?? [], estado,
        creado_por: actual.data?.creado_por ?? auth.actor.usuarioId, finalizado_por: estado === "FINALIZADA" ? auth.actor.usuarioId : null,
        finalizado_at: estado === "FINALIZADA" ? new Date().toISOString() : null, updated_at: new Date().toISOString(),
      }, { onConflict: "tercerizada_id,mes,anio" }).select("id,estado,updated_at").single();
      if (changed.error) throw changed.error;
      return NextResponse.json({ liquidacion: changed.data });
    }
    if (body.operacion === "crear_proxima") {
      const mes = Number(body.mes); const anio = Number(body.anio);
      const tercerizadaId = typeof body.tercerizadaId === "string" ? body.tercerizadaId : "";
      if (!periodoValido(mes, anio) || !tercerizadaId) return NextResponse.json({ error: "Seleccioná una tercerizada y un período válidos." }, { status: 400 });
      const source = await admin.from("liquidaciones").select("conceptos").eq("tercerizada_id", tercerizadaId).eq("mes", mes).eq("anio", anio).maybeSingle();
      if (source.error) throw source.error;
      const siguiente = new Date(anio, mes, 1);
      const nextMes = siguiente.getMonth() + 1; const nextAnio = siguiente.getFullYear();
      const sourceConcepts = source.data?.conceptos as Concepto[] | undefined ?? [];
      const ids = new Map<string, string>();
      for (const concepto of sourceConcepts) ids.set(concepto.id, crypto.randomUUID());
      const clonedConcepts = sourceConcepts.map((concepto) => ({
        ...concepto, id: ids.get(concepto.id) ?? crypto.randomUUID(), cantidad: 0, nota: "", enlace: "",
        ...(concepto.formula ? { formula: { ...concepto.formula, conceptoId: ids.get(concepto.formula.conceptoId) ?? concepto.formula.conceptoId } } : {}),
      }));
      const created = await admin.from("liquidaciones").insert({
        tercerizada_id: tercerizadaId, mes: nextMes, anio: nextAnio,
        conceptos: clonedConcepts,
        estado: "BORRADOR", creado_por: auth.actor.usuarioId,
      }).select("id,tercerizada_id,mes,anio,estado,conceptos,updated_at").single();
      if (created.error?.code === "23505") return NextResponse.json({ error: "Ya existe una liquidación para esa tercerizada y el próximo período." }, { status: 409 });
      if (created.error) throw created.error;
      return NextResponse.json({ liquidacion: created.data });
    }
    if (body.operacion === "finalizar_periodo") {
      const mes = Number(body.mes); const anio = Number(body.anio);
      if (!periodoValido(mes, anio)) return NextResponse.json({ error: "Seleccioná un período válido." }, { status: 400 });
      const companies = await admin.from("tercerizadas").select("id,activo");
      if (companies.error) throw companies.error;
      const existing = await admin.from("liquidaciones").select("tercerizada_id,conceptos,creado_por").eq("mes", mes).eq("anio", anio);
      if (existing.error) throw existing.error;
      const porEmpresa = new Map<string, { conceptos: unknown[]; creadoPor: string }>();
      for (const row of existing.data ?? []) porEmpresa.set(row.tercerizada_id, { conceptos: row.conceptos, creadoPor: row.creado_por });
      const fecha = new Date().toISOString();
      const periodCompanies = (companies.data ?? []).filter((company) => company.activo || porEmpresa.has(company.id));
      const rows = periodCompanies.map((company) => ({
        tercerizada_id: company.id, mes, anio, estado: "FINALIZADA" as const,
        conceptos: porEmpresa.get(company.id)?.conceptos ?? [], creado_por: porEmpresa.get(company.id)?.creadoPor ?? auth.actor.usuarioId,
        finalizado_por: auth.actor.usuarioId, finalizado_at: fecha, updated_at: fecha,
      }));
      if (rows.length) {
        const finalized = await admin.from("liquidaciones").upsert(rows, { onConflict: "tercerizada_id,mes,anio" });
        if (finalized.error) throw finalized.error;
      }
      const proximo = new Date(Date.UTC(anio, mes, 1));
      const nextMes = proximo.getUTCMonth() + 1; const nextAnio = proximo.getUTCFullYear();
      const nextExisting = await admin.from("liquidaciones").select("tercerizada_id").eq("mes", nextMes).eq("anio", nextAnio);
      if (nextExisting.error) throw nextExisting.error;
      const nextIds = new Set((nextExisting.data ?? []).map((row) => row.tercerizada_id));
      const activeIds = new Set((companies.data ?? []).filter((company) => company.activo).map((company) => company.id));
      const nextDrafts = rows.filter((row) => activeIds.has(row.tercerizada_id) && !nextIds.has(row.tercerizada_id)).map((row) => {
        const sourceConcepts = row.conceptos as Concepto[];
        const ids = new Map<string, string>();
        for (const concepto of sourceConcepts) ids.set(concepto.id, crypto.randomUUID());
        return {
          tercerizada_id: row.tercerizada_id, mes: nextMes, anio: nextAnio, estado: "BORRADOR" as const,
          creado_por: auth.actor.usuarioId, conceptos: sourceConcepts.map((concepto) => ({
            ...concepto, id: ids.get(concepto.id) ?? crypto.randomUUID(), cantidad: 0, nota: "", enlace: "",
            ...(concepto.formula ? { formula: { ...concepto.formula, conceptoId: ids.get(concepto.formula.conceptoId) ?? concepto.formula.conceptoId } } : {}),
          })),
        };
      });
      if (nextDrafts.length) {
        const seeded = await admin.from("liquidaciones").upsert(nextDrafts, { onConflict: "tercerizada_id,mes,anio", ignoreDuplicates: true });
        if (seeded.error) throw seeded.error;
      }
      return NextResponse.json({ finalizadas: rows.length, proximoMes: nextMes, proximoAnio: nextAnio, copiasCreadas: nextDrafts.length });
    }
    return NextResponse.json({ error: "Operación desconocida." }, { status: 400 });
  } catch (error) { return jsonError(error); }
}
