"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { createClient } from "@/lib/supabase/client";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import interactionPlugin from "@fullcalendar/interaction";
import esLocale from "@fullcalendar/core/locales/es";
import type { DayCellContentArg, DayCellMountArg } from "@fullcalendar/core";
import { useCoordinacionesDemo } from "@/components/providers/demo-data-provider";

type UsuarioAviso = { id: string; nombre: string };
type Aviso = { id: string; texto: string; desde: string; hasta: string };
type FilaRadar = { fecha: string; zona_id: string | null; zona: string; cantidad: number };
const fechaHoy = () => {
  const ahora = new Date();
  return `${ahora.getFullYear()}-${String(ahora.getMonth() + 1).padStart(2, "0")}-${String(ahora.getDate()).padStart(2, "0")}`;
};
function fechaDeCelda(fecha: Date) {
  return String(fecha.getFullYear()) + "-" + String(fecha.getMonth() + 1).padStart(2, "0") + "-" + String(fecha.getDate()).padStart(2, "0");
}
function tituloDelMes(fecha: Date) {
  const mes = new Intl.DateTimeFormat("es-AR", { month: "long" }).format(fecha);
  return `${mes.charAt(0).toLocaleUpperCase("es-AR")}${mes.slice(1)} ${fecha.getFullYear()}`;
}
function inicioDeSemanaActual(fecha = new Date()) {
  const lunes = new Date(fecha.getFullYear(), fecha.getMonth(), fecha.getDate());
  lunes.setDate(lunes.getDate() - ((lunes.getDay() + 6) % 7));
  return lunes;
}
function fechaIso(fecha: Date) {
  return `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, "0")}-${String(fecha.getDate()).padStart(2, "0")}`;
}
function etiquetaSemana(lunes: Date) {
  const domingo = new Date(lunes.getFullYear(), lunes.getMonth(), lunes.getDate() + 6);
  const inicio = new Intl.DateTimeFormat("es-AR", { day: "numeric", month: "long" }).format(lunes);
  const fin = new Intl.DateTimeFormat("es-AR", { day: "numeric", month: "long", year: "numeric" }).format(domingo);
  return `${inicio} al ${fin}`;
}

