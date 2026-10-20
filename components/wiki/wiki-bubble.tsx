"use client";

import { useEffect, useState, type ChangeEvent, type FormEvent } from "react";
import { usePathname } from "next/navigation";
import { useCoordinacionesDemo } from "@/components/providers/demo-data-provider";

type Publicacion = { id: string; titulo: string; area_interesada: string; comentario: string; imagen_url: string | null; creado_por: string; created_at: string; autor: string };
type FormState = { id: string; titulo: string; area: string; contenido: string; imagen: File | null; quitarImagen: boolean; imagenActual: string | null };
const emptyForm: FormState = { id: "", titulo: "", area: "", contenido: "", imagen: null, quitarImagen: false, imagenActual: null };
const sectores = ["Coordinación", "Soporte", "Supervisión", "Jefatura"];

function fecha(value: string) {
  return new Intl.DateTimeFormat("es-AR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function normalizar(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

export function WikiBubble() {
  const pathname = usePathname();
  const { usuarioEnContexto } = useCoordinacionesDemo();
  const visible = pathname === "/" || pathname.startsWith("/coordinaciones/") || pathname.startsWith("/liqui") || pathname.startsWith("/novedades");
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [publicaciones, setPublicaciones] = useState<Publicacion[]>([]);
  const [usuarioId, setUsuarioId] = useState("");
  const [rol, setRol] = useState("");
  const [form, setForm] = useState<FormState>(emptyForm);
  const [editMode, setEditMode] = useState(false);
  const [deletingId, setDeletingId] = useState("");
  const [busqueda, setBusqueda] = useState("");
  const [seleccionada, setSeleccionada] = useState<Publicacion | null>(null);

  useEffect(() => { if (!visible) { setOpen(false); setEditMode(false); setSeleccionada(null); } }, [visible]);

  async function cargar() {
    setLoading(true); setError("");
    try {
      const response = await fetch("/api/publicaciones", { cache: "no-store", headers: usuarioEnContexto ? { "x-user-context": usuarioEnContexto.id } : {} });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "No se pudieron cargar las publicaciones.");
      setPublicaciones(data.publicaciones ?? []); setUsuarioId(data.usuarioId ?? ""); setRol(data.rol ?? "");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "No se pudieron cargar las publicaciones."); }
    finally { setLoading(false); }
  }

  useEffect(() => { if (open) void cargar(); }, [open, usuarioEnContexto?.id]);

  if (!visible) return null;

  function editar(item: Publicacion) {
    setForm({ id: item.id, titulo: item.titulo, area: item.area_interesada, contenido: item.comentario, imagen: null, quitarImagen: false, imagenActual: item.imagen_url });
    setEditMode(true); setSeleccionada(null); setError("");
  }

  function seleccionarImagen(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    if (file && (!file.type.startsWith("image/") || file.size > 5 * 1024 * 1024)) {
      setError("Elegí una imagen de hasta 5 MB."); event.target.value = ""; return;
    }
    setForm((current) => ({ ...current, imagen: file, quitarImagen: false })); setError("");
  }

  async function guardar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true); setError("");
    const body = new FormData();
    body.set("titulo", form.titulo); body.set("area", form.area); body.set("contenido", form.contenido);
    if (form.id) body.set("id", form.id);
    if (form.imagen) body.set("imagen", form.imagen);
    if (form.quitarImagen) body.set("quitarImagen", "true");
    try {
      const response = await fetch("/api/publicaciones", { method: form.id ? "PATCH" : "POST", headers: usuarioEnContexto ? { "x-user-context": usuarioEnContexto.id } : {}, body });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "No se pudo guardar la publicación.");
      setForm(emptyForm); setEditMode(false); await cargar();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "No se pudo guardar la publicación."); }
    finally { setSaving(false); }
  }

  async function borrar(item: Publicacion) {
    if (!window.confirm(`¿Querés borrar “${item.titulo}”?`)) return;
    setDeletingId(item.id); setError("");
    try {
      const response = await fetch("/api/publicaciones", { method: "DELETE", headers: { "Content-Type": "application/json", ...(usuarioEnContexto ? { "x-user-context": usuarioEnContexto.id } : {}) }, body: JSON.stringify({ id: item.id }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "No se pudo borrar la publicación.");
      if (seleccionada?.id === item.id) setSeleccionada(null);
      await cargar();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "No se pudo borrar la publicación."); }
    finally { setDeletingId(""); }
  }

  const coincidencias = publicaciones.filter((item) => normalizar(`${item.titulo} ${item.area_interesada} ${item.comentario} ${item.autor}`).includes(normalizar(busqueda.trim())));

  return <>
    <button type="button" className="wiki-bubble" onClick={() => { setOpen(true); setEditMode(false); }} aria-label="Abrir publicaciones del equipo" title="Wiki del equipo">
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 7.5h7l2 2h9v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z"/><path d="M3 7.5v-2a2 2 0 0 1 2-2h5l2 2h7a2 2 0 0 1 2 2v2"/></svg><span>Wiki</span>
    </button>
    {open && <div className="wiki-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) { setOpen(false); setEditMode(false); setSeleccionada(null); } }}>
      <section className="wiki-modal" role="dialog" aria-modal="true" aria-labelledby="wiki-title">
        <header className="wiki-header"><div><span className="wiki-eyebrow">CONOCIMIENTO COMPARTIDO</span><h2 id="wiki-title">Wiki del equipo</h2><p>Compartí guías e información útil con todos.</p></div><button className="wiki-close" type="button" onClick={() => { setOpen(false); setEditMode(false); setSeleccionada(null); }} aria-label="Cerrar">×</button></header>
        {editMode ? <form className="wiki-form" onSubmit={guardar}>
          <label>Título<input value={form.titulo} maxLength={120} required placeholder="Ej. Guía para preparar una visita técnica" onChange={(e) => setForm({ ...form, titulo: e.target.value })}/></label>
          <label>Sector interesado<select className="wiki-sector-select" value={form.area} required onChange={(e) => setForm({ ...form, area: e.target.value })}><option value="" disabled>Seleccioná un sector</option>{!sectores.includes(form.area) && form.area && <option value={form.area} disabled>{form.area} (anterior)</option>}{sectores.map((sector) => <option value={sector} key={sector}>{sector}</option>)}</select></label>
          <label>Información<textarea value={form.contenido} maxLength={12000} required rows={8} placeholder="Escribí la información para el equipo…" onChange={(e) => setForm({ ...form, contenido: e.target.value })}/></label>
          <div className="wiki-image-field"><label htmlFor="wiki-image">Agregar una imagen <span>JPG, PNG o WEBP · hasta 5 MB</span></label><input id="wiki-image" type="file" accept="image/jpeg,image/png,image/webp" onChange={seleccionarImagen}/>
            {(form.imagen || form.imagenActual) && <div className="wiki-image-preview"><img src={form.imagen ? URL.createObjectURL(form.imagen) : form.imagenActual!} alt="Vista previa"/><button type="button" onClick={() => setForm({ ...form, imagen: null, imagenActual: null, quitarImagen: true })}>Quitar imagen</button></div>}
          </div>
          {error && <p className="wiki-error" role="alert">{error}</p>}
          <footer className="wiki-form-actions"><button className="wiki-secondary" type="button" onClick={() => { setEditMode(false); setForm(emptyForm); setError(""); }}>Cancelar</button><button className="wiki-primary" disabled={saving}>{saving ? "Guardando…" : form.id ? "Guardar cambios" : "Publicar"}</button></footer>
        </form> : seleccionada ? <div className="wiki-detail-panel"><div className="wiki-detail-toolbar"><button type="button" className="wiki-secondary" onClick={() => setSeleccionada(null)}>← Volver a publicaciones</button><span>{seleccionada.area_interesada}</span></div><article className="wiki-detail"><time>{fecha(seleccionada.created_at)}</time><h3>{seleccionada.titulo}</h3><p className="wiki-author">Publicado por <strong>{seleccionada.autor}</strong></p><div className="wiki-content">{seleccionada.comentario}</div>{seleccionada.imagen_url && <img className="wiki-detail-image" src={seleccionada.imagen_url} alt={`Imagen completa de ${seleccionada.titulo}`}/>} {(seleccionada.creado_por === usuarioId || rol === "JEFE" || rol === "SUPERVISOR") && <div className="wiki-item-actions"><button type="button" className="wiki-secondary" onClick={() => editar(seleccionada)}>Editar</button>{(rol === "JEFE" || rol === "SUPERVISOR") && <button type="button" className="wiki-danger" disabled={deletingId === seleccionada.id} onClick={() => void borrar(seleccionada)}>{deletingId === seleccionada.id ? "Borrando…" : "Eliminar"}</button>}</div>}</article></div> : <div className="wiki-list-panel"><div className="wiki-list-heading"><div><strong>Publicaciones</strong><span>{publicaciones.length} {publicaciones.length === 1 ? "artículo" : "artículos"}</span></div><div className="wiki-list-tools"><label className="wiki-search"><span aria-hidden="true">⌕</span><input className="wiki-search-input" type="search" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="Buscar publicaciones…" aria-label="Buscar publicaciones"/></label><button type="button" className="wiki-primary" onClick={() => { setForm(emptyForm); setEditMode(true); setError(""); }}>＋ Nueva publicación</button></div></div>
          {error && <p className="wiki-error" role="alert">{error}</p>}
          {loading ? <p className="wiki-empty">Cargando publicaciones…</p> : publicaciones.length === 0 ? <div className="wiki-empty"><strong>La wiki está vacía</strong><span>Creá la primera publicación para compartirla con el equipo.</span></div> : coincidencias.length === 0 ? <div className="wiki-empty"><strong>No hay coincidencias</strong><span>Probá con otra palabra o sector.</span></div> : <div className="wiki-publication-list">{coincidencias.map((item) => {
            const own = item.creado_por === usuarioId; const privileged = rol === "JEFE" || rol === "SUPERVISOR";
            return <article className="wiki-publication" key={item.id} role="button" tabIndex={0} onClick={() => setSeleccionada(item)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); setSeleccionada(item); } }}><div className="wiki-publication-copy"><div className="wiki-publication-top"><span className="wiki-area">{item.area_interesada}</span><time>{fecha(item.created_at)}</time></div><h3>{item.titulo}</h3><p className="wiki-author">Publicado por <strong>{item.autor}</strong></p><div className="wiki-content wiki-content-preview">{item.comentario}</div><span className="wiki-read-more">Ver publicación →</span>{(own || privileged) && <div className="wiki-item-actions" onClick={(event) => event.stopPropagation()}>{(own || privileged) && <button type="button" className="wiki-secondary" onClick={() => editar(item)}>Editar</button>}{privileged && <button type="button" className="wiki-danger" disabled={deletingId === item.id} onClick={() => void borrar(item)}>{deletingId === item.id ? "Borrando…" : "Eliminar"}</button>}</div>}</div>{item.imagen_url && <div className="wiki-publication-media"><img className="wiki-publication-thumb" src={item.imagen_url} alt={`Miniatura de ${item.titulo}`}/></div>}</article>;
          })}</div>}
        </div>}
      </section>
    </div>}
  </>;
}
