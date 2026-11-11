import { NextRequest, NextResponse } from "next/server";
import { createClient as createSessionClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requestOriginIsAllowed } from "@/lib/security/request-origin";

type Rol = "COORDINADOR" | "SUPERVISOR" | "JEFE";
type FormulaVinculo = { conceptoId: string; modo: "FIJO" | "PORCENTAJE"; valor: number } | { conceptoId: string; adicional: number };
type Concepto = {
  id: string; nombre: string; tipo: "SUMA" | "RESTA"; cantidad: number;
  precio: number; nota: string; enlace: string; formula?: FormulaVinculo;
};
type DescuentoEquipo = { id: string; modeloId: string; modelo: string; cantidad: number; precioUnitario: number };

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
  if (code === "42703" && message.includes("descuentos_equipos")) {
    return NextResponse.json({ error: "Falta aplicar en Supabase la migración 202611100002_liquidaciones_descuentos_equipos.sql." }, { status: 503 });
  }
  if (code === "42P01" || message.includes("public.liquidaciones") || message.includes("public.liquidaciones_exportaciones")) {
    return NextResponse.json({ error: "Falta aplicar en Supabase la migración 202610150005_liquidaciones.sql." }, { status: 503 });
  }
  const status = message.includes("Falta SUPABASE_SECRET_KEY") ? 503 : 500;
  return NextResponse.json({ error: message }, { status });
}

function validarDescuentosEquipos(value: unknown): { descuentos: DescuentoEquipo[] | null; error?: string } {
  if (value === undefined) return { descuentos: [] };
  if (!Array.isArray(value) || value.length > 100) return { descuentos: null, error: "La lista de descuentos de equipos no es válida." };
  const descuentos: DescuentoEquipo[] = [];
  for (const [index, item] of value.entries()) {
    if (!item || typeof item !== "object" || Array.isArray(item)) return { descuentos: null, error: `El descuento de equipo ${index + 1} no es válido.` };
    const row = item as Record<string, unknown>;
    const cantidad = Number(row.cantidad);
    const precioUnitario = Number(row.precioUnitario);
    if (typeof row.id !== "string" || !row.id || typeof row.modeloId !== "string" || !row.modeloId || typeof row.modelo !== "string" || !row.modelo.trim() || row.modelo.length > 120 || !Number.isInteger(cantidad) || cantidad < 1 || !Number.isFinite(precioUnitario) || precioUnitario < 0) {
      return { descuentos: null, error: `Revisá el modelo, la cantidad y el precio del descuento ${index + 1}.` };
    }
    descuentos.push({ id: row.id, modeloId: row.modeloId, modelo: row.modelo.trim(), cantidad, precioUnitario });
  }
  return { descuentos };
}

function validarConceptos(value: unknown): { conceptos: Concepto[] | null; error?: string } {
  if (!Array.isArray(value)) return { conceptos: null, error: "La lista de conceptos tiene un formato invalido." };
  if (value.length > 300) return { conceptos: null, error: "La liquidacion supera el maximo de 300 conceptos." };
  const result: Concepto[] = [];
  for (const [index, item] of value.entries()) {
    const numeroConcepto = index + 1;
    if (!item || typeof item !== "object" || Array.isArray(item)) return { conceptos: null, error: `El concepto ${numeroConcepto} tiene un formato invalido.` };
    const row = item as Record<string, unknown>;
    if (typeof row.id !== "string" || !row.id || typeof row.nombre !== "string" || row.nombre.length > 120) return { conceptos: null, error: `Revisa el identificador y el nombre del concepto ${numeroConcepto}.` };
    if (row.tipo !== "SUMA" && row.tipo !== "RESTA") return { conceptos: null, error: `Elegi si el concepto ${numeroConcepto} suma o resta.` };
    const cantidad = Number(row.cantidad);
    const precio = Number(row.precio);
    if (!Number.isFinite(cantidad) || cantidad < 0 || !Number.isFinite(precio) || precio < 0) return { conceptos: null, error: `La cantidad o el precio del concepto ${numeroConcepto} no es valido.` };
    const formulaRaw = row.formula;
    let formula: Concepto["formula"];
    // Older saved rows can contain JSON null for an absent formula.
    if (formulaRaw !== undefined && formulaRaw !== null) {
      if (typeof formulaRaw !== "object" || Array.isArray(formulaRaw)) return { conceptos: null, error: `La formula del concepto ${numeroConcepto} tiene un formato invalido.` };
      const parsed = formulaRaw as Record<string, unknown>;
      if (typeof parsed.conceptoId !== "string") return { conceptos: null, error: `La formula del concepto ${numeroConcepto} no tiene un concepto base valido.` };
      if (parsed.modo === "FIJO" || parsed.modo === "PORCENTAJE") {
        const valor = Number(parsed.valor);
        if (!Number.isFinite(valor) || (parsed.modo === "FIJO" && valor < 0) || (parsed.modo === "PORCENTAJE" && valor < -100)) return { conceptos: null, error: `El adicional de la formula del concepto ${numeroConcepto} no es valido.` };
        formula = { conceptoId: parsed.conceptoId, modo: parsed.modo, valor };
      } else {
        const adicional = Number(parsed.adicional);
        if (!Number.isFinite(adicional) || adicional < 0) return { conceptos: null, error: `El adicional de la formula del concepto ${numeroConcepto} no es valido.` };
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
  const formulaInvalida = result.find((item) => item.formula && (!ids.has(item.formula.conceptoId) || item.formula.conceptoId === item.id));
  if (formulaInvalida) return { conceptos: null, error: `La formula de "${formulaInvalida.nombre || "un concepto"}" apunta a un concepto base inexistente o a si misma.` };
  return { conceptos: result };
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
      admin.from("liquidaciones").select("id,tercerizada_id,mes,anio,estado,conceptos,informacion_adicional,descuentos_equipos,finalizado_por,finalizado_at,updated_at").eq("mes", mes).eq("anio", anio),
      admin.from("liquidaciones_exportaciones").select("nombre_archivo,created_at").eq("mes", mes).eq("anio", anio).maybeSingle(),
    ]);
      if (tercerizadas.error) throw tercerizadas.error;
    if (liquidaciones.error) throw liquidaciones.error;
    if (exportacion.error) throw exportacion.error;
    return NextResponse.json({ rol: auth.actor.rol, tercerizadas: tercerizadas.data ?? [], liquidaciones: liquidaciones.data ?? [], exportacion: exportacion.data });
  } catch (error) { return jsonError(error); }
}

