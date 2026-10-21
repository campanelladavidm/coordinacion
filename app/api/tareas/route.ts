import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { esSupervisor, esUuid, origenTareasPermitido, obtenerTareasActor, responderErrorTareas } from "@/lib/tareas-api";

const ESTADOS = ["PENDIENTE", "EN_CURSO", "FINALIZADA", "MATERIALES"] as const;
const PRIORIDADES = ["BAJA", "MEDIA", "ALTA"] as const;
type EstadoTarea = typeof ESTADOS[number];
type PrioridadTarea = typeof PRIORIDADES[number];

function fechaValida(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export async function GET(request: NextRequest) {
  const auth = await obtenerTareasActor(request);
  if ("response" in auth) return auth.response;
  try {
    const admin = createAdminClient();
    const { data: rows, error } = await admin.from("tareas").select("id,titulo,descripcion,estado,prioridad,creado_por,fecha_limite,resuelta_at,created_at,updated_at").order("updated_at", { ascending: false }).limit(300);
    if (error) throw error;
    const ids = (rows ?? []).map((row) => row.id);
    const [checklistResult, commentsResult, usersResult, assignmentsResult, filesResult] = await Promise.all([
      ids.length ? admin.from("tareas_checklist").select("id,tarea_id,texto,completado,creado_por,created_at").in("tarea_id", ids).order("created_at") : Promise.resolve({ data: [], error: null }),
      ids.length ? admin.from("tareas_comentarios").select("id,tarea_id,autor_id,texto,created_at").in("tarea_id", ids).order("created_at").limit(1500) : Promise.resolve({ data: [], error: null }),
      admin.from("usuarios").select("id,nombre_completo").eq("activo", true).order("nombre_completo"),
      ids.length ? admin.from("tareas_asignados").select("tarea_id,usuario_id").in("tarea_id", ids) : Promise.resolve({ data: [], error: null }),
      ids.length ? admin.from("tareas_archivos").select("id,tarea_id,storage_path,nombre_archivo,mime_type,tamano_bytes,subido_por,created_at").in("tarea_id", ids).order("created_at", { ascending: false }) : Promise.resolve({ data: [], error: null }),
    ]);
    if (checklistResult.error) throw checklistResult.error;
    if (commentsResult.error) throw commentsResult.error;
    if (usersResult.error) throw usersResult.error;
    if (assignmentsResult.error) throw assignmentsResult.error;
    if (filesResult.error) throw filesResult.error;
    const users = usersResult.data ?? [];
    const names = new Map(users.map((user) => [user.id, user.nombre_completo || "Usuario"]));
    const assigneesByTask = new Map<string, string[]>();
    for (const assignment of assignmentsResult.data ?? []) assigneesByTask.set(assignment.tarea_id, [...(assigneesByTask.get(assignment.tarea_id) ?? []), assignment.usuario_id]);
    const checklistByTask = new Map<string, { id: string; texto: string; completado: boolean }[]>();
    for (const item of checklistResult.data ?? []) checklistByTask.set(item.tarea_id, [...(checklistByTask.get(item.tarea_id) ?? []), { id: item.id, texto: item.texto, completado: item.completado }]);
    const commentsByTask = new Map<string, { id: string; autorId: string; autor: string; texto: string; createdAt: string }[]>();
    for (const item of commentsResult.data ?? []) commentsByTask.set(item.tarea_id, [...(commentsByTask.get(item.tarea_id) ?? []), { id: item.id, autorId: item.autor_id, autor: names.get(item.autor_id) ?? "Usuario", texto: item.texto, createdAt: item.created_at }]);
    const filesByTask = new Map<string, { id: string; nombre: string; mimeType: string; tamanoBytes: number; subidoPor: string; subidoPorNombre: string; createdAt: string; url: string }[]>();
    const signedFiles = await Promise.all((filesResult.data ?? []).map(async (item) => {
      const { data, error: signedError } = await admin.storage.from("tareas-archivos").createSignedUrl(item.storage_path, 60 * 60);
      if (signedError) throw signedError;
      return { item, url: data.signedUrl };
    }));
    for (const { item, url } of signedFiles) filesByTask.set(item.tarea_id, [...(filesByTask.get(item.tarea_id) ?? []), {
      id: item.id, nombre: item.nombre_archivo, mimeType: item.mime_type, tamanoBytes: Number(item.tamano_bytes),
      subidoPor: item.subido_por, subidoPorNombre: names.get(item.subido_por) ?? "Usuario", createdAt: item.created_at, url,
    }]);
    const nameById = (id: string | null) => id ? names.get(id) ?? "Usuario" : null;
    return NextResponse.json({
      usuarioId: auth.actor.id,
      rol: auth.actor.rol,
      usuarios: users.map((user) => ({ id: user.id, nombre: user.nombre_completo || "Usuario" })),
      tareas: (rows ?? []).map((row) => ({
        id: row.id, titulo: row.titulo, descripcion: row.descripcion, estado: row.estado, prioridad: row.prioridad,
        asignadosA: assigneesByTask.get(row.id) ?? [], asignadosNombres: (assigneesByTask.get(row.id) ?? []).map((id) => nameById(id) ?? "Usuario"), creadoPor: row.creado_por,
        creadorNombre: nameById(row.creado_por), fechaLimite: row.fecha_limite, resueltaAt: row.resuelta_at,
        createdAt: row.created_at, updatedAt: row.updated_at, checklist: checklistByTask.get(row.id) ?? [],
        comentarios: commentsByTask.get(row.id) ?? [], archivos: filesByTask.get(row.id) ?? [],
      })),
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return responderErrorTareas(error); }
}

export async function POST(request: NextRequest) {
  if (!origenTareasPermitido(request)) return NextResponse.json({ error: "Origen de solicitud no permitido." }, { status: 403 });
  const auth = await obtenerTareasActor(request);
  if ("response" in auth) return auth.response;
  try {
    const admin = createAdminClient();
    if (request.headers.get("content-type")?.includes("multipart/form-data")) {
      const form = await request.formData();
      const tareaId = form.get("tareaId");
      const archivo = form.get("archivo");
      const allowed = new Set(["image/jpeg", "image/png", "image/webp", "image/gif", "application/pdf", "text/plain", "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "application/vnd.ms-excel", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "application/vnd.ms-powerpoint", "application/vnd.openxmlformats-officedocument.presentationml.presentation"]);
      if (!esUuid(tareaId) || !(archivo instanceof File) || archivo.size < 1 || archivo.size > 10 * 1024 * 1024 || !allowed.has(archivo.type)) return NextResponse.json({ error: "Elegí una foto o documento permitido de hasta 10 MB." }, { status: 400 });
      const { data: task, error: taskError } = await admin.from("tareas").select("id").eq("id", tareaId).maybeSingle();
      if (taskError) throw taskError;
      if (!task) return NextResponse.json({ error: "No se encontró la tarea." }, { status: 404 });
      const nombre = archivo.name.trim().replace(/[^\p{L}\p{N}._ -]/gu, "_").slice(0, 240) || "archivo";
      const storagePath = `${tareaId}/${crypto.randomUUID()}-${nombre}`;
      const { error: uploadError } = await admin.storage.from("tareas-archivos").upload(storagePath, await archivo.arrayBuffer(), { contentType: archivo.type, upsert: false });
      if (uploadError) throw uploadError;
      const { data, error } = await admin.from("tareas_archivos").insert({ tarea_id: tareaId, storage_path: storagePath, nombre_archivo: nombre, mime_type: archivo.type, tamano_bytes: archivo.size, subido_por: auth.actor.id }).select("id").single();
      if (error) { await admin.storage.from("tareas-archivos").remove([storagePath]); throw error; }
      return NextResponse.json({ id: data.id }, { status: 201 });
    }
    const body = await request.json() as Record<string, unknown>;
    if (body.tipo === "comentario") {
      const tareaId = body.tareaId;
      const texto = typeof body.texto === "string" ? body.texto.trim() : "";
      if (!esUuid(tareaId) || !texto || texto.length > 2000) return NextResponse.json({ error: "Escribí un comentario de hasta 2.000 caracteres." }, { status: 400 });
      const { data, error } = await admin.from("tareas_comentarios").insert({ tarea_id: tareaId, autor_id: auth.actor.id, texto }).select("id").single();
      if (error) throw error;
      return NextResponse.json({ id: data.id }, { status: 201 });
    }
    if (body.tipo === "checklist") {
      const tareaId = body.tareaId;
      const texto = typeof body.texto === "string" ? body.texto.trim() : "";
      if (!esUuid(tareaId) || !texto || texto.length > 240) return NextResponse.json({ error: "El ítem debe tener hasta 240 caracteres." }, { status: 400 });
      const { data, error } = await admin.from("tareas_checklist").insert({ tarea_id: tareaId, creado_por: auth.actor.id, texto }).select("id").single();
      if (error) throw error;
      return NextResponse.json({ id: data.id }, { status: 201 });
    }

    const titulo = typeof body.titulo === "string" ? body.titulo.trim() : "";
    const descripcion = typeof body.descripcion === "string" ? body.descripcion.trim() : "";
    const estado = typeof body.estado === "string" ? body.estado : "PENDIENTE";
    const prioridad = typeof body.prioridad === "string" ? body.prioridad : "MEDIA";
    const asignadosA = Array.isArray(body.asignadosA) ? [...new Set(body.asignadosA)] : [];
    const fechaLimite = body.fechaLimite === "" || body.fechaLimite === null ? null : body.fechaLimite;
    const checklist = Array.isArray(body.checklist) ? body.checklist.map((item) => typeof item === "string" ? item.trim() : "").filter(Boolean) : [];
    if (!titulo || titulo.length > 140 || descripcion.length > 4000) return NextResponse.json({ error: "El título es obligatorio (máximo 140 caracteres) y la descripción admite hasta 4.000." }, { status: 400 });
    if (!(ESTADOS as readonly string[]).includes(estado) || !(PRIORIDADES as readonly string[]).includes(prioridad)) return NextResponse.json({ error: "El estado o la prioridad no son válidos." }, { status: 400 });
    if (asignadosA.some((id) => !esUuid(id)) || asignadosA.length > 20) return NextResponse.json({ error: "Seleccioná hasta 20 usuarios válidos." }, { status: 400 });
    if (fechaLimite !== null && !fechaValida(fechaLimite)) return NextResponse.json({ error: "La fecha límite no es válida." }, { status: 400 });
    if (checklist.length > 30 || checklist.some((item) => item.length > 240)) return NextResponse.json({ error: "La lista admite hasta 30 ítems de 240 caracteres." }, { status: 400 });
    if (asignadosA.length) {
      const { data: users, error } = await admin.from("usuarios").select("id").eq("activo", true).in("id", asignadosA as string[]);
      if (error) throw error;
      if ((users?.length ?? 0) !== asignadosA.length) return NextResponse.json({ error: "La lista incluye usuarios inactivos o inválidos." }, { status: 400 });
    }
    const { data: row, error } = await admin.from("tareas").insert({
      titulo, descripcion, estado: estado as EstadoTarea, prioridad: prioridad as PrioridadTarea,
      creado_por: auth.actor.id, fecha_limite: fechaLimite,
      resuelta_at: estado === "FINALIZADA" ? new Date().toISOString() : null,
    }).select("id").single();
    if (error) throw error;
    if (asignadosA.length) {
      const { error: assignmentError } = await admin.from("tareas_asignados").insert(asignadosA.map((usuario_id) => ({ tarea_id: row.id, usuario_id: usuario_id as string, asignado_por: auth.actor.id })));
      if (assignmentError) { await admin.from("tareas").delete().eq("id", row.id); throw assignmentError; }
    }
    if (checklist.length) {
      const { error: checklistError } = await admin.from("tareas_checklist").insert(checklist.map((texto) => ({ tarea_id: row.id, texto, creado_por: auth.actor.id })));
      if (checklistError) {
        await admin.from("tareas").delete().eq("id", row.id);
        throw checklistError;
      }
    }
    return NextResponse.json({ id: row.id }, { status: 201 });
  } catch (error) { return responderErrorTareas(error); }
}

export async function PATCH(request: NextRequest) {
  if (!origenTareasPermitido(request)) return NextResponse.json({ error: "Origen de solicitud no permitido." }, { status: 403 });
  const auth = await obtenerTareasActor(request);
  if ("response" in auth) return auth.response;
  try {
    const body = await request.json() as Record<string, unknown>;
    const admin = createAdminClient();
    if (body.tipo === "checklist") {
      if (!esUuid(body.id) || typeof body.completado !== "boolean") return NextResponse.json({ error: "El ítem de checklist no es válido." }, { status: 400 });
      const { error } = await admin.from("tareas_checklist").update({ completado: body.completado }).eq("id", body.id);
      if (error) throw error;
      return NextResponse.json({ ok: true });
    }
    const id = body.id;
    if (!esUuid(id)) return NextResponse.json({ error: "La tarea no es válida." }, { status: 400 });
    const { data: current, error: readError } = await admin.from("tareas").select("id,creado_por").eq("id", id).maybeSingle();
    if (readError) throw readError;
    if (!current) return NextResponse.json({ error: "No se encontró la tarea." }, { status: 404 });
    if (body.tipo === "estado") {
      if (typeof body.estado !== "string" || !(ESTADOS as readonly string[]).includes(body.estado)) return NextResponse.json({ error: "Elegí una columna válida." }, { status: 400 });
      const estado = body.estado as EstadoTarea;
      const { error } = await admin.from("tareas").update({ estado, resuelta_at: estado === "FINALIZADA" ? new Date().toISOString() : null, updated_at: new Date().toISOString() }).eq("id", id);
      if (error) throw error;
      return NextResponse.json({ ok: true });
    }
    if (current.creado_por !== auth.actor.id && !esSupervisor(auth.actor.rol)) return NextResponse.json({ error: "Solo quien creó la tarea, Supervisión o Jefatura puede editarla." }, { status: 403 });
    const titulo = typeof body.titulo === "string" ? body.titulo.trim() : "";
    const descripcion = typeof body.descripcion === "string" ? body.descripcion.trim() : "";
    const prioridad = typeof body.prioridad === "string" ? body.prioridad : "";
    const asignadosA = Array.isArray(body.asignadosA) ? [...new Set(body.asignadosA)] : [];
    const fechaLimite = body.fechaLimite === "" || body.fechaLimite === null ? null : body.fechaLimite;
    if (!titulo || titulo.length > 140 || descripcion.length > 4000 || !(PRIORIDADES as readonly string[]).includes(prioridad)) return NextResponse.json({ error: "Completá título y prioridad válidos." }, { status: 400 });
    if (asignadosA.some((usuarioId) => !esUuid(usuarioId)) || asignadosA.length > 20) return NextResponse.json({ error: "Seleccioná hasta 20 usuarios válidos." }, { status: 400 });
    if (fechaLimite !== null && !fechaValida(fechaLimite)) return NextResponse.json({ error: "La fecha límite no es válida." }, { status: 400 });
    if (asignadosA.length) {
      const { data: users, error } = await admin.from("usuarios").select("id").eq("activo", true).in("id", asignadosA as string[]);
      if (error) throw error;
      if ((users?.length ?? 0) !== asignadosA.length) return NextResponse.json({ error: "La lista incluye usuarios inactivos o inválidos." }, { status: 400 });
    }
    const { error } = await admin.from("tareas").update({ titulo, descripcion, prioridad: prioridad as PrioridadTarea, fecha_limite: fechaLimite, updated_at: new Date().toISOString() }).eq("id", id);
    if (error) throw error;
    const { error: deleteAssignmentsError } = await admin.from("tareas_asignados").delete().eq("tarea_id", id);
    if (deleteAssignmentsError) throw deleteAssignmentsError;
    if (asignadosA.length) {
      const { error: assignmentError } = await admin.from("tareas_asignados").insert(asignadosA.map((usuario_id) => ({ tarea_id: id, usuario_id: usuario_id as string, asignado_por: auth.actor.id })));
      if (assignmentError) throw assignmentError;
    }
    return NextResponse.json({ ok: true });
  } catch (error) { return responderErrorTareas(error); }
}

export async function DELETE(request: NextRequest) {
  if (!origenTareasPermitido(request)) return NextResponse.json({ error: "Origen de solicitud no permitido." }, { status: 403 });
  const auth = await obtenerTareasActor(request);
  if ("response" in auth) return auth.response;
  try {
    const body = await request.json() as Record<string, unknown>;
    const admin = createAdminClient();
    if (body.tipo === "archivo") {
      if (!esUuid(body.id)) return NextResponse.json({ error: "El archivo no es válido." }, { status: 400 });
      const { data: file, error: readError } = await admin.from("tareas_archivos").select("id,storage_path,tarea_id,subido_por").eq("id", body.id).maybeSingle();
      if (readError) throw readError;
      if (!file) return NextResponse.json({ error: "No se encontró el archivo." }, { status: 404 });
      const { data: parentTask, error: parentError } = await admin.from("tareas").select("id,creado_por").eq("id", file.tarea_id).maybeSingle();
      if (parentError) throw parentError;
      if (file.subido_por !== auth.actor.id && parentTask?.creado_por !== auth.actor.id && !esSupervisor(auth.actor.rol)) return NextResponse.json({ error: "Solo quien subió el archivo, quien creó la tarea, Supervisión o Jefatura puede eliminarlo." }, { status: 403 });
      const { error } = await admin.from("tareas_archivos").delete().eq("id", body.id);
      if (error) throw error;
      const { error: storageError } = await admin.storage.from("tareas-archivos").remove([file.storage_path]);
      if (storageError) throw storageError;
      return NextResponse.json({ ok: true });
    }
    if (body.tipo === "checklist") {
      if (!esUuid(body.id)) return NextResponse.json({ error: "El ítem no es válido." }, { status: 400 });
      const { error } = await admin.from("tareas_checklist").delete().eq("id", body.id);
      if (error) throw error;
      return NextResponse.json({ ok: true });
    }
    if (!esUuid(body.id)) return NextResponse.json({ error: "La tarea no es válida." }, { status: 400 });
    const { data: current, error: readError } = await admin.from("tareas").select("id,creado_por").eq("id", body.id).maybeSingle();
    if (readError) throw readError;
    if (!current) return NextResponse.json({ error: "No se encontró la tarea." }, { status: 404 });
    if (current.creado_por !== auth.actor.id && !esSupervisor(auth.actor.rol)) return NextResponse.json({ error: "Solo quien creó la tarea, Supervisión o Jefatura puede eliminarla." }, { status: 403 });
    const { data: files, error: filesError } = await admin.from("tareas_archivos").select("storage_path").eq("tarea_id", body.id);
    if (filesError) throw filesError;
    const { error } = await admin.from("tareas").delete().eq("id", body.id);
    if (error) throw error;
    if (files?.length) {
      const { error: storageError } = await admin.storage.from("tareas-archivos").remove(files.map((file) => file.storage_path));
      if (storageError) throw storageError;
    }
    return NextResponse.json({ ok: true });
  } catch (error) { return responderErrorTareas(error); }
}
