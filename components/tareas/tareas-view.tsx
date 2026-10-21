"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from "react";

type Estado = "PENDIENTE" | "EN_CURSO" | "FINALIZADA" | "MATERIALES";
type Prioridad = "BAJA" | "MEDIA" | "ALTA";
type Usuario = { id: string; nombre: string };
type Checklist = { id: string; texto: string; completado: boolean };
type Comentario = { id: string; autorId: string; autor: string; texto: string; createdAt: string };
type ArchivoTarea = { id: string; nombre: string; mimeType: string; tamanoBytes: number; subidoPor: string; subidoPorNombre: string; createdAt: string; url: string };
type Tarea = {
  id: string; titulo: string; descripcion: string; estado: Estado; prioridad: Prioridad; asignadosA: string[];
  asignadosNombres: string[]; creadoPor: string; creadorNombre: string | null; fechaLimite: string | null;
  resueltaAt: string | null; createdAt: string; updatedAt: string; checklist: Checklist[]; comentarios: Comentario[]; archivos: ArchivoTarea[];
};
type TareaForm = { titulo: string; descripcion: string; asignadosA: string[]; estado: Estado; prioridad: Prioridad; fechaLimite: string; checklist: string[] };

const COLUMNAS: { id: Estado; nombre: string; estilo: string }[] = [
  { id: "PENDIENTE", nombre: "Pendientes", estilo: "pending" },
  { id: "EN_CURSO", nombre: "En curso", estilo: "progress" },
  { id: "FINALIZADA", nombre: "Finalizadas", estilo: "done" },
  { id: "MATERIALES", nombre: "Materiales", estilo: "materials" },
];
const PRIORIDADES: Prioridad[] = ["ALTA", "MEDIA", "BAJA"];
const FORM_VACIO: TareaForm = { titulo: "", descripcion: "", asignadosA: [], estado: "PENDIENTE", prioridad: "MEDIA", fechaLimite: "", checklist: [""] };

function requestHeaders() {
  const headers = new Headers({ "Content-Type": "application/json" });
  try {
    const contexto = window.sessionStorage.getItem("coordi-usuario-contexto");
    if (contexto) headers.set("x-user-context", contexto);
  } catch { /* El navegador puede restringir sessionStorage. */ }
  return headers;
}

async function api(path: string, method: string, body?: unknown) {
  const response = await fetch(path, { method, headers: requestHeaders(), ...(body === undefined ? {} : { body: JSON.stringify(body) }), cache: "no-store" });
  const data = await response.json().catch(() => ({})) as { error?: string; id?: string };
  if (!response.ok) throw new Error(data.error || "No se pudo completar la operación.");
  return data;
}

function iniciales(nombre: string | null) {
  return (nombre || "Usuario").split(/\s+/).filter(Boolean).slice(0, 2).map((parte) => parte[0]).join("").toLocaleUpperCase("es");
}

function fechaCorta(fecha: string | null) {
  if (!fecha) return null;
  return new Intl.DateTimeFormat("es-AR", { day: "2-digit", month: "short" }).format(new Date(`${fecha}T12:00:00`));
}

function fechaHora(fecha: string) {
  return new Intl.DateTimeFormat("es-AR", { dateStyle: "short", timeStyle: "short" }).format(new Date(fecha));
}

