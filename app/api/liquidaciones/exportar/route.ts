import { NextRequest, NextResponse } from "next/server";
import { createClient as createSessionClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const meses = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

async function obtenerUsuario() {
  const session = await createSessionClient();
  const { data: { user }, error } = await session.auth.getUser();
  if (error || !user) return { response: NextResponse.json({ error: "Iniciá sesión para continuar." }, { status: 401 }) };
  const { data: rol, error: roleError } = await session.rpc("mi_rol");
  if (roleError || !rol) return { response: NextResponse.json({ error: "No se pudo validar tu rol." }, { status: 403 }) };
  if (rol !== "JEFE" && rol !== "SUPERVISOR") return { response: NextResponse.json({ error: "El módulo Liqui está disponible solo para Jefe y Supervisor." }, { status: 403 }) };
  return { user, rol };
}

export async function POST(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (origin && new URL(origin).origin !== request.nextUrl.origin) return NextResponse.json({ error: "Origen de solicitud no permitido." }, { status: 403 });
  const auth = await obtenerUsuario();
  if ("response" in auth) return auth.response;
  const form = await request.formData();
  const file = form.get("archivo");
  const mes = Number(form.get("mes"));
  const anio = Number(form.get("anio"));
  if (!(file instanceof File) || file.type !== "application/zip" || !Number.isInteger(mes) || mes < 1 || mes > 12 || !Number.isInteger(anio) || anio < 2000 || anio > 2200) {
    return NextResponse.json({ error: "Archivo ZIP o período inválido." }, { status: 400 });
  }
  try {
    const nombreArchivo = `liquidaciones_${meses[mes - 1]}_${anio}.zip`;
    const ruta = `exportaciones/${anio}/${String(mes).padStart(2, "0")}/${nombreArchivo}`;
    const admin = createAdminClient();
    const { error: uploadError } = await admin.storage.from("liquidaciones").upload(ruta, file, { contentType: "application/zip", upsert: true });
    if (uploadError) throw uploadError;
    const { error: metadataError } = await admin.from("liquidaciones_exportaciones").upsert({
      mes, anio, nombre_archivo: nombreArchivo, storage_path: ruta, creado_por: auth.user.id,
    }, { onConflict: "mes,anio" });
    if (metadataError) throw metadataError;
    return NextResponse.json({ nombreArchivo });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "No se pudo guardar el ZIP." }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  const auth = await obtenerUsuario();
  if ("response" in auth) return auth.response;
  const mes = Number(request.nextUrl.searchParams.get("mes"));
  const anio = Number(request.nextUrl.searchParams.get("anio"));
  if (!Number.isInteger(mes) || mes < 1 || mes > 12 || !Number.isInteger(anio) || anio < 2000 || anio > 2200) return NextResponse.json({ error: "Período inválido." }, { status: 400 });
  try {
    const admin = createAdminClient();
    const metadata = await admin.from("liquidaciones_exportaciones").select("nombre_archivo,storage_path").eq("mes", mes).eq("anio", anio).maybeSingle();
    if (metadata.error) throw metadata.error;
    if (!metadata.data) return NextResponse.json({ error: "Todavía no hay un ZIP archivado para este período." }, { status: 404 });
    const archivo = await admin.storage.from("liquidaciones").download(metadata.data.storage_path);
    if (archivo.error) throw archivo.error;
    return new NextResponse(archivo.data, { headers: { "Content-Type": "application/zip", "Content-Disposition": `attachment; filename="${metadata.data.nombre_archivo}"`, "Cache-Control": "private, no-store" } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "No se pudo descargar el ZIP archivado." }, { status: 500 });
  }
}