export async function POST(request: NextRequest) {
  if (!requestOriginIsAllowed(request)) return NextResponse.json({ error: "Origen de solicitud no permitido." }, { status: 403 });
  const auth = await actor(request);
  if ("response" in auth) return auth.response;
  try {
    const body = await request.json() as Record<string, unknown>;
    const admin = createAdminClient();
    if (body.operacion === "guardar") {
      const mes = Number(body.mes); const anio = Number(body.anio);
      const tercerizadaId = typeof body.tercerizadaId === "string" ? body.tercerizadaId : "";
      const validacionConceptos = validarConceptos(body.conceptos);
      const conceptos = validacionConceptos.conceptos;
      if (!conceptos) return NextResponse.json({ error: validacionConceptos.error ?? "Revisá los datos de los conceptos." }, { status: 400 });
      const validacionDescuentos = validarDescuentosEquipos(body.descuentosEquipos);
      const descuentosEquipos = validacionDescuentos.descuentos;
      if (!descuentosEquipos) return NextResponse.json({ error: validacionDescuentos.error ?? "Revisá los descuentos de equipos." }, { status: 400 });
      const informacionAdicional = typeof body.informacionAdicional === "string" ? body.informacionAdicional.trim().slice(0, 20000) : "";
      if (!periodoValido(mes, anio) || !tercerizadaId || !conceptos || (body.informacionAdicional !== undefined && typeof body.informacionAdicional !== "string")) return NextResponse.json({ error: "Revisá los datos de la liquidación." }, { status: 400 });
      const actual = await admin.from("liquidaciones").select("id,estado,creado_por").eq("tercerizada_id", tercerizadaId).eq("mes", mes).eq("anio", anio).maybeSingle();
      if (actual.error) throw actual.error;
      if (actual.data?.estado === "FINALIZADA" && !["JEFE", "SUPERVISOR"].includes(auth.actor.rolAutenticado)) {
        return NextResponse.json({ error: "La liquidación está finalizada. Solo Jefe o Supervisor pueden editarla." }, { status: 403 });
      }
      const estado = actual.data?.estado ?? "BORRADOR";
      const saved = await admin.from("liquidaciones").upsert({
        tercerizada_id: tercerizadaId, mes, anio, conceptos, informacion_adicional: informacionAdicional, descuentos_equipos: descuentosEquipos, estado,
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
      const actual = await admin.from("liquidaciones").select("estado,conceptos,informacion_adicional,descuentos_equipos,creado_por").eq("tercerizada_id", tercerizadaId).eq("mes", mes).eq("anio", anio).maybeSingle();
      if (actual.error) throw actual.error;
      if (actual.data?.estado === "FINALIZADA" && estado === "BORRADOR" && !["JEFE", "SUPERVISOR"].includes(auth.actor.rolAutenticado)) return NextResponse.json({ error: "Solo Jefe o Supervisor pueden reabrir una liquidación finalizada." }, { status: 403 });
      const changed = await admin.from("liquidaciones").upsert({
        tercerizada_id: tercerizadaId, mes, anio, conceptos: actual.data?.conceptos ?? [], informacion_adicional: actual.data?.informacion_adicional ?? "", descuentos_equipos: actual.data?.descuentos_equipos ?? [], estado,
        creado_por: actual.data?.creado_por ?? auth.actor.usuarioId, finalizado_por: estado === "FINALIZADA" ? auth.actor.usuarioId : null,
        finalizado_at: estado === "FINALIZADA" ? new Date().toISOString() : null, updated_at: new Date().toISOString(),
      }, { onConflict: "tercerizada_id,mes,anio" }).select("id,estado,updated_at").single();
      if (changed.error) throw changed.error;
      return NextResponse.json({ liquidacion: changed.data });
    }
    return NextResponse.json({ error: "Operación desconocida." }, { status: 400 });
  } catch (error) { return jsonError(error); }
}