function tamanoLegible(bytes: number) {
  return bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function Avatar({ nombre, title }: { nombre: string | null; title?: string }) {
  return <span className="tasks-avatar" title={title ?? nombre ?? "Sin asignar"} aria-label={title ?? nombre ?? "Sin asignar"}>{iniciales(nombre)}</span>;
}

function SelectorAsignados({ usuarios, seleccionados, cambiar }: { usuarios: Usuario[]; seleccionados: string[]; cambiar: (ids: string[]) => void }) {
  const [abierto, setAbierto] = useState(false);
  const nombres = usuarios.filter((usuario) => seleccionados.includes(usuario.id)).map((usuario) => usuario.nombre);
  const etiqueta = nombres.length ? nombres.length === 1 ? nombres[0] : `${nombres.length} personas seleccionadas` : "Seleccionar personas";
  return <div className="tasks-assignee-picker notice-recipient-picker" onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setAbierto(false); }}><button type="button" className="notice-recipient-trigger tasks-assignee-trigger" aria-haspopup="listbox" aria-expanded={abierto} onClick={() => setAbierto((actual) => !actual)}><span>{etiqueta}</span><span aria-hidden="true">▾</span></button>{abierto && <div className="notice-recipient-menu tasks-assignee-menu" role="listbox" aria-label="Asignar a varias personas" aria-multiselectable="true">{usuarios.map((usuario) => { const seleccionado = seleccionados.includes(usuario.id); return <button type="button" role="option" aria-selected={seleccionado} className={seleccionado ? "is-selected" : ""} key={usuario.id} onClick={() => cambiar(seleccionado ? seleccionados.filter((id) => id !== usuario.id) : [...seleccionados, usuario.id])}>{usuario.nombre}</button>; })}</div>}</div>;
}

