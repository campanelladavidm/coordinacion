"use client";

import Link from "next/link";
import { useState, type DragEvent, type FormEvent } from "react";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeading } from "@/components/ui/page-heading";
import { nombreDe } from "@/lib/demo-data/catalogs";
import { normalizarUbicacionMaps } from "@/lib/maps/ubicacion";
import {
  useCoordinacionesDemo,
  type Coordinacion,
  type TipoCustodia,
} from "@/components/providers/demo-data-provider";

function porcentaje(cantidad: number, total: number) {
  return total === 0 ? 0 : Math.round((cantidad / total) * 100);
}

function normalizarBusqueda(valor: string) {
  return valor.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("es");
}

function DetalleCoordinacion({ coordinacion, fecha }: { coordinacion: Coordinacion; fecha: string }) {
  const { catalogos } = useCoordinacionesDemo();
  return (
    <div className="coordination-detail">
      <div><span>Cliente</span><strong>{coordinacion.cliente}</strong></div>
      <div><span>Categoría</span><strong>{nombreDe(catalogos.categorias, coordinacion.categoriaId)}</strong></div>
      <div><span>Horario</span><strong>{nombreDe(catalogos.horarios, coordinacion.horarioId)}</strong></div>
      <div><span>Estado</span><strong>{nombreDe(catalogos.estados, coordinacion.estadoId)}</strong></div>
      <div><span>Observaciones</span><strong>{coordinacion.observaciones || "Sin observaciones"}</strong></div>
      <div><span>Extras</span><strong>{coordinacion.extrasIds.length ? coordinacion.extrasIds.map((id) => nombreDe(catalogos.extras, id)).join(", ") : "Sin extras"}</strong></div>
      <div className="coordination-detail-actions"><Link className="button button-small" href={"/coordinaciones/" + fecha + "/editar/" + coordinacion.id}>Editar coordinación</Link></div>
    </div>
  );
}

function CustodiasDialog({ fecha, onClose }: { fecha: string; onClose: () => void }) {
  const { crearSolicitudCustodia, catalogos } = useCoordinacionesDemo();
  const [tipos, setTipos] = useState<TipoCustodia[]>([]);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");

  async function guardar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formulario = new FormData(event.currentTarget);
    const cuadrillaId = String(formulario.get("cuadrilla"));
    const horarioId = String(formulario.get("horario")).trim();
    if (!horarioId) return;
    setGuardando(true);
    setError("");
    try {
      for (const tipo of tipos) await crearSolicitudCustodia({ fecha, tipo, cuadrillaId, horarioId });
      onClose();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo guardar la solicitud.");
    } finally {
      setGuardando(false);
    }
  }

  function cambiarTipo(tipo: TipoCustodia, activo: boolean) {
    setTipos((actuales) => activo ? [...new Set([...actuales, tipo])] : actuales.filter((actual) => actual !== tipo));
  }

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="panel modal-card" role="dialog" aria-modal="true" aria-labelledby="custodias-title">
        <div className="modal-heading"><div><p className="eyebrow">Solicitud del día</p><h2 id="custodias-title" className="modal-title">Custodias - Policías</h2></div><button className="modal-close" type="button" aria-label="Cerrar" onClick={onClose}>×</button></div>
        <p className="page-description">Elegí una cuadrilla, el horario de retiro y uno o ambos tipos de solicitud.</p>
        <form onSubmit={guardar}>
          <label className="form-field">Cuadrilla *<select name="cuadrilla" required defaultValue=""><option value="">Seleccionar cuadrilla…</option>{catalogos.cuadrillas.map((cuadrilla) => <option key={cuadrilla.id} value={cuadrilla.id}>{catalogos.tercerizadas.find((empresa) => empresa.id === cuadrilla.tercerizadaId)?.nombre ?? "Sin tercerizada"} · {cuadrilla.nombre}</option>)}</select></label>
          <label className="form-field">Horario de retiro *<input name="horario" type="text" required placeholder="Escribí el horario de retiro" /></label>
          <fieldset className="extras-fieldset"><legend>Tipo de solicitud *</legend><div className="extras-options">
            <label className="extra-option"><input type="checkbox" checked={tipos.includes("CUSTODIA")} onChange={(event) => cambiarTipo("CUSTODIA", event.target.checked)} />Custodia</label>
            <label className="extra-option"><input type="checkbox" checked={tipos.includes("POLICIA")} onChange={(event) => cambiarTipo("POLICIA", event.target.checked)} />Policía</label>
          </div></fieldset>
          {error && <p role="alert" className="text-sm text-rose-300">{error}</p>}
          <div className="form-actions"><button className="button" type="button" onClick={onClose}>Cancelar</button><button className="button button-primary" type="submit" disabled={tipos.length === 0 || guardando}>{guardando ? "Guardando…" : "Guardar solicitud"}</button></div>
        </form>
      </section>
    </div>
  );
}

