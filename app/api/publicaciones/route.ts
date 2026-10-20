import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const ROLES = ["COORDINADOR", "SUPERVISOR", "JEFE", "SOPORTE"];
const SECTORES = ["Coordinación", "Soporte", "Supervisión", "Jefatura"];
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

async function actor(request?: NextRequest) {
  const session = await createClient();
  const { data: { user }, error: userError } = await session.auth.getUser();
  if (userError || !user) return { response: NextResponse.json({ error: "Iniciá sesión para continuar." }, { status: 401 }) };
  const { data: rolReal, error } = await session.rpc("mi_rol");
  if (error) return { response: NextResponse.json({ error: "No se pudo validar tu rol." }, { status: 503 }) };
  if (!rolReal || !ROLES.includes(rolReal)) return { response: NextResponse.json({ error: "No tenés permiso para acceder." }, { status: 403 }) };
  const contextoId = request?.headers.get("x-user-context");
  if (!contextoId) return { userId: user.id, rol: rolReal };
  if (rolReal !== "JEFE") return { response: NextResponse.json({ error: "Solo Jefatura puede operar en el contexto de otro usuario." }, { status: 403 }) };
  try {
    const admin = createAdminClient();
    const { data: perfil, error: profileError } = await admin.from("usuarios").select("id,rol_id,activo").eq("id", contextoId).maybeSingle();
    if (profileError) throw profileError;
    if (!perfil?.activo) return { response: NextResponse.json({ error: "El usuario seleccionado no existe o está inactivo." }, { status: 404 }) };
    const { data: role, error: roleError } = await admin.from("roles").select("codigo").eq("id", perfil.rol_id).single();
    if (roleError) throw roleError;
    if (!ROLES.includes(role.codigo)) return { response: NextResponse.json({ error: "El rol del usuario seleccionado no es válido." }, { status: 403 }) };
    return { userId: perfil.id, rol: role.codigo };
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : "No se pudo validar el usuario seleccionado.";
    return { response: NextResponse.json({ error: message }, { status: message.includes("SUPABASE_SECRET_KEY") ? 503 : 500 }) };
  }
}

function jsonError(error: unknown) {
  const message = error instanceof Error ? error.message : "Ocurrió un error con la publicación.";
  const status = message.includes("SUPABASE_SECRET_KEY") ? 503 : message.startsWith("La imagen") ? 400 : 500;
  return NextResponse.json({ error: message }, { status });
}

function permitted(request: NextRequest) {
  const origin = request.headers.get("origin");
  return !origin || new URL(origin).origin === request.nextUrl.origin;
}

async function saveImage(admin: ReturnType<typeof createAdminClient>, file: FormDataEntryValue | null) {
  if (!(file instanceof File) || file.size === 0) return null;
  if (file.size > MAX_IMAGE_BYTES) throw new Error("La imagen debe pesar hasta 5 MB.");
  const mime = file.type.toLowerCase();
  const ext = mime === "image/jpeg" ? "jpg" : mime === "image/png" ? "png" : mime === "image/webp" ? "webp" : "";
  if (!ext) throw new Error("La imagen debe ser JPG, PNG o WEBP.");
  const path = `${crypto.randomUUID()}.${ext}`;
  const { error } = await admin.storage.from("publicaciones-equipo").upload(path, await file.arrayBuffer(), { contentType: mime, upsert: false });
  if (error) throw error;
  return admin.storage.from("publicaciones-equipo").getPublicUrl(path).data.publicUrl;
}

function imagePath(url: string | null) {
  if (!url) return null;
  const marker = "/storage/v1/object/public/publicaciones-equipo/";
  const index = url.indexOf(marker);
  return index < 0 ? null : decodeURIComponent(url.slice(index + marker.length));
}

export async function GET(request: NextRequest) {
  const auth = await actor(request);
  if ("response" in auth) return auth.response;
  try {
    const admin = createAdminClient();
    const { data: rows, error } = await admin.from("notas_equipo").select("id,titulo,area_interesada,comentario,imagen_url,creado_por,created_at").order("created_at", { ascending: false });
    if (error) throw error;
    const ids = [...new Set((rows ?? []).map((row) => row.creado_por))];
    const { data: authors, error: authorError } = ids.length ? await admin.from("usuarios").select("id,nombre_completo").in("id", ids) : { data: [], error: null };
    if (authorError) throw authorError;
    const names = new Map((authors ?? []).map((item) => [item.id, item.nombre_completo]));
    return NextResponse.json({ publicaciones: (rows ?? []).map((row) => ({ ...row, autor: names.get(row.creado_por) ?? "Usuario" })), usuarioId: auth.userId, rol: auth.rol });
  } catch (error) { return jsonError(error); }
}