export function TareasView() {
  const [tareas, setTareas] = useState<Tarea[]>([]);
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [usuarioId, setUsuarioId] = useState("");
  const [rol, setRol] = useState("");
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [busqueda, setBusqueda] = useState("");
  const [filtroEstado, setFiltroEstado] = useState("TODOS");
  const [filtroPrioridad, setFiltroPrioridad] = useState("TODAS");
  const [soloMias, setSoloMias] = useState(false);
  const [modalCrear, setModalCrear] = useState(false);
  const [seleccionada, setSeleccionada] = useState<Tarea | null>(null);
  const [editar, setEditar] = useState(false);
  const [form, setForm] = useState<TareaForm>(FORM_VACIO);
  const [archivoNuevo, setArchivoNuevo] = useState<File | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [comentario, setComentario] = useState("");
  const [nuevoItem, setNuevoItem] = useState("");
  const [archivoSubiendo, setArchivoSubiendo] = useState(false);
  const [arrastrada, setArrastrada] = useState<string | null>(null);

  const cargar = useCallback(async (silencioso = false) => {
    if (!silencioso) setCargando(true);
    try {
      const response = await fetch("/api/tareas", { headers: requestHeaders(), cache: "no-store" });
      const data = await response.json() as { tareas?: Tarea[]; usuarios?: Usuario[]; usuarioId?: string; rol?: string; error?: string };
      if (!response.ok) throw new Error(data.error || "No se pudo cargar el tablero.");
      setTareas(data.tareas ?? []);
      setSeleccionada((actual) => actual ? (data.tareas ?? []).find((tarea) => tarea.id === actual.id) ?? actual : null);
      setUsuarios(data.usuarios ?? []);
      setUsuarioId(data.usuarioId ?? "");
      setRol(data.rol ?? "");
      setError("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo cargar el tablero.");
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    const initialLoad = window.setTimeout(() => { void cargar(); }, 0);
    return () => window.clearTimeout(initialLoad);
  }, [cargar]);
  useEffect(() => {
    if (!modalCrear && !seleccionada) return;
    function cerrarConEscape(event: KeyboardEvent) {
      if (event.key === "Escape") { setModalCrear(false); setSeleccionada(null); setEditar(false); }
    }
    window.addEventListener("keydown", cerrarConEscape);
    return () => window.removeEventListener("keydown", cerrarConEscape);
  }, [modalCrear, seleccionada]);

  const tareasFiltradas = useMemo(() => tareas.filter((tarea) => {
    const query = busqueda.trim().toLocaleLowerCase("es");
    const coincideTexto = !query || `${tarea.titulo} ${tarea.descripcion} ${tarea.asignadosNombres.join(" ")} ${tarea.creadorNombre ?? ""}`.toLocaleLowerCase("es").includes(query);
    return coincideTexto
      && (filtroEstado === "TODOS" || tarea.estado === filtroEstado)
      && (filtroPrioridad === "TODAS" || tarea.prioridad === filtroPrioridad)
      && (!soloMias || tarea.asignadosA.includes(usuarioId));
  }), [tareas, busqueda, filtroEstado, filtroPrioridad, soloMias, usuarioId]);

  const crearOEditar = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setGuardando(true);
    setError("");
    const payload = {
      titulo: form.titulo, descripcion: form.descripcion, asignadosA: form.asignadosA,
      estado: form.estado, prioridad: form.prioridad, fechaLimite: form.fechaLimite || null,
      checklist: form.checklist.map((item) => item.trim()).filter(Boolean),
    };
    try {
      if (editar && seleccionada) {
        await api("/api/tareas", "PATCH", { tipo: "editar", id: seleccionada.id, ...payload });
        await cargar(true);
        setSeleccionada(null);
        setEditar(false);
      } else {
        const creada = await api("/api/tareas", "POST", payload);
        if (!creada.id) throw new Error("La tarjeta se creó, pero no se pudo confirmar su identificador.");
        setModalCrear(false);
        setForm(FORM_VACIO);
        setArchivoNuevo(null);
        await cargar(true);
        if (archivoNuevo) {
          try {
            await subirArchivoTarea(creada.id, archivoNuevo);
            await cargar(true);
          } catch (cause) {
            setError(`La tarjeta se creó, pero no se pudo subir el archivo: ${cause instanceof Error ? cause.message : "intentá desde el detalle de la tarjeta."}`);
          }
        }
      }
      setForm(FORM_VACIO);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "No se pudo guardar la tarea."); }
    finally { setGuardando(false); }
  };

  const cambiarEstado = async (tarea: Tarea, estado: Estado) => {
    if (tarea.estado === estado) return;
    try {
      await api("/api/tareas", "PATCH", { tipo: "estado", id: tarea.id, estado });
      await cargar(true);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "No se pudo mover la tarjeta."); }
  };

  const abrirEdicion = (tarea: Tarea) => {
    setForm({ titulo: tarea.titulo, descripcion: tarea.descripcion, asignadosA: tarea.asignadosA, estado: tarea.estado, prioridad: tarea.prioridad, fechaLimite: tarea.fechaLimite ?? "", checklist: tarea.checklist.map((item) => item.texto).concat("") });
    setEditar(true);
  };

  const borrarTarea = async (tarea: Tarea) => {
    if (!window.confirm(`¿Eliminar la tarjeta “${tarea.titulo}”?`)) return;
    try { await api("/api/tareas", "DELETE", { id: tarea.id }); setSeleccionada(null); await cargar(true); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "No se pudo eliminar la tarea."); }
  };

  const enviarComentario = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!seleccionada || !comentario.trim()) return;
    try { await api("/api/tareas", "POST", { tipo: "comentario", tareaId: seleccionada.id, texto: comentario }); setComentario(""); await cargar(true); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "No se pudo guardar el comentario."); }
  };

  const agregarChecklist = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!seleccionada || !nuevoItem.trim()) return;
    try { await api("/api/tareas", "POST", { tipo: "checklist", tareaId: seleccionada.id, texto: nuevoItem }); setNuevoItem(""); await cargar(true); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "No se pudo agregar el ítem."); }
  };

  const cambiarChecklist = async (item: Checklist) => {
    if (!seleccionada) return;
    try { await api("/api/tareas", "PATCH", { tipo: "checklist", id: item.id, completado: !item.completado }); await cargar(true); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "No se pudo actualizar el checklist."); }
  };

  const eliminarChecklist = async (item: Checklist) => {
    try { await api("/api/tareas", "DELETE", { tipo: "checklist", id: item.id }); await cargar(true); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "No se pudo eliminar el ítem."); }
  };

  const subirArchivoTarea = async (tareaId: string, file: File) => {
    const form = new FormData();
    form.set("tareaId", tareaId);
    form.set("archivo", file);
    const headers = requestHeaders();
    headers.delete("Content-Type");
    const response = await fetch("/api/tareas", { method: "POST", headers, body: form });
    const data = await response.json() as { error?: string };
    if (!response.ok) throw new Error(data.error || "No se pudo subir el archivo.");
  };

  const seleccionarArchivoNuevo = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    event.target.value = "";
    if (!file) return;
    const tiposPermitidos = new Set(["image/jpeg", "image/png", "image/webp", "image/gif", "application/pdf", "text/plain", "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "application/vnd.ms-excel", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "application/vnd.ms-powerpoint", "application/vnd.openxmlformats-officedocument.presentationml.presentation"]);
    if (file.size < 1 || file.size > 10 * 1024 * 1024 || !tiposPermitidos.has(file.type)) {
      setError("Elegí una foto o documento permitido de hasta 10 MB.");
      return;
    }
    setError("");
    setArchivoNuevo(file);
  };

  const subirArchivo = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !seleccionada) return;
    setArchivoSubiendo(true);
    setError("");
    try {
      await subirArchivoTarea(seleccionada.id, file);
      await cargar(true);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "No se pudo subir el archivo."); }
    finally { setArchivoSubiendo(false); }
  };

  const eliminarArchivo = async (archivo: ArchivoTarea) => {
    try { await api("/api/tareas", "DELETE", { tipo: "archivo", id: archivo.id }); await cargar(true); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "No se pudo eliminar el archivo."); }
  };

  const puedeEditar = (tarea: Tarea) => tarea.creadoPor === usuarioId || rol === "SUPERVISOR" || rol === "JEFE";
  const totalPorEstado = (estado: Estado) => tareasFiltradas.filter((tarea) => tarea.estado === estado).length;

  return (
    <section className="tasks-page">
      <header className="tasks-heading">
        <div><p className="eyebrow">ORGANIZACIÓN DEL EQUIPO</p><h1 className="page-title">Tablero de tareas</h1><p className="page-description">Creá tareas, asigná responsables y seguí el trabajo del equipo.</p></div>
        <button type="button" className="button button-primary tasks-create-button" onClick={() => { setError(""); setArchivoNuevo(null); setForm(FORM_VACIO); setEditar(false); setModalCrear(true); }}>＋ Nueva tarjeta</button>
      </header>

      <div className="tasks-toolbar">
        <label className="tasks-search"><span aria-hidden="true">⌕</span><input aria-label="Buscar tareas" placeholder="Buscar tareas, personas..." value={busqueda} onChange={(event) => setBusqueda(event.target.value)} /></label>
        <select aria-label="Filtrar por columna" value={filtroEstado} onChange={(event) => setFiltroEstado(event.target.value)}><option value="TODOS">Todas las columnas</option>{COLUMNAS.map((column) => <option key={column.id} value={column.id}>{column.nombre}</option>)}</select>
        <select aria-label="Filtrar por prioridad" value={filtroPrioridad} onChange={(event) => setFiltroPrioridad(event.target.value)}><option value="TODAS">Todas las prioridades</option>{PRIORIDADES.map((priority) => <option key={priority} value={priority}>{priority === "ALTA" ? "Alta" : priority === "MEDIA" ? "Media" : "Baja"}</option>)}</select>
        <button type="button" className={`button tasks-mine-filter${soloMias ? " is-active" : ""}`} onClick={() => setSoloMias((value) => !value)} aria-pressed={soloMias}><span className="tasks-mine-dot" />Asignadas a mí</button>
        <span className="tasks-total">{tareasFiltradas.length} {tareasFiltradas.length === 1 ? "tarea" : "tareas"}</span>
      </div>

      {error && <div className="tasks-error" role="alert"><span>{error}</span><button type="button" aria-label="Cerrar aviso" onClick={() => setError("")}>×</button></div>}
      {cargando ? <div className="tasks-loading panel"><span className="tasks-spinner" />Cargando tablero…</div> : (
        <div className="tasks-board" aria-label="Tablero Kanban de tareas">
          {COLUMNAS.map((column) => {
            const cards = tareasFiltradas.filter((tarea) => tarea.estado === column.id);
            return <section key={column.id} className={`tasks-column tasks-column-${column.estilo}${arrastrada ? " tasks-column-drop-ready" : ""}`} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); const id = arrastrada ?? event.dataTransfer.getData("text/plain"); const task = tareas.find((item) => item.id === id); if (task) void cambiarEstado(task, column.id); setArrastrada(null); }}>
              <header className="tasks-column-heading"><h2>{column.nombre}</h2><span>{totalPorEstado(column.id)}</span></header>
              <div className="tasks-column-cards">
                {cards.map((tarea) => {
                  const listos = tarea.checklist.filter((item) => item.completado).length;
                  const vence = fechaCorta(tarea.fechaLimite);
                  return <button key={tarea.id} type="button" className={`tasks-card${tarea.estado === "FINALIZADA" ? " is-complete" : ""}`} draggable onDragStart={(event) => { setArrastrada(tarea.id); event.dataTransfer.setData("text/plain", tarea.id); event.dataTransfer.effectAllowed = "move"; }} onDragEnd={() => setArrastrada(null)} onClick={() => { setSeleccionada(tarea); setEditar(false); setError(""); }}>
                    <span className="tasks-card-top"><span className={`tasks-priority priority-${tarea.prioridad.toLowerCase()}`}>{tarea.prioridad === "ALTA" ? "Alta" : tarea.prioridad === "MEDIA" ? "Media" : "Baja"}</span>{tarea.asignadosA.includes(usuarioId) && <span className="tasks-assigned-me">Para mí</span>}</span>
                    <strong className="tasks-card-title">{tarea.titulo}</strong>
                    {tarea.descripcion && <span className="tasks-card-description">{tarea.descripcion}</span>}
                    <span className="tasks-card-footer">{vence && <span className="tasks-due"><span aria-hidden="true">◷</span>{vence}</span>}<span className="tasks-card-meta">{tarea.checklist.length > 0 && <span className={listos === tarea.checklist.length ? "is-checked" : ""}>☑ {listos}/{tarea.checklist.length}</span>}{tarea.comentarios.length > 0 && <span>▤ {tarea.comentarios.length}</span>}{tarea.archivos.length > 0 && <span title="Archivos adjuntos">▧ {tarea.archivos.length}</span>}</span>{tarea.asignadosNombres.length ? <span className="tasks-avatar-stack" title={tarea.asignadosNombres.join(", ")}>{tarea.asignadosNombres.slice(0, 3).map((nombre, index) => <Avatar key={`${tarea.asignadosA[index]}-${index}`} nombre={nombre} />)}{tarea.asignadosNombres.length > 3 && <span className="tasks-avatar-more">+{tarea.asignadosNombres.length - 3}</span>}</span> : <span className="tasks-unassigned" title="Sin asignar">＋</span>}</span>
                  </button>;
                })}
                {!cards.length && <div className="tasks-column-empty">{soloMias ? "No tenés tareas asignadas" : "Sin tareas por acá"}</div>}
              </div>
              <button type="button" className="tasks-add-link" onClick={() => { setError(""); setArchivoNuevo(null); setForm({ ...FORM_VACIO, estado: column.id }); setEditar(false); setModalCrear(true); }}>＋ Añadir tarjeta</button>
            </section>;
          })}
        </div>
      )}

      {modalCrear && <div className="tasks-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) { setModalCrear(false); setArchivoNuevo(null); setError(""); } }}><section className="tasks-modal tasks-create-modal" role="dialog" aria-modal="true" aria-labelledby="tasks-create-title"><header className="tasks-modal-header"><div><p className="eyebrow">TAREAS DEL EQUIPO</p><h2 id="tasks-create-title">Nueva tarjeta</h2></div><button type="button" className="tasks-modal-close" onClick={() => { setModalCrear(false); setArchivoNuevo(null); setError(""); }} aria-label="Cerrar">×</button></header><form className="tasks-form" onSubmit={crearOEditar}>
        <label className="tasks-field tasks-field-wide"><span>Título <b>*</b></span><input autoFocus required maxLength={140} value={form.titulo} placeholder="Ej. Revisar informe mensual" onChange={(event) => setForm({ ...form, titulo: event.target.value })} /></label>
        <label className="tasks-field tasks-field-wide"><span>Descripción</span><textarea maxLength={4000} rows={3} value={form.descripcion} placeholder="Describí la tarea y agregá el contexto necesario..." onChange={(event) => setForm({ ...form, descripcion: event.target.value })} /></label>
        <div className="tasks-field"><span>Asignar a varias personas</span><SelectorAsignados usuarios={usuarios} seleccionados={form.asignadosA} cambiar={(asignadosA) => setForm({ ...form, asignadosA })} /></div>
        <label className="tasks-field"><span>Columna</span><select value={form.estado} onChange={(event) => setForm({ ...form, estado: event.target.value as Estado })}>{COLUMNAS.map((column) => <option key={column.id} value={column.id}>{column.nombre}</option>)}</select></label>
        <label className="tasks-field"><span>Prioridad</span><select value={form.prioridad} onChange={(event) => setForm({ ...form, prioridad: event.target.value as Prioridad })}>{PRIORIDADES.map((priority) => <option key={priority} value={priority}>{priority === "ALTA" ? "Alta" : priority === "MEDIA" ? "Media" : "Baja"}</option>)}</select></label>
        <label className="tasks-field"><span>Fecha límite</span><input type="date" value={form.fechaLimite} onChange={(event) => setForm({ ...form, fechaLimite: event.target.value })} /></label>
        <div className="tasks-field tasks-field-wide"><span>Foto o archivo <small>Opcional · hasta 10 MB</small></span><label className="button tasks-upload-button tasks-create-upload" htmlFor="tasks-create-file" style={{ display: "flex", width: "100%", boxSizing: "border-box" }}>＋ Elegir foto o archivo</label><input className="tasks-create-file-input" id="tasks-create-file" type="file" accept="image/jpeg,image/png,image/webp,image/gif,.pdf,.txt,.doc,.docx,.xls,.xlsx,.ppt,.pptx" onChange={seleccionarArchivoNuevo} />{archivoNuevo && <div className="tasks-new-file"><span>{archivoNuevo.name}</span><small>{tamanoLegible(archivoNuevo.size)}</small><button type="button" onClick={() => setArchivoNuevo(null)} aria-label="Quitar archivo">×</button></div>}</div>
        <fieldset className="tasks-checklist-editor"><legend>Checklist inicial <small>Opcional</small></legend>{form.checklist.map((item, index) => <div className="tasks-checklist-input-row" key={index}><input aria-label={`Ítem ${index + 1}`} maxLength={240} placeholder={`Ítem ${index + 1}`} value={item} onChange={(event) => setForm({ ...form, checklist: form.checklist.map((value, itemIndex) => itemIndex === index ? event.target.value : value) })} />{form.checklist.length > 1 && <button type="button" onClick={() => setForm({ ...form, checklist: form.checklist.filter((_, itemIndex) => itemIndex !== index) })} aria-label="Quitar ítem">×</button>}</div>)}{form.checklist.length < 10 && <button type="button" className="tasks-add-check" onClick={() => setForm({ ...form, checklist: [...form.checklist, ""] })}>＋ Agregar ítem</button>}</fieldset>
        {error && <p className="tasks-form-error" role="alert">{error}</p>}<footer className="tasks-modal-actions"><button type="button" className="button" onClick={() => setModalCrear(false)}>Cancelar</button><button className="button button-primary" disabled={guardando}>{guardando ? "Guardando…" : "Crear tarjeta"}</button></footer>
      </form></section></div>}

      {seleccionada && <div className="tasks-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) { setSeleccionada(null); setEditar(false); } }}><section className="tasks-modal tasks-detail-modal" role="dialog" aria-modal="true" aria-labelledby="tasks-detail-title"><header className="tasks-modal-header tasks-detail-header"><div><span className={`tasks-state-badge state-${seleccionada.estado.toLowerCase()}`}>{COLUMNAS.find((column) => column.id === seleccionada.estado)?.nombre}</span><h2 id="tasks-detail-title">{seleccionada.titulo}</h2></div><button type="button" className="tasks-modal-close" onClick={() => { setSeleccionada(null); setEditar(false); }} aria-label="Cerrar">×</button></header>
        <div className="tasks-detail-scroll"><div className="tasks-detail-meta"><div><span>Asignada a</span><strong className="tasks-assignee-names">{seleccionada.asignadosNombres.length ? seleccionada.asignadosNombres.map((nombre, index) => <span key={`${seleccionada.asignadosA[index]}-${index}`}><Avatar nombre={nombre} />{nombre}</span>) : "Sin asignar"}</strong></div><div><span>Creada por</span><strong>{seleccionada.creadorNombre ?? "Usuario"}</strong></div><div><span>Prioridad</span><strong><span className={`tasks-priority priority-${seleccionada.prioridad.toLowerCase()}`}>{seleccionada.prioridad === "ALTA" ? "Alta" : seleccionada.prioridad === "MEDIA" ? "Media" : "Baja"}</span></strong></div><div><span>Fecha límite</span><strong>{seleccionada.fechaLimite ? fechaCorta(seleccionada.fechaLimite) : "Sin fecha"}</strong></div></div>
          <section className="tasks-detail-section"><h3>Descripción</h3><p className="tasks-detail-description">{seleccionada.descripcion || "Sin descripción."}</p></section>
          <section className="tasks-detail-section"><div className="tasks-section-title"><h3>Checklist</h3><span>{seleccionada.checklist.filter((item) => item.completado).length}/{seleccionada.checklist.length}</span></div>{seleccionada.checklist.length > 0 && <div className="tasks-checklist-progress"><i style={{ width: `${seleccionada.checklist.filter((item) => item.completado).length / seleccionada.checklist.length * 100}%` }} /></div>}<div className="tasks-checklist-list">{seleccionada.checklist.map((item) => <label key={item.id} className={`tasks-checklist-item${item.completado ? " is-done" : ""}`}><input type="checkbox" checked={item.completado} onChange={() => void cambiarChecklist(item)} /><span>{item.texto}</span><button type="button" onClick={(event) => { event.preventDefault(); void eliminarChecklist(item); }} aria-label="Eliminar ítem">×</button></label>)}</div><form className="tasks-inline-add" onSubmit={agregarChecklist}><input maxLength={240} placeholder="Agregar un ítem al checklist..." value={nuevoItem} onChange={(event) => setNuevoItem(event.target.value)} /><button className="button" disabled={!nuevoItem.trim()}>Agregar</button></form></section>
          <section className="tasks-detail-section"><div className="tasks-section-title"><h3>Fotos y archivos</h3><span>{seleccionada.archivos.length}</span></div><div className="tasks-attachments-list">{seleccionada.archivos.map((archivo) => <article className="tasks-attachment" key={archivo.id}>{archivo.mimeType.startsWith("image/") ? <a href={archivo.url} target="_blank" rel="noreferrer" className="tasks-attachment-preview" aria-label={`Abrir ${archivo.nombre}`}><Image src={archivo.url} alt={archivo.nombre} width={128} height={86} unoptimized /></a> : <a href={archivo.url} target="_blank" rel="noreferrer" className="tasks-file-icon" aria-label={`Abrir ${archivo.nombre}`}>▤</a>}<div className="tasks-attachment-info"><a href={archivo.url} target="_blank" rel="noreferrer">{archivo.nombre}</a><span>{tamanoLegible(archivo.tamanoBytes)} · {archivo.subidoPorNombre}</span></div>{(archivo.subidoPor === usuarioId || puedeEditar(seleccionada)) && <button type="button" onClick={() => void eliminarArchivo(archivo)} aria-label={`Eliminar ${archivo.nombre}`}>×</button>}</article>)}</div><div className="tasks-upload-row"><label className={`button tasks-upload-button${archivoSubiendo ? " is-uploading" : ""}`} htmlFor="tasks-file-upload">{archivoSubiendo ? "Subiendo…" : "＋ Subir foto o archivo"}</label><input id="tasks-file-upload" type="file" accept="image/jpeg,image/png,image/webp,image/gif,.pdf,.txt,.doc,.docx,.xls,.xlsx,.ppt,.pptx" onChange={(event) => void subirArchivo(event)} disabled={archivoSubiendo} /><small>Imágenes y documentos hasta 10 MB.</small></div></section>
          <section className="tasks-detail-section"><div className="tasks-section-title"><h3>Comentarios</h3><span>{seleccionada.comentarios.length}</span></div><div className="tasks-comments-list">{seleccionada.comentarios.length ? seleccionada.comentarios.map((item) => <article key={item.id} className="tasks-comment"><Avatar nombre={item.autor} /><div><header><strong>{item.autor}</strong><time>{fechaHora(item.createdAt)}</time></header><p>{item.texto}</p></div></article>) : <p className="tasks-muted-copy">Todavía no hay comentarios. Iniciá la conversación del equipo.</p>}</div><form className="tasks-comment-form" onSubmit={enviarComentario}><Avatar nombre={usuarios.find((user) => user.id === usuarioId)?.nombre ?? null} /><textarea aria-label="Escribir comentario" rows={2} maxLength={2000} placeholder="Escribí un comentario..." value={comentario} onChange={(event) => setComentario(event.target.value)} /><button className="button button-primary" disabled={!comentario.trim()}>Enviar</button></form></section>
          <section className="tasks-detail-section tasks-detail-history"><span>Creada {fechaHora(seleccionada.createdAt)}</span>{seleccionada.resueltaAt && <span>Resuelta {fechaHora(seleccionada.resueltaAt)}</span>}</section>
        </div><footer className="tasks-modal-actions tasks-detail-actions"><label className="tasks-move-control"><span>Mover a</span><select value={seleccionada.estado} onChange={(event) => void cambiarEstado(seleccionada, event.target.value as Estado)}>{COLUMNAS.map((column) => <option key={column.id} value={column.id}>{column.nombre}</option>)}</select></label><span className="tasks-action-spacer" />{puedeEditar(seleccionada) && <><button type="button" className="button tasks-delete-button" onClick={() => void borrarTarea(seleccionada)}>Eliminar</button><button type="button" className="button" onClick={() => abrirEdicion(seleccionada)}>Editar</button></>}</footer>
      </section></div>}

      {editar && seleccionada && <div className="tasks-modal-backdrop tasks-edit-layer" onMouseDown={(event) => { if (event.target === event.currentTarget) setEditar(false); }}><section className="tasks-modal tasks-create-modal" role="dialog" aria-modal="true" aria-labelledby="tasks-edit-title"><header className="tasks-modal-header"><div><p className="eyebrow">TAREAS DEL EQUIPO</p><h2 id="tasks-edit-title">Editar tarjeta</h2></div><button type="button" className="tasks-modal-close" onClick={() => setEditar(false)} aria-label="Cerrar">×</button></header><form className="tasks-form" onSubmit={crearOEditar}><label className="tasks-field tasks-field-wide"><span>Título <b>*</b></span><input autoFocus required maxLength={140} value={form.titulo} onChange={(event) => setForm({ ...form, titulo: event.target.value })} /></label><label className="tasks-field tasks-field-wide"><span>Descripción</span><textarea rows={3} maxLength={4000} value={form.descripcion} onChange={(event) => setForm({ ...form, descripcion: event.target.value })} /></label><div className="tasks-field"><span>Asignar a varias personas</span><SelectorAsignados usuarios={usuarios} seleccionados={form.asignadosA} cambiar={(asignadosA) => setForm({ ...form, asignadosA })} /></div><label className="tasks-field"><span>Prioridad</span><select value={form.prioridad} onChange={(event) => setForm({ ...form, prioridad: event.target.value as Prioridad })}>{PRIORIDADES.map((priority) => <option key={priority} value={priority}>{priority === "ALTA" ? "Alta" : priority === "MEDIA" ? "Media" : "Baja"}</option>)}</select></label><label className="tasks-field"><span>Fecha límite</span><input type="date" value={form.fechaLimite} onChange={(event) => setForm({ ...form, fechaLimite: event.target.value })} /></label>{error && <p className="tasks-form-error" role="alert">{error}</p>}<footer className="tasks-modal-actions"><button type="button" className="button" onClick={() => setEditar(false)}>Cancelar</button><button className="button button-primary" disabled={guardando}>{guardando ? "Guardando…" : "Guardar cambios"}</button></footer></form></section></div>}
    </section>
  );
}
