"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { PageHeading } from "@/components/ui/page-heading";
import { useCoordinacionesDemo } from "@/components/providers/demo-data-provider";
import { MOTIVOS_NOVEDAD, type MotivoNovedad } from "@/lib/novedades";

type Novedad = {
  id: string; fecha: string; motivo: string; descripcion: string;
  tiempoDevuelto: boolean; detalleDevolucion: string | null; creadoPor: string;
  nombreUsuario: string; createdAt: string; revisada: boolean;
};
type Rol = "COORDINADOR" | "SUPERVISOR" | "JEFE" | "SOPORTE";

async function respuestaApi<T>(init?: RequestInit, contextId?: string): Promise<T> {
  const response = await fetch("/api/novedades", {
    ...init,
    headers: { "Content-Type": "application/json", ...(contextId ? { "x-user-context": contextId } : {}), ...init?.headers },
  });
  const data = await response.json() as T & { error?: string };
  if (!response.ok) throw new Error(data.error ?? "No se pudo completar la operación.");
  return data;
}

function fechaArgentina() {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Argentina/Buenos_Aires", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  const get = (name: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === name)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

function dateFromIso(value: string) {
  return new Date(`${value}T12:00:00`);
}

function formatDate(value: string, style: "full" | "short" = "short") {
  return new Intl.DateTimeFormat("es-AR", style === "full"
    ? { day: "2-digit", month: "short", year: "numeric" }
    : { weekday: "short", day: "2-digit", month: "2-digit" }).format(dateFromIso(value));
}

function monthKey(value: string) {
  const date = dateFromIso(value);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(key: string) {
  const [year, month] = key.split("-").map(Number);
  const label = new Intl.DateTimeFormat("es-AR", { month: "long", year: "numeric" }).format(new Date(year, month - 1, 1));
  return label.charAt(0).toLocaleUpperCase("es-AR") + label.slice(1);
}

function groupNovedades(novedades: Novedad[]) {
  const groups = new Map<string, Novedad[]>();
  for (const novedad of novedades) groups.set(monthKey(novedad.fecha), [...(groups.get(monthKey(novedad.fecha)) ?? []), novedad]);
  return [...groups.entries()].sort(([a], [b]) => b.localeCompare(a));
}

function iconoMotivo(motivo: string) {
  if (motivo.includes("Demora")) return "◷";
  if (motivo.includes("Cambio")) return "⇄";
  if (motivo.includes("Reprogramación")) return "▣";
  if (motivo.includes("equipo")) return "⚙";
  return "▤";
}

export default function NovedadesPage() {
  const { usuarioEnContexto } = useCoordinacionesDemo();
  const [novedades, setNovedades] = useState<Novedad[]>([]);
  const [rol, setRol] = useState<Rol>("COORDINADOR");
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [guardandoRevision, setGuardandoRevision] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [dialogoAbierto, setDialogoAbierto] = useState(false);
  const [novedadEditando, setNovedadEditando] = useState<string | null>(null);
  const [fecha, setFecha] = useState("");
  const [motivo, setMotivo] = useState<MotivoNovedad>(MOTIVOS_NOVEDAD[0]);
  const [otroMotivo, setOtroMotivo] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [tiempoDevuelto, setTiempoDevuelto] = useState(false);
  const [detalleDevolucion, setDetalleDevolucion] = useState("");
  const [mesFiltro, setMesFiltro] = useState("todos");
  const [anioFiltro, setAnioFiltro] = useState("");
  const [busqueda, setBusqueda] = useState("");

  const cargar = useCallback(async () => {
    setCargando(true);
    setError("");
    try {
      const data = await respuestaApi<{ rol: Rol; novedades: Novedad[] }>(undefined, usuarioEnContexto?.id);
      setRol(data.rol);
      setNovedades(data.novedades);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudieron cargar las novedades.");
    } finally {
      setCargando(false);
    }
  }, [usuarioEnContexto]);

  useEffect(() => {
    const timer = window.setTimeout(() => void cargar(), 0);
    return () => window.clearTimeout(timer);
  }, [cargar]);

  useEffect(() => {
    const year = new Date().getFullYear();
    setFecha(fechaArgentina());
    setAnioFiltro(String(year));
  }, []);

  const anios = useMemo(() => [...new Set(novedades.map((item) => item.fecha.slice(0, 4)))].sort((a, b) => b.localeCompare(a)), [novedades]);
  const meses = useMemo(() => [...new Set(novedades.filter((item) => item.fecha.startsWith(`${anioFiltro}-`)).map((item) => monthKey(item.fecha)))].sort((a, b) => b.localeCompare(a)), [novedades, anioFiltro]);
  const filtradas = useMemo(() => novedades.filter((item) => {
    const coincideAnio = rol !== "JEFE" || item.fecha.startsWith(`${anioFiltro}-`);
    const coincideMes = rol !== "JEFE" || mesFiltro === "todos" || monthKey(item.fecha) === mesFiltro;
    const termino = busqueda.trim().toLocaleLowerCase("es-AR");
    const coincideBusqueda = !termino || [item.nombreUsuario, item.motivo, item.descripcion].some((value) => value.toLocaleLowerCase("es-AR").includes(termino));
    return coincideAnio && coincideMes && coincideBusqueda;
  }), [novedades, rol, anioFiltro, mesFiltro, busqueda]);
  const grupos = useMemo(() => groupNovedades(filtradas), [filtradas]);

  async function guardar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setGuardando(true);
    setError("");
    try {
      await respuestaApi<{ id: string }>({ method: novedadEditando ? "PATCH" : "POST", body: JSON.stringify({ id: novedadEditando, fecha, motivo, otroMotivo, descripcion, tiempoDevuelto, detalleDevolucion }) }, usuarioEnContexto?.id);
      setDialogoAbierto(false);
      setNovedadEditando(null);
      setFecha(fechaArgentina());
      setMotivo(MOTIVOS_NOVEDAD[0]);
      setOtroMotivo("");
      setDescripcion("");
      setTiempoDevuelto(false);
      setDetalleDevolucion("");
      await cargar();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo guardar la novedad.");
    } finally {
      setGuardando(false);
    }
  }

  function editar(novedad: Novedad) {
    setError("");
    setNovedadEditando(novedad.id);
    const motivoEsPredefinido = (MOTIVOS_NOVEDAD as readonly string[]).includes(novedad.motivo);
    setMotivo(motivoEsPredefinido ? novedad.motivo as MotivoNovedad : "Otro");
    setOtroMotivo(motivoEsPredefinido ? "" : novedad.motivo);
    setFecha(novedad.fecha);
    setDescripcion(novedad.descripcion);
    setTiempoDevuelto(novedad.tiempoDevuelto);
    setDetalleDevolucion(novedad.detalleDevolucion ?? "");
    setDialogoAbierto(true);
  }

  async function eliminar(novedad: Novedad) {
    if (!window.confirm(`¿Eliminar la novedad "${novedad.motivo}" del ${formatDate(novedad.fecha, "full")}?`)) return;
    setGuardandoRevision(novedad.id);
    setError("");
    try {
      await respuestaApi({ method: "DELETE", body: JSON.stringify({ id: novedad.id }) }, usuarioEnContexto?.id);
      setNovedades((current) => current.filter((item) => item.id !== novedad.id));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo eliminar la novedad.");
    } finally {
      setGuardandoRevision(null);
    }
  }

  async function cambiarRevision(novedad: Novedad) {
    const revisada = !novedad.revisada;
    setGuardandoRevision(novedad.id);
    setError("");
    try {
      await respuestaApi({ method: "PATCH", body: JSON.stringify({ id: novedad.id, revisada }) }, usuarioEnContexto?.id);
      setNovedades((current) => current.map((item) => item.id === novedad.id ? { ...item, revisada } : item));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo guardar la revisión.");
    } finally {
      setGuardandoRevision(null);
    }
  }

  function abrirDialogo() {
    setError("");
    setNovedadEditando(null);
    setFecha(fechaArgentina());
    setMotivo(MOTIVOS_NOVEDAD[0]);
    setOtroMotivo("");
    setDescripcion("");
    setTiempoDevuelto(false);
    setDetalleDevolucion("");
    setDialogoAbierto(true);
  }

  return (
    <section className="novedades-page">
      {rol === "JEFE" ? (
        <div className="novedades-heading-manager">
          <PageHeading eyebrow="GESTIÓN DEL EQUIPO" title="Novedades" description="Novedades registradas por el equipo." />
        </div>
      ) : (
        <PageHeading eyebrow="GESTIÓN PERSONAL" title="Novedades" description="Registrá novedades y consultá su seguimiento." />
      )}

      {error && <p className="novedades-alert" role="alert">{error}</p>}

      {rol !== "JEFE" && (
        <button type="button" className="novedades-create-card panel" onClick={abrirDialogo}>
          <span className="novedades-create-icon" aria-hidden="true">＋</span>
          <strong>Cargar novedad nueva</strong>
          <span>Dejá registrada una novedad del trabajo</span>
          <span className="button button-primary">＋ Cargar novedad</span>
        </button>
      )}

      {rol === "JEFE" && (
        <div className="novedades-filters panel">
          <label>Mes<select value={mesFiltro} onChange={(event) => setMesFiltro(event.target.value)}><option value="todos">Todos los meses</option>{meses.map((mes) => <option key={mes} value={mes}>{monthLabel(mes)}</option>)}</select></label>
          <label>Año<select value={anioFiltro} onChange={(event) => { setAnioFiltro(event.target.value); setMesFiltro("todos"); }}>{anios.map((anio) => <option key={anio} value={anio}>{anio}</option>)}</select></label>
          <label className="novedades-search">Buscar<input value={busqueda} onChange={(event) => setBusqueda(event.target.value)} placeholder="Buscar por usuario, motivo o descripción..." /></label>
        </div>
      )}

      <section className={rol === "JEFE" ? "novedades-manager-list" : "novedades-own-list"}>
        {rol !== "JEFE" ? <h2 className="section-title">Mis novedades</h2> : null}
        {cargando ? <p className="novedades-empty">Cargando novedades...</p> : filtradas.length === 0 ? (
          <div className="panel novedades-empty-state"><strong>{rol === "JEFE" ? "No hay novedades para estos filtros" : "Todavía no cargaste novedades"}</strong><span>{rol === "JEFE" ? "Probá cambiar el período o la búsqueda." : "Las novedades que registres van a aparecer acá."}</span></div>
        ) : grupos.map(([groupKey, items]) => (
          <section className="novedad-month" key={groupKey}>
            {rol === "JEFE" && <div className="novedad-month-heading"><h2>{monthLabel(groupKey)}</h2><span>{items.length} {items.length === 1 ? "novedad" : "novedades"}</span></div>}
            <div className={rol === "JEFE" ? "novedad-rows" : "novedad-own-cards"}>
              {items.map((item) => (
                <article className={`novedad-row panel${rol === "JEFE" && item.revisada ? " is-reviewed" : ""}`} key={item.id}>
                  <div className="novedad-date"><strong>{formatDate(item.fecha, "full")}</strong><span>{formatDate(item.fecha)}</span></div>
                  {rol === "JEFE" && <div className="novedad-author"><span className="novedad-avatar" aria-hidden="true">{item.nombreUsuario.split(/\s+/).slice(0, 2).map((word) => word[0]).join("").toLocaleUpperCase("es-AR")}</span><div><strong>{item.nombreUsuario}</strong><span>Registrada por el equipo</span></div></div>}
                  <div className={`novedad-reason reason-${item.motivo === "Demora en instalación" ? "delay" : item.motivo === "Cambio de turno" ? "change" : item.motivo === "Reprogramación" ? "reschedule" : "general"}`}><span aria-hidden="true">{iconoMotivo(item.motivo)}</span>{item.motivo}</div>
                  <p className="novedad-description">{item.descripcion}</p>
                  <div className="novedad-return-status">
                    <span className={`novedad-status ${item.tiempoDevuelto ? "status-returned" : "status-pending"}`}><span aria-hidden="true">{item.tiempoDevuelto ? "✓" : "◷"}</span>{item.tiempoDevuelto ? "Tiempo devuelto" : "Pendiente de devolución"}</span>
                  </div>
                  {rol === "JEFE" && item.tiempoDevuelto && item.detalleDevolucion && <p className="novedad-return-detail">{item.detalleDevolucion}</p>}
                  {rol !== "JEFE" && <div className="novedad-owner-actions"><button type="button" className="novedad-action" title="Editar novedad" aria-label={`Editar novedad del ${formatDate(item.fecha, "full")}`} onClick={() => editar(item)}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m4 16.5-.8 4.3 4.3-.8L19.8 7.7a2.1 2.1 0 0 0-3-3L4 16.5Z"/><path d="m14.9 6.6 3 3"/></svg></button><button type="button" className="novedad-action novedad-action-delete" title="Eliminar novedad" aria-label={`Eliminar novedad del ${formatDate(item.fecha, "full")}`} disabled={guardandoRevision === item.id} onClick={() => void eliminar(item)}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M10 11v6m4-6v6M5.5 7l1 13h11l1-13M9 7V4h6v3"/></svg></button></div>}
                  {rol === "JEFE" && <label className="novedad-review" title={item.revisada ? "Marcar como no revisada" : "Marcar como revisada"}><input type="checkbox" checked={item.revisada} disabled={guardandoRevision === item.id} onChange={() => void cambiarRevision(item)} aria-label={`${item.revisada ? "Desmarcar" : "Marcar"} como revisada: ${item.nombreUsuario}, ${formatDate(item.fecha, "full")}`} /><span>Revisado</span></label>}
                </article>
              ))}
            </div>
          </section>
        ))}
      </section>

      {dialogoAbierto && <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !guardando) setDialogoAbierto(false); }}>
        <section className="panel modal-card novedades-modal" role="dialog" aria-modal="true" aria-labelledby="novedad-dialog-title">
          <div className="modal-heading"><div><p className="eyebrow">GESTIÓN DEL EQUIPO</p><h2 className="modal-title" id="novedad-dialog-title">{novedadEditando ? "Editar novedad" : "Cargar novedad nueva"}</h2></div><button type="button" className="modal-close" aria-label="Cerrar" onClick={() => { setDialogoAbierto(false); setNovedadEditando(null); }} disabled={guardando}>×</button></div>
          <p className="novedades-modal-description">Completá los datos para dejarla registrada.</p>
          <form onSubmit={(event) => void guardar(event)}>
            <label className="form-field">Fecha de la novedad<input type="date" value={fecha} onChange={(event) => setFecha(event.target.value)} required /></label>
            <label className="form-field">Motivo de la novedad<select value={motivo} onChange={(event) => setMotivo(event.target.value as MotivoNovedad)} required>{MOTIVOS_NOVEDAD.map((option) => <option key={option} value={option}>{option}</option>)}</select></label>
            {motivo === "Otro" && <label className="form-field novedades-return-field">Escribí el motivo<input value={otroMotivo} onChange={(event) => setOtroMotivo(event.target.value)} maxLength={80} placeholder="Motivo de la novedad" required /></label>}
            <label className="form-field">Descripción<textarea value={descripcion} onChange={(event) => setDescripcion(event.target.value)} rows={4} maxLength={2000} placeholder="Describí brevemente qué sucedió..." required /></label>
            <label className="novedad-time-check"><input type="checkbox" checked={tiempoDevuelto} onChange={(event) => setTiempoDevuelto(event.target.checked)} />¿Se devolvió el tiempo?</label>
            {tiempoDevuelto && <label className="form-field novedades-return-field">¿Cuándo fue devuelto?<textarea value={detalleDevolucion} onChange={(event) => setDetalleDevolucion(event.target.value)} rows={2} maxLength={300} placeholder="Por ejemplo: el 15/10/2026, en el turno de la mañana" required /></label>}
            {error && <p className="novedades-alert" role="alert">{error}</p>}
            <div className="novedades-modal-actions"><button type="button" className="button" onClick={() => { setDialogoAbierto(false); setNovedadEditando(null); }} disabled={guardando}>Cancelar</button><button type="submit" className="button button-primary" disabled={guardando}>{guardando ? "Guardando..." : novedadEditando ? "Guardar cambios" : "Guardar novedad"}</button></div>
          </form>
        </section>
      </div>}
    </section>
  );
}