export async function POST(request: NextRequest) {
  if (!permitted(request)) return NextResponse.json({ error: "Origen de solicitud no permitido." }, { status: 403 });
  const auth = await actor(request);
  if ("response" in auth) return auth.response;
  try {
    const form = await request.formData();
    const titulo = String(form.get("titulo") ?? "").trim();
    const area = String(form.get("area") ?? "").trim();
    const contenido = String(form.get("contenido") ?? "").trim();
    if (!titulo || titulo.length > 120) return NextResponse.json({ error: "Ingresá un título de hasta 120 caracteres." }, { status: 400 });
    if (!SECTORES.includes(area)) return NextResponse.json({ error: "Seleccioná un sector válido." }, { status: 400 });
    if (!contenido || contenido.length > 12000) return NextResponse.json({ error: "El contenido es obligatorio y admite hasta 12.000 caracteres." }, { status: 400 });
    const admin = createAdminClient();
    const imagenUrl = await saveImage(admin, form.get("imagen"));
    const { data, error } = await admin.from("notas_equipo").insert({ titulo, area_interesada: area, comentario: contenido, imagen_url: imagenUrl, creado_por: auth.userId }).select("id").single();
    if (error) throw error;
    return NextResponse.json({ id: data.id }, { status: 201 });
  } catch (error) { return jsonError(error); }
}

export async function PATCH(request: NextRequest) {
  if (!permitted(request)) return NextResponse.json({ error: "Origen de solicitud no permitido." }, { status: 403 });
  const auth = await actor(request);
  if ("response" in auth) return auth.response;
  try {
    const form = await request.formData();
    const id = String(form.get("id") ?? "");
    const titulo = String(form.get("titulo") ?? "").trim();
    const area = String(form.get("area") ?? "").trim();
    const contenido = String(form.get("contenido") ?? "").trim();
    if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: "La publicación no es válida." }, { status: 400 });
    if (!titulo || titulo.length > 120 || !SECTORES.includes(area) || !contenido || contenido.length > 12000) return NextResponse.json({ error: "Completá título, sector y contenido dentro de los límites indicados." }, { status: 400 });
    const admin = createAdminClient();
    const { data: current, error: readError } = await admin.from("notas_equipo").select("id,creado_por,imagen_url").eq("id", id).maybeSingle();
    if (readError) throw readError;
    if (!current) return NextResponse.json({ error: "No se encontró la publicación." }, { status: 404 });
    if (current.creado_por !== auth.userId && !["SUPERVISOR", "JEFE"].includes(auth.rol)) return NextResponse.json({ error: "Solo podés editar tus propias publicaciones." }, { status: 403 });
    let imagenUrl = current.imagen_url;
    if (form.get("quitarImagen") === "true") imagenUrl = null;
    const uploaded = await saveImage(admin, form.get("imagen"));
    if (uploaded) imagenUrl = uploaded;
    const { error } = await admin.from("notas_equipo").update({ titulo, area_interesada: area, comentario: contenido, imagen_url: imagenUrl }).eq("id", id);
    if (error) throw error;
    if (current.imagen_url && current.imagen_url !== imagenUrl) {
      const path = imagePath(current.imagen_url);
      if (path) await admin.storage.from("publicaciones-equipo").remove([path]);
    }
    return NextResponse.json({ ok: true });
  } catch (error) { return jsonError(error); }
}

export async function DELETE(request: NextRequest) {
  if (!permitted(request)) return NextResponse.json({ error: "Origen de solicitud no permitido." }, { status: 403 });
  const auth = await actor(request);
  if ("response" in auth) return auth.response;
  try {
    const { id } = await request.json() as { id?: string };
    if (!id || !/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: "La publicación no es válida." }, { status: 400 });
    const admin = createAdminClient();
    const { data: current, error: readError } = await admin.from("notas_equipo").select("id,creado_por,imagen_url").eq("id", id).maybeSingle();
    if (readError) throw readError;
    if (!current) return NextResponse.json({ error: "No se encontró la publicación." }, { status: 404 });
    if (current.creado_por !== auth.userId && !["SUPERVISOR", "JEFE"].includes(auth.rol)) return NextResponse.json({ error: "Solo podés eliminar tus propias publicaciones." }, { status: 403 });
    const { error } = await admin.from("notas_equipo").delete().eq("id", id);
    if (error) throw error;
    const path = imagePath(current.imagen_url);
    if (path) await admin.storage.from("publicaciones-equipo").remove([path]);
    return NextResponse.json({ ok: true });
  } catch (error) { return jsonError(error); }
}