export function CalendarView() {
  const router = useRouter();
  const { fechasConCoordinaciones, feriados, ready, error, usuarioActual, usuarioEnContexto, rolDemo } = useCoordinacionesDemo();
  const soloCalendario = rolDemo === "SOPORTE";
  const [usuarios, setUsuarios] = useState<UsuarioAviso[]>([]);
  const [avisos, setAvisos] = useState<Aviso[]>([]);
  const [modal, setModal] = useState(false);
  const [texto, setTexto] = useState("");
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");
  const [destinatarios, setDestinatarios] = useState<string[]>([]);
  const [todoElEquipo, setTodoElEquipo] = useState(true);
  const [destinatariosAbiertos, setDestinatariosAbiertos] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [errorAviso, setErrorAviso] = useState("");
  const [cerrando, setCerrando] = useState<string | null>(null);
  const [indiceAviso, setIndiceAviso] = useState(0);
  const [radarAbierto, setRadarAbierto] = useState(false);
  const [radarCargando, setRadarCargando] = useState(false);
  const [radarError, setRadarError] = useState("");
  const [radarFilas, setRadarFilas] = useState<FilaRadar[]>([]);
  const [radarInicio, setRadarInicio] = useState<Date | null>(null);
  const [zonaBuscada, setZonaBuscada] = useState("");
  const [mesMovil, setMesMovil] = useState(() => new Date(2026, 9, 1));
  const [hoyIso, setHoyIso] = useState("");
  const usuarioId = usuarioEnContexto?.id ?? usuarioActual?.id;

  const cargarAvisos = useCallback(async () => {
    if (!usuarioId) return;
    try {
      const response = await fetch("/api/avisos", { cache: "no-store", headers: usuarioEnContexto ? { "x-user-context": usuarioEnContexto.id } : {} });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "No se pudieron cargar los avisos.");
      setErrorAviso("");
      setAvisos(data.avisos ?? []);
      setIndiceAviso(0);
      setUsuarios(data.usuarios ?? []);
    } catch (cause) {
      setErrorAviso(cause instanceof Error ? cause.message : "No se pudieron cargar los avisos.");
    }
  }, [usuarioId, usuarioEnContexto]);

  useEffect(() => {
    const timer = window.setTimeout(() => { void cargarAvisos(); }, 0);
    return () => window.clearTimeout(timer);
  }, [cargarAvisos]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const ahora = new Date();
      setMesMovil(new Date(ahora.getFullYear(), ahora.getMonth(), 1));
      setHoyIso(fechaHoy());
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!radarAbierto) return;
    const cerrarConEscape = (event: KeyboardEvent) => { if (event.key === "Escape") setRadarAbierto(false); };
    window.addEventListener("keydown", cerrarConEscape);
    return () => window.removeEventListener("keydown", cerrarConEscape);
  }, [radarAbierto]);

  function abrirFormulario() {
    const hoy = fechaHoy();
    setDesde(hoy); setHasta(hoy); setTexto(""); setDestinatarios([]); setTodoElEquipo(true); setDestinatariosAbiertos(false); setErrorAviso(""); setModal(true);
  }

  async function abrirRadar() {
    const lunes = inicioDeSemanaActual();
    setRadarInicio(lunes);
    setZonaBuscada("");
    setRadarFilas([]);
    setRadarError("");
    setRadarAbierto(true);
    setRadarCargando(true);
    try {
      const supabase = createClient();
      const { data, error: errorRadar } = await supabase.rpc("radar_semanal", { p_semana_inicio: fechaIso(lunes) });
      if (errorRadar) throw errorRadar;
      setRadarFilas((data ?? []).map((fila) => ({ ...fila, cantidad: Number(fila.cantidad) || 0 })));
    } catch (cause) {
      setRadarError(cause instanceof Error ? cause.message : "No se pudo cargar el radar semanal.");
    } finally {
      setRadarCargando(false);
    }
  }

  function quitarAvisoDeLaVista(id: string) {
    const restantes = avisos.filter((aviso) => aviso.id !== id);
    setAvisos(restantes);
    setIndiceAviso((actual) => Math.max(0, Math.min(actual, restantes.length - 1)));
  }

  async function crearAviso(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setGuardando(true); setErrorAviso("");
    try {
      const response = await fetch("/api/avisos", {
        method: "POST", headers: { "Content-Type": "application/json", ...(usuarioEnContexto ? { "x-user-context": usuarioEnContexto.id } : {}) },
        body: JSON.stringify({ texto: texto.trim(), desde, hasta, destinatarios: todoElEquipo ? usuarios.map((usuario) => usuario.id) : destinatarios }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "No se pudo guardar el aviso.");
      setTexto(""); setModal(false); setDesde(fechaHoy()); setHasta(fechaHoy()); setDestinatarios([]); setTodoElEquipo(true);
      await cargarAvisos();
    } catch (cause) {
      setErrorAviso(cause instanceof Error ? cause.message : "No se pudo guardar el aviso.");
    } finally { setGuardando(false); }
  }

  async function ocultarDefinitivamente(id: string) {
    setCerrando(id);
    try {
      const response = await fetch("/api/avisos", { method: "PATCH", headers: { "Content-Type": "application/json", ...(usuarioEnContexto ? { "x-user-context": usuarioEnContexto.id } : {}) }, body: JSON.stringify({ id }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "No se pudo cerrar el aviso.");
      quitarAvisoDeLaVista(id);
    } catch (cause) { setErrorAviso(cause instanceof Error ? cause.message : "No se pudo cerrar el aviso."); }
    finally { setCerrando(null); }
  }

  function renderDayCell(info: DayCellContentArg) { return info.dayNumberText; }
  function classesForDay(info: DayCellContentArg) {
    const fecha = fechaDeCelda(info.date);
    const classes: string[] = [];
    if (fechasConCoordinaciones.includes(fecha)) classes.push("has-coordinaciones");
    if (feriados.some((feriado) => feriado.fecha === fecha && feriado.esFeriado)) classes.push("is-holiday");
    return classes;
  }
  function contenidoAdicionalDeDia(info: DayCellMountArg) {
    const fecha = fechaDeCelda(info.date);
    const feriado = feriados.find((item) => item.fecha === fecha);
    const frame = info.el.querySelector<HTMLElement>(".fc-daygrid-day-frame");
    if (frame && feriado?.personalInterno.length) {
      const personal = document.createElement("div"); personal.className = "calendar-day-staff";
      feriado.personalInterno.forEach((nombre) => { const etiqueta = document.createElement("span"); etiqueta.textContent = nombre; personal.appendChild(etiqueta); });
      frame.appendChild(personal);
    }
  }

  const avisoActual = avisos[Math.min(indiceAviso, avisos.length - 1)];
  const destinatarioLabel = todoElEquipo
    ? "Todo el equipo"
    : destinatarios.map((id) => usuarios.find((usuario) => usuario.id === id)?.nombre).filter(Boolean).join(", ") || "Seleccioná usuarios";

  const offsetMesMovil = (new Date(mesMovil.getFullYear(), mesMovil.getMonth(), 1).getDay() + 6) % 7;
  const diasEnMesMovil = new Date(mesMovil.getFullYear(), mesMovil.getMonth() + 1, 0).getDate();
  const cantidadDiasMovil = Math.ceil((offsetMesMovil + diasEnMesMovil) / 7) * 7;
  const diasMovil = Array.from({ length: cantidadDiasMovil }, (_, index) => new Date(mesMovil.getFullYear(), mesMovil.getMonth(), index - offsetMesMovil + 1));
  const tituloMesMovil = tituloDelMes(mesMovil);
  const diasRadar = radarInicio ? Array.from({ length: 7 }, (_, indice) => new Date(radarInicio.getFullYear(), radarInicio.getMonth(), radarInicio.getDate() + indice)) : [];
  const totalesPorDia = diasRadar.map((dia) => ({ fecha: fechaIso(dia), dia, cantidad: radarFilas.filter((fila) => fila.fecha === fechaIso(dia)).reduce((total, fila) => total + fila.cantidad, 0) }));
  const zonasRadar = Array.from(new Map(radarFilas.filter((fila) => fila.zona_id).map((fila) => [fila.zona_id!, fila.zona])).entries()).map(([id, nombre]) => ({ id, nombre, cantidad: radarFilas.filter((fila) => fila.zona_id === id).reduce((total, fila) => total + fila.cantidad, 0) }));
  const zonasDestacadas = [...zonasRadar].filter((zona) => zona.cantidad > 0).sort((a, b) => b.cantidad - a.cantidad).slice(0, 5);
  const zonaSeleccionada = zonasRadar.find((zona) => zona.nombre.toLocaleLowerCase("es-AR") === zonaBuscada.trim().toLocaleLowerCase("es-AR"));
  const zonaDias = zonaSeleccionada ? diasRadar.map((dia) => ({ dia, fecha: fechaIso(dia), cantidad: radarFilas.find((fila) => fila.zona_id === zonaSeleccionada.id && fila.fecha === fechaIso(dia))?.cantidad ?? 0 })) : [];
  const maximoDia = Math.max(1, ...totalesPorDia.map((dia) => dia.cantidad));
  const maximoZona = Math.max(1, ...zonasDestacadas.map((zona) => zona.cantidad));

  return (
    <div className="panel calendar-panel">
      <div className="calendar-wrap">
        <div className="calendar-mobile-view">
          <div className="calendar-mobile-heading"><h2>{tituloMesMovil}</h2></div>
          <div className="calendar-mobile-controls">
            <div className="calendar-mobile-month-nav"><button type="button" aria-label="Mes anterior" onClick={() => setMesMovil(new Date(mesMovil.getFullYear(), mesMovil.getMonth() - 1, 1))}>‹</button><button type="button" aria-label="Mes siguiente" onClick={() => setMesMovil(new Date(mesMovil.getFullYear(), mesMovil.getMonth() + 1, 1))}>›</button><button type="button" onClick={() => setMesMovil(new Date(new Date().getFullYear(), new Date().getMonth(), 1))}>Hoy</button><button type="button" className="calendar-mobile-radar" onClick={() => void abrirRadar()}>Radar semanal</button><button type="button" className="calendar-mobile-new-notice" onClick={abrirFormulario}>Nuevo aviso</button></div>
          </div><div className="calendar-mobile-grid" role="grid" aria-label={`Calendario de ${tituloMesMovil}`}>
            {["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"].map((dia) => <div key={dia} className="calendar-mobile-weekday" role="columnheader">{dia}</div>)}
            {diasMovil.map((dia) => {
              const iso = fechaDeCelda(dia);
              const feriado = feriados.find((item) => item.fecha === iso);
              const tieneCoordinaciones = fechasConCoordinaciones.includes(iso);
              const clases = ["calendar-mobile-day", dia.getMonth() !== mesMovil.getMonth() ? "is-outside" : "", iso === hoyIso ? "is-today" : "", feriado?.esFeriado ? "is-holiday" : "", tieneCoordinaciones ? "has-coordinaciones" : ""].filter(Boolean).join(" ");
              const etiqueta = new Intl.DateTimeFormat("es-AR", { dateStyle: "full" }).format(dia);
              return <button key={iso} type="button" role="gridcell" className={clases} aria-label={`${etiqueta}${tieneCoordinaciones ? ", tiene coordinaciones" : ""}${feriado?.esFeriado ? ", feriado" : ""}`} aria-current={iso === hoyIso ? "date" : undefined} aria-disabled={soloCalendario || undefined} onClick={() => { if (!soloCalendario) router.push(`/coordinaciones/${iso}`); }}><span>{dia.getDate()}</span>{(tieneCoordinaciones || feriado?.esFeriado) && <i aria-hidden="true" />}</button>;
            })}
          </div>
        </div>
        <div className="calendar-desktop-view"><FullCalendar plugins={[dayGridPlugin, interactionPlugin]} initialView="dayGridMonth" locale={esLocale} firstDay={1} height="auto" expandRows headerToolbar={{ left: "prev,next today radarSemanal", center: "title", right: "nuevoAviso" }} titleFormat={(arg) => tituloDelMes(new Date(arg.date.year, arg.date.month, 1))} customButtons={{ nuevoAviso: { text: "Nuevo aviso", click: abrirFormulario }, radarSemanal: { text: "Radar semanal", click: () => void abrirRadar() } }} buttonText={{ today: "Hoy" }} dayCellContent={renderDayCell} dayCellClassNames={classesForDay} dayCellDidMount={contenidoAdicionalDeDia} dateClick={soloCalendario ? undefined : (info) => router.push("/coordinaciones/" + info.dateStr)} fixedWeekCount={false} /></div>
      </div>
      <div className="calendar-footer">
        <div className="calendar-note">{error ? `Error de conexión: ${error}` : ready ? "Datos guardados en Supabase." : "Cargando calendario…"}</div>
        <div className="calendar-legend" aria-label="Leyenda del calendario">
          <span><i className="calendar-legend-dot calendar-legend-holiday" />Feriados</span>
          <span><i className="calendar-legend-dot calendar-legend-coordinations" />Día con coordinaciones</span>
          <span><i className="calendar-legend-dot calendar-legend-empty" />Día sin coordinaciones</span>
          <span><i className="calendar-legend-dot calendar-legend-today" />Hoy</span>
        </div>
      </div>

      {radarAbierto && <div className="radar-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setRadarAbierto(false); }}><section className="radar-modal" role="dialog" aria-modal="true" aria-labelledby="radar-title"><header className="radar-heading"><div><p className="eyebrow">PLANIFICACIÓN SEMANAL</p><h2 id="radar-title">Radar semanal</h2><p className="radar-subtitle">Semana actual · {radarInicio ? etiquetaSemana(radarInicio) : ""}</p></div><button type="button" className="radar-close" aria-label="Cerrar radar" onClick={() => setRadarAbierto(false)}>×</button></header>
        {radarCargando ? <div className="radar-message" role="status">Actualizando datos de esta semana…</div> : radarError ? <div className="radar-message radar-error" role="alert">No se pudo cargar el radar. {radarError}</div> : <>
          <div className="radar-day-grid" aria-label="Coordinaciones de lunes a domingo">{totalesPorDia.map(({ fecha, dia, cantidad }) => <article className={`radar-day-card${fecha === hoyIso ? " is-today" : ""}`} key={fecha}><span>{new Intl.DateTimeFormat("es-AR", { weekday: "long" }).format(dia)}</span><strong>{cantidad}</strong><small>{cantidad === 1 ? "coordinación" : "coordinaciones"}</small></article>)}</div>
          <div className="radar-content-grid"><section className="radar-section"><h3>Zonas con más actividad</h3><p>Las cinco zonas con más coordinaciones en la semana.</p>{zonasDestacadas.length ? <ol className="radar-zone-list">{zonasDestacadas.map((zona) => <li key={zona.id}><span>{zona.nombre}</span><i><b style={{ width: `${Math.max(5, zona.cantidad / maximoZona * 100)}%` }} /></i><strong>{zona.cantidad}</strong></li>)}</ol> : <div className="radar-empty">Todavía no hay coordinaciones cargadas para esta semana.</div>}</section>
          <section className="radar-section"><h3>Buscar una zona</h3><p>Consultá la actividad de cualquier zona.</p><input className="radar-search" list="radar-zonas" value={zonaBuscada} onChange={(event) => setZonaBuscada(event.target.value)} placeholder="Escribí o elegí una zona" /><datalist id="radar-zonas">{zonasRadar.map((zona) => <option key={zona.id} value={zona.nombre} />)}</datalist>{zonaSeleccionada ? <div className="radar-zone-detail"><strong>{zonaSeleccionada.nombre}</strong><div>{zonaDias.map(({ fecha, dia, cantidad }) => <div key={fecha} className="radar-zone-day"><span>{new Intl.DateTimeFormat("es-AR", { weekday: "short" }).format(dia)}</span><i><b style={{ width: `${cantidad ? Math.max(5, cantidad / maximoDia * 100) : 0}%` }} /></i><strong>{cantidad}</strong></div>)}</div></div> : <div className="radar-hint">Elegí una zona para ver su actividad día por día.</div>}</section></div>
        </>}
      </section></div>}

      {avisoActual && <aside className="calendar-alert" key={avisoActual.id} role="status"><p>{avisoActual.texto}</p><div className="calendar-alert-controls">{avisos.length > 1 && <button type="button" aria-label="Aviso anterior" title="Aviso anterior" onClick={() => setIndiceAviso((actual) => (actual - 1 + avisos.length) % avisos.length)}>‹</button>}<span className="calendar-alert-counter">{indiceAviso + 1} de {avisos.length}</span>{avisos.length > 1 && <button type="button" aria-label="Aviso siguiente" title="Aviso siguiente" onClick={() => setIndiceAviso((actual) => (actual + 1) % avisos.length)}>›</button>}<button type="button" aria-label="Ocultar hasta volver a entrar al calendario" title="Ocultar hasta volver a entrar al calendario" onClick={() => quitarAvisoDeLaVista(avisoActual.id)}>−</button><button type="button" aria-label="Cerrar aviso hasta su fecha de vencimiento" title="Cerrar definitivamente hasta su vencimiento" disabled={cerrando === avisoActual.id} onClick={() => void ocultarDefinitivamente(avisoActual.id)}>×</button></div></aside>}

      {modal && <div className="notice-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setModal(false); }}><section className="notice-modal" role="dialog" aria-modal="true" aria-labelledby="notice-title"><div className="notice-modal-heading"><div><p>AVISOS DEL CALENDARIO</p><h2 id="notice-title">Nuevo aviso</h2></div><button type="button" aria-label="Cerrar" onClick={() => setModal(false)}>×</button></div><form onSubmit={crearAviso}>
        <label className="notice-field">Texto del aviso<textarea value={texto} onChange={(event) => setTexto(event.target.value)} maxLength={200} rows={3} required placeholder="Escribí el aviso para el equipo…" /><span>{texto.length}/200</span></label>
        <div className="notice-date-grid"><label className="notice-field">Disponible desde<input type="date" value={desde} onChange={(event) => setDesde(event.target.value)} required /></label><label className="notice-field">Disponible hasta<input type="date" min={desde} value={hasta} onChange={(event) => setHasta(event.target.value)} required /></label></div>
        <fieldset className="notice-recipients"><legend>Destinatarios</legend><div className="notice-recipient-picker" onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDestinatariosAbiertos(false); }}><button type="button" className="notice-recipient-trigger" aria-haspopup="listbox" aria-expanded={destinatariosAbiertos} onClick={() => setDestinatariosAbiertos((abierto) => !abierto)}><span>{destinatarioLabel}</span><span aria-hidden="true">▾</span></button>{destinatariosAbiertos && <div className="notice-recipient-menu" role="listbox" aria-label="Elegir destinatarios" aria-multiselectable="true"><button type="button" role="option" aria-selected={todoElEquipo} className={todoElEquipo ? "is-selected" : ""} onClick={() => { setTodoElEquipo(true); setDestinatarios([]); }}>Todo el equipo</button>{usuarios.map((usuario) => { const seleccionado = !todoElEquipo && destinatarios.includes(usuario.id); return <button type="button" role="option" aria-selected={seleccionado} className={seleccionado ? "is-selected" : ""} key={usuario.id} onClick={() => { setTodoElEquipo(false); setDestinatarios((actuales) => actuales.includes(usuario.id) ? actuales.filter((id) => id !== usuario.id) : [...actuales, usuario.id]); }}>{usuario.nombre}</button>; })}</div>}</div></fieldset>
        {errorAviso && <p className="notice-error" role="alert">{errorAviso}</p>}<div className="notice-modal-footer"><button type="button" className="button button-ghost" onClick={() => setModal(false)}>Cancelar</button><button type="submit" className="button button-primary" disabled={guardando || !texto.trim() || (!todoElEquipo && destinatarios.length === 0) || hasta < desde}>{guardando ? "Guardando…" : "Publicar aviso"}</button></div>
      </form></section></div>}
      {!modal && errorAviso && <div className="notice-load-error" role="alert">{errorAviso}</div>}
    </div>
  );
}