export function CoordinacionesDelDia({ fecha, tituloFecha }: { fecha: string; tituloFecha: string }) {
  const { coordinaciones, custodias, catalogos, ready, actualizarCoordinacion, reordenarCoordinaciones, eliminarSolicitudCustodia } = useCoordinacionesDemo();
  const nombreTercerizada = (id: string | null) => catalogos.tercerizadas.find((opcion) => opcion.id === id)?.nombre ?? "Sin tercerizada";
  const nombreCuadrilla = (id: string | null) => catalogos.cuadrillas.find((opcion) => opcion.id === id)?.nombre ?? "Sin cuadrilla asignada";
  const [abierta, setAbierta] = useState<string | null>(null);
  const [mostrarCustodias, setMostrarCustodias] = useState(false);
  const [busqueda, setBusqueda] = useState("");
  const [cuadrillaCopiada, setCuadrillaCopiada] = useState<string | null>(null);
  const [errorEstado, setErrorEstado] = useState("");
  const [errorCustodia, setErrorCustodia] = useState("");
  const [errorOrden, setErrorOrden] = useState("");
  const [errorMapa, setErrorMapa] = useState("");
  const [idArrastrado, setIdArrastrado] = useState<string | null>(null);
  const [guardandoOrden, setGuardandoOrden] = useState(false);
  const delDia = coordinaciones.filter((coordinacion) => coordinacion.fecha === fecha);
  const termino = normalizarBusqueda(busqueda.trim());
  const coordinacionesFiltradas = delDia.filter((coordinacion) => {
    if (!termino) return true;
    const campos = [
      coordinacion.ticket, coordinacion.cliente,
      nombreTercerizada(coordinacion.tercerizadaId), nombreCuadrilla(coordinacion.cuadrillaId),
      nombreDe(catalogos.horarios, coordinacion.horarioId), nombreDe(catalogos.tecnologias, coordinacion.tecnologiaId),
      nombreDe(catalogos.categorias, coordinacion.categoriaId), coordinacion.observaciones,
      nombreDe(catalogos.zonas, coordinacion.zona), nombreDe(catalogos.estados, coordinacion.estadoId), coordinacion.ubicacion,
      ...coordinacion.extrasIds.map((id) => nombreDe(catalogos.extras, id)),
    ];
    return campos.some((campo) => normalizarBusqueda(campo).includes(termino));
  });
  const solicitudesDelDia = custodias.filter((solicitud) => solicitud.fecha === fecha);
  const idConfirmado = catalogos.estados.find((opcion) => normalizarBusqueda(opcion.nombre) === "confirmado")?.id;
  const idFibra = catalogos.tecnologias.find((opcion) => normalizarBusqueda(opcion.nombre) === "fibra")?.id;
  const idWireless = catalogos.tecnologias.find((opcion) => normalizarBusqueda(opcion.nombre) === "wireless")?.id;
  const confirmadas = delDia.filter((coordinacion) => coordinacion.estadoId === idConfirmado).length;
  const fibra = delDia.filter((coordinacion) => coordinacion.tecnologiaId === idFibra).length;
  const wireless = delDia.filter((coordinacion) => coordinacion.tecnologiaId === idWireless).length;
  const metrics = [
    { label: "Total de coordinaciones", value: delDia.length },
    { label: "Confirmadas", value: confirmadas },
    { label: "Fibra", value: fibra },
    { label: "Wireless", value: wireless },
  ];

  function iniciarArrastre(event: DragEvent<HTMLElement>, id: string) {
    if (termino || guardandoOrden || !(event.target as HTMLElement).closest(".coordination-drag-handle")) {
      event.preventDefault();
      return;
    }
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", id);
    setIdArrastrado(id);
  }

  function soltarCoordinacion(event: DragEvent<HTMLElement>, objetivoId: string, items: Coordinacion[]) {
    event.preventDefault();
    const origenId = event.dataTransfer.getData("text/plain");
    const origen = items.findIndex((item) => item.id === origenId);
    const objetivo = items.findIndex((item) => item.id === objetivoId);
    if (origen < 0 || objetivo < 0 || origen === objetivo || guardandoOrden) return;
    const ordenadas = [...items];
    const [movida] = ordenadas.splice(origen, 1);
    ordenadas.splice(objetivo, 0, movida);
    setErrorOrden("");
    setGuardandoOrden(true);
    void reordenarCoordinaciones(ordenadas.map((item) => item.id))
      .catch((cause) => setErrorOrden(cause instanceof Error ? cause.message : "No se pudo guardar el orden de los casos."))
      .finally(() => setGuardandoOrden(false));
  }

  async function copiarTickets(tercerizadaId: string, cuadrillaId: string) {
    const tickets = delDia
      .filter((coordinacion) => (coordinacion.tercerizadaId ?? "sin-tercerizada") === tercerizadaId && (coordinacion.cuadrillaId ?? "sin-cuadrilla") === cuadrillaId)
      .sort((a, b) => a.orden - b.orden)
      .map((coordinacion) => coordinacion.ticket.trim())
      .filter(Boolean);
    try {
      await navigator.clipboard.writeText(tickets.join(","));
      setCuadrillaCopiada(cuadrillaId);
      window.setTimeout(() => setCuadrillaCopiada((actual) => actual === cuadrillaId ? null : actual), 1400);
    } catch {
      setCuadrillaCopiada(null);
    }
  }

  function abrirRecorrido(items: Coordinacion[]) {
    const ubicaciones = items.map((item) => normalizarUbicacionMaps(item.ubicacion)).filter((ubicacion): ubicacion is string => Boolean(ubicacion));
    if (ubicaciones.length < 2) {
      setErrorMapa("Cargá ubicaciones en al menos dos casos de esta cuadrilla para abrir el recorrido.");
      return;
    }
    const maxParadas = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent) ? 3 : 9;
    if (ubicaciones.length > maxParadas + 2) {
      setErrorMapa(`Google Maps admite hasta ${maxParadas} paradas intermedias en este dispositivo. Dividí esta cuadrilla en recorridos más cortos.`);
      return;
    }
    const url = new URL("https://www.google.com/maps/dir/");
    url.searchParams.set("api", "1");
    url.searchParams.set("origin", ubicaciones[0]);
    url.searchParams.set("destination", ubicaciones[ubicaciones.length - 1]);
    if (ubicaciones.length > 2) url.searchParams.set("waypoints", ubicaciones.slice(1, -1).join("|"));
    url.searchParams.set("travelmode", "driving");
    if (url.toString().length > 2048) {
      setErrorMapa("El enlace del recorrido es demasiado largo. Revisá las ubicaciones o dividí la cuadrilla en recorridos más cortos.");
      return;
    }
    setErrorMapa(ubicaciones.length < items.length ? `El recorrido incluirá ${ubicaciones.length} casos; ${items.length - ubicaciones.length} todavía no tienen una ubicación válida.` : "");
    window.open(url.toString(), "_blank", "noopener,noreferrer");
  }

  async function eliminarCustodia(id: string) {
    if (!window.confirm("¿Querés eliminar esta solicitud de custodia o policía?")) return;
    setErrorCustodia("");
    try {
      await eliminarSolicitudCustodia(id);
    } catch (cause) {
      setErrorCustodia(cause instanceof Error ? cause.message : "No se pudo eliminar la solicitud.");
    }
  }

  const grupos = new Map<string, Map<string, Coordinacion[]>>();
  for (const coordinacion of coordinacionesFiltradas) {
    const tercerizadaId = coordinacion.tercerizadaId ?? "sin-tercerizada";
    const cuadrillaId = coordinacion.cuadrillaId ?? "sin-cuadrilla";
    if (!grupos.has(tercerizadaId)) grupos.set(tercerizadaId, new Map());
    const cuadrillasDeTercerizada = grupos.get(tercerizadaId)!;
    if (!cuadrillasDeTercerizada.has(cuadrillaId)) cuadrillasDeTercerizada.set(cuadrillaId, []);
    cuadrillasDeTercerizada.get(cuadrillaId)!.push(coordinacion);
  }

  return (
    <section>
      <Link href="/" className="back-link">← Volver al calendario</Link>
      <PageHeading eyebrow="Coordinación diaria" title={tituloFecha} description="Coordinaciones organizadas por tercerizada y cuadrilla." />
      <div className="metric-grid">
        {metrics.map((metric) => <article key={metric.label} className="panel metric-card"><div className="metric-label">{metric.label}</div><div className="metric-value">{ready ? metric.value : "…"}</div><div className="metric-percent">{ready ? porcentaje(metric.value, delDia.length) + "% del total" : "Cargando"}</div></article>)}
      </div>
      <div className="button-row">
        <button className="button button-primary" type="button" onClick={() => setMostrarCustodias(true)}>Custodias - Policías</button>
        <Link className="button button-primary" href={"/coordinaciones/" + fecha + "/nueva"}>＋ Cargar coordinación nueva</Link>
      </div>
      {errorEstado && <p className="text-sm text-rose-300" role="alert">{errorEstado}</p>}
      {errorMapa && <p className="text-sm text-amber-200" role="status">{errorMapa}</p>}

      {errorCustodia && <p className="text-sm text-rose-300" role="alert">{errorCustodia}</p>}
      {solicitudesDelDia.length > 0 && <section className="custody-section"><div className="daily-section-heading"><h2 className="section-title">Custodias y policías</h2><span className="daily-count">{solicitudesDelDia.length} solicitudes</span></div><div className="custody-card-grid">{solicitudesDelDia.map((solicitud) => <article key={solicitud.id} className="panel custody-card">
        <button className="custody-delete-button" type="button" title="Eliminar solicitud" aria-label={`Eliminar solicitud de ${solicitud.tipo === "POLICIA" ? "policía" : "custodia"} para ${nombreCuadrilla(solicitud.cuadrillaId)}`} onClick={() => void eliminarCustodia(solicitud.id)}>
          <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M7 3.5h6M4.5 5.5h11m-9.5 0 .65 11h6.7l.65-11M8 8.5v5m4-5v5" /></svg>
        </button>
        <span className={"custody-type " + (solicitud.tipo === "POLICIA" ? "custody-police" : "")}>{solicitud.tipo === "POLICIA" ? "Policía" : "Custodia"}</span><div className="custody-card-info"><strong>{nombreCuadrilla(solicitud.cuadrillaId)}</strong>{solicitud.horarioId && <span className="custody-card-time">Retiro: {solicitud.horarioId}</span>}</div>
      </article>)}</div></section>}

      <div className="daily-section-heading"><h2 className="section-title">Coordinaciones del día</h2><span className="daily-count">{coordinacionesFiltradas.length} de {delDia.length} {delDia.length === 1 ? "coordinación" : "coordinaciones"}</span></div>
      <div className="daily-search" role="search"><input type="search" aria-label="Buscar coordinaciones por cualquiera de sus datos" value={busqueda} onChange={(event) => setBusqueda(event.target.value)} placeholder="Buscar coordinaciones..." />{busqueda && <button type="button" onClick={() => setBusqueda("")} aria-label="Limpiar búsqueda">×</button>}</div>
      {delDia.length > 1 && <p className="reorder-hint">Arrastrá los casos desde el ícono de puntos para cambiar el orden dentro de la cuadrilla.{termino ? " Limpiá la búsqueda para reordenarlos." : guardandoOrden ? " Guardando orden…" : ""}</p>}
      {errorOrden && <p className="text-sm text-rose-300" role="alert">{errorOrden}</p>}
      {!ready ? <EmptyState title="Cargando coordinaciones" description="Un momento, estamos preparando los datos de demostración." /> : delDia.length === 0 ? <EmptyState title="No hay coordinaciones para este día" description="Podés cargar una coordinación nueva con el botón de arriba." icon="＋" /> : coordinacionesFiltradas.length === 0 ? <EmptyState title="No encontramos coincidencias" description="Probá con otro ticket, cliente, cuadrilla u otro dato de la coordinación." /> : (
        <div className="daily-groups">
          {[...grupos.entries()].map(([tercerizadaId, cuadrillasDeTercerizada]) => (
            <section key={tercerizadaId} className="panel company-group">
              <h3 className="company-heading">{nombreTercerizada(tercerizadaId === "sin-tercerizada" ? null : tercerizadaId)}<span>{[...cuadrillasDeTercerizada.values()].reduce((suma, items) => suma + items.length, 0)}</span></h3>
              {[...cuadrillasDeTercerizada.entries()].map(([cuadrillaId, items]) => {
                const itemsOrdenados = [...items].sort((a, b) => a.orden - b.orden);
                return <div key={cuadrillaId} className="crew-group">
                  <h4 className="crew-heading">
                    <div className="crew-name-copy">
                      <strong>{nombreCuadrilla(cuadrillaId === "sin-cuadrilla" ? null : cuadrillaId)}</strong>
                      <button className="copy-tickets-button" type="button" onClick={() => void copiarTickets(tercerizadaId, cuadrillaId)} aria-label={cuadrillaCopiada === cuadrillaId ? "Tickets copiados" : "Copiar tickets de esta cuadrilla"} title={cuadrillaCopiada === cuadrillaId ? "Tickets copiados" : "Copiar todos los tickets de esta cuadrilla para el día"}>
                        {cuadrillaCopiada === cuadrillaId ? <svg viewBox="0 0 20 20" aria-hidden="true"><path d="m4 10 4 4 8-8" /></svg> : <svg viewBox="0 0 20 20" aria-hidden="true"><rect x="6.5" y="6.5" width="9" height="11" rx="1.5" /><path d="M13 6V4.5A1.5 1.5 0 0 0 11.5 3h-7A1.5 1.5 0 0 0 3 4.5v9A1.5 1.5 0 0 0 4.5 15H6" /></svg>}
                      </button>
                      <button className="copy-tickets-button map-route-button" type="button" onClick={() => abrirRecorrido(itemsOrdenados)} aria-label={`Abrir recorrido en Google Maps para ${nombreCuadrilla(cuadrillaId === "sin-cuadrilla" ? null : cuadrillaId)}`} title="Abrir recorrido ordenado en Google Maps">
                        <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M16 8.2c0 4.4-6 9-6 9s-6-4.6-6-9a6 6 0 1 1 12 0Z" /><circle cx="10" cy="8" r="2" /></svg>
                      </button>
                    </div>
                    <span className="crew-heading-meta">
                      {Array.from(new Set(items.flatMap((item) => item.extrasIds))).map((extraId) => <span key={extraId} className="crew-extra-indicator">{nombreDe(catalogos.extras, extraId)}</span>)}
                      <span className="crew-count">{items.length}</span>
                    </span>
                  </h4>
                  <div className="coordination-list">
                    {itemsOrdenados.map((coordinacion) => (
                      <article key={coordinacion.id} className={`coordination-item${idArrastrado === coordinacion.id ? " is-dragging" : ""}`} onDragStart={(event) => iniciarArrastre(event, coordinacion.id)} onDragOver={(event) => { event.preventDefault(); event.dataTransfer.dropEffect = "move"; }} onDrop={(event) => soltarCoordinacion(event, coordinacion.id, itemsOrdenados)} onDragEnd={() => setIdArrastrado(null)}>
                        <button type="button" className="coordination-summary" aria-expanded={abierta === coordinacion.id} onClick={() => setAbierta(abierta === coordinacion.id ? null : coordinacion.id)} onDoubleClick={(event) => {
                          if (!(event.target as HTMLElement).closest(".state-badge")) return;
                          event.preventDefault();
                          event.stopPropagation();
                          setErrorEstado("");
                          if (coordinacion.estadoId !== idConfirmado) {
                            if (!idConfirmado) {
                              setErrorEstado("No se encontro el estado Confirmado en Configuraciones.");
                              return;
                            }
                            void actualizarCoordinacion(coordinacion.id, { ...coordinacion, estadoId: idConfirmado }).catch((cause) => {
                              setErrorEstado(cause instanceof Error ? `No se pudo confirmar: ${cause.message}` : "No se pudo confirmar la coordinacion.");
                            });
                          }
                        }}>
                          <span className="coordination-ticket-cell"><span className="coordination-drag-handle" draggable={!termino && !guardandoOrden} title="Arrastrá para reordenar" aria-label="Arrastrar para reordenar">⠿</span><span className="coordination-ticket">{coordinacion.ticket}</span></span>
                          <span className="coordination-meta"><span>{nombreDe(catalogos.tecnologias, coordinacion.tecnologiaId)}</span><span>{coordinacion.zona ? nombreDe(catalogos.zonas, coordinacion.zona) : "Zona sin asignar"}</span></span>
                          <span className={"state-badge state-" + normalizarBusqueda(nombreDe(catalogos.estados, coordinacion.estadoId)).replace(/\s+/g, "-")} title="Doble clic para marcar como confirmado">{nombreDe(catalogos.estados, coordinacion.estadoId)}</span>
                          <span className="expand-chevron">{abierta === coordinacion.id ? "⌃" : "⌄"}</span>
                        </button>
                        {abierta === coordinacion.id && <DetalleCoordinacion coordinacion={coordinacion} fecha={fecha} />}
                      </article>
                    ))}
                  </div>
                </div>
              })}
            </section>
          ))}
        </div>
      )}
      {mostrarCustodias && <CustodiasDialog fecha={fecha} onClose={() => setMostrarCustodias(false)} />} 
    </section>
  );
}

