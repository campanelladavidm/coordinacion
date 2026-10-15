"use client";

import Link from "next/link";
import { useState, type DragEvent, type FormEvent } from "react";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeading } from "@/components/ui/page-heading";
import { NuevaCoordinacionDialog } from "@/components/coordinaciones/nueva-coordinacion-dialog";
import type { NuevaCoordinacionDefaults } from "@/components/coordinaciones/nueva-coordinacion-form";
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

function claseAvanceRango(casos: number, pedidos: number) {
  if (pedidos === 0) return casos === 0 ? "state-rango-verde" : "state-rango-rojo";
  const proporcion = casos / pedidos;
  if (proporcion < 0.5) return "state-rango-rojo";
  if (proporcion < 0.75) return "state-rango-amarillo";
  return "state-rango-verde";
}

function normalizarBusqueda(valor: string) {
  return valor.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("es");
}

function DetalleCoordinacion({ coordinacion, onEditar }: { coordinacion: Coordinacion; onEditar: () => void }) {
  const { catalogos } = useCoordinacionesDemo();
  return (
    <div className="coordination-detail">
      <div><span>Cliente</span><strong>{coordinacion.cliente}</strong></div>
      <div><span>Categoría</span><strong>{nombreDe(catalogos.categorias, coordinacion.categoriaId)}</strong></div>
      <div><span>Horario</span><strong>{nombreDe(catalogos.horarios, coordinacion.horarioId)}</strong></div>
      <div><span>Estado</span><strong>{nombreDe(catalogos.estados, coordinacion.estadoId)}</strong></div>
      <div><span>Observaciones</span><strong>{coordinacion.observaciones || "Sin observaciones"}</strong></div>
      <div><span>Extras</span><strong>{coordinacion.extrasIds.length ? coordinacion.extrasIds.map((id) => nombreDe(catalogos.extras, id)).join(", ") : "Sin extras"}</strong></div>
      <div className="coordination-detail-actions"><button className="button button-small" type="button" onClick={onEditar}>Editar coordinación</button></div>
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
          <label className="form-field">Cuadrilla *<select name="cuadrilla" required defaultValue=""><option value="">Seleccionar cuadrilla…</option>{catalogos.cuadrillas.filter((cuadrilla) => cuadrilla.activo !== false).map((cuadrilla) => <option key={cuadrilla.id} value={cuadrilla.id}>{catalogos.tercerizadas.find((empresa) => empresa.id === cuadrilla.tercerizadaId)?.nombre ?? "Sin tercerizada"} · {cuadrilla.nombre}</option>)}</select></label>
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

type RangoFormRow = { cuadrillaId: string; cantidadTickets: number | null; noTrabaja: boolean };

function RangoDialog({ fecha, onClose }: { fecha: string; onClose: () => void }) {
  const { catalogos, rangos, errorRangos, guardarRangos } = useCoordinacionesDemo();
  const cuadrillasActivas = catalogos.cuadrillas.filter((cuadrilla) => cuadrilla.activo !== false);
  const [filas, setFilas] = useState<RangoFormRow[]>(() => cuadrillasActivas.map((cuadrilla) => {
    const existente = rangos.find((rango) => rango.fecha === fecha && rango.cuadrillaId === cuadrilla.id);
    return {
      cuadrillaId: cuadrilla.id,
      cantidadTickets: existente?.cantidadTickets ?? null,
      noTrabaja: existente?.noTrabaja ?? false,
    };
  }));
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");

  function actualizarFila(cuadrillaId: string, cambios: Partial<RangoFormRow>) {
    setFilas((actuales) => actuales.map((fila) => fila.cuadrillaId === cuadrillaId ? { ...fila, ...cambios } : fila));
  }

  async function guardar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (errorRangos) return;
    if (filas.length === 0) {
      setError("No hay cuadrillas activas para cargar.");
      return;
    }
    if (filas.some((fila) => !fila.noTrabaja && fila.cantidadTickets !== null && (!Number.isInteger(fila.cantidadTickets) || fila.cantidadTickets < 0))) {
      setError("La cantidad debe ser un número entero igual o mayor que cero.");
      return;
    }
    setGuardando(true);
    setError("");
    try {
      await guardarRangos(fecha, filas);
      onClose();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo guardar el rango.");
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="modal-backdrop rango-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="panel modal-card rango-modal-card" role="dialog" aria-modal="true" aria-labelledby="rango-title">
        <div className="modal-heading"><div><p className="eyebrow">Planificación del día</p><h2 id="rango-title" className="modal-title">Rango de cuadrillas</h2></div><button className="modal-close" type="button" aria-label="Cerrar" onClick={onClose}>×</button></div>
        <p className="page-description">Ingresá la cantidad de tickets de cada cuadrilla. Si no trabaja, marcá esa opción.</p>
        {errorRangos && <p role="alert" className="rango-error">{errorRangos}</p>}
        <form onSubmit={guardar}>
          {filas.length === 0 ? <p className="rango-empty">No hay cuadrillas activas para cargar.</p> : <div className="rango-list">
            {filas.map((fila) => {
              const cuadrilla = catalogos.cuadrillas.find((item) => item.id === fila.cuadrillaId);
              return <div className="rango-row" key={fila.cuadrillaId}>
                <span className="rango-crew-name"><small>{catalogos.tercerizadas.find((empresa) => empresa.id === cuadrilla?.tercerizadaId)?.nombre ?? "Sin tercerizada"}</small><strong>{cuadrilla?.nombre ?? "Cuadrilla"}</strong></span>
                <label className="rango-count-field">Tickets<input type="number" min="0" step="1" value={fila.noTrabaja ? "" : fila.cantidadTickets ?? ""} disabled={fila.noTrabaja || Boolean(errorRangos)} onChange={(event) => actualizarFila(fila.cuadrillaId, { cantidadTickets: event.target.value === "" ? null : Number(event.target.value) })} aria-label={`Cantidad de tickets para ${cuadrilla?.nombre ?? "cuadrilla"}`} /></label>
                <label className="rango-no-trabaja"><input type="checkbox" checked={fila.noTrabaja} disabled={Boolean(errorRangos)} onChange={(event) => actualizarFila(fila.cuadrillaId, { noTrabaja: event.target.checked, cantidadTickets: event.target.checked ? null : fila.cantidadTickets })} />No trabaja</label>
              </div>;
            })}
          </div>}
          {error && <p role="alert" className="rango-error">{error}</p>}
          <div className="form-actions"><button className="button" type="button" onClick={onClose}>Cancelar</button><button className="button button-primary" type="submit" disabled={guardando || Boolean(errorRangos) || filas.length === 0}>{guardando ? "Guardando…" : "Guardar rango"}</button></div>
        </form>
      </section>
    </div>
  );
}

export function CoordinacionesDelDia({ fecha, tituloFecha }: { fecha: string; tituloFecha: string }) {
  const { coordinaciones, custodias, rangos, catalogos, ready, actualizarCoordinacion, asignarCoordinaciones, moverCoordinacion, eliminarCoordinacion, reordenarCoordinaciones, eliminarSolicitudCustodia } = useCoordinacionesDemo();
  const nombreTercerizada = (id: string | null) => catalogos.tercerizadas.find((opcion) => opcion.id === id)?.nombre ?? "Sin tercerizada";
  const nombreCuadrilla = (id: string | null) => catalogos.cuadrillas.find((opcion) => opcion.id === id)?.nombre ?? "Sin cuadrilla asignada";
  const [abierta, setAbierta] = useState<string | null>(null);
  const [mostrarCustodias, setMostrarCustodias] = useState(false);
  const [mostrarRango, setMostrarRango] = useState(false);
  const [mostrarNuevaCoordinacion, setMostrarNuevaCoordinacion] = useState(false);
  const [seleccionMasiva, setSeleccionMasiva] = useState<{ fecha: string; ids: string[] }>({ fecha, ids: [] });
  const [cuadrillaDestinoId, setCuadrillaDestinoId] = useState("");
  const [guardandoAsignacion, setGuardandoAsignacion] = useState(false);
  const [errorAsignacion, setErrorAsignacion] = useState("");
  const [avisoAsignacion, setAvisoAsignacion] = useState("");
  const [coordinacionEditandoModal, setCoordinacionEditandoModal] = useState<string | null>(null);
  const [valoresNuevaCoordinacion, setValoresNuevaCoordinacion] = useState<NuevaCoordinacionDefaults | undefined>(undefined);
  const [busqueda, setBusqueda] = useState("");
  const [cuadrillaCopiada, setCuadrillaCopiada] = useState<string | null>(null);
  const [seleccionCopiada, setSeleccionCopiada] = useState(false);
  const [errorEstado, setErrorEstado] = useState("");
  const [errorCustodia, setErrorCustodia] = useState("");
  const [errorCoordinacion, setErrorCoordinacion] = useState("");
  const [eliminandoCoordinacion, setEliminandoCoordinacion] = useState<string | null>(null);
  const [errorOrden, setErrorOrden] = useState("");
  const [errorMapa, setErrorMapa] = useState("");
  const [idArrastrado, setIdArrastrado] = useState<string | null>(null);
  const [guardandoOrden, setGuardandoOrden] = useState(false);
  const delDia = coordinaciones.filter((coordinacion) => coordinacion.fecha === fecha);
  const idsSeleccionados = seleccionMasiva.fecha === fecha ? seleccionMasiva.ids : [];
  const casosSeleccionados = delDia.filter((coordinacion) => idsSeleccionados.includes(coordinacion.id) && coordinacion.cuadrillaId === null);
  const cuadrillasActivas = catalogos.cuadrillas.filter((cuadrilla) => cuadrilla.activo !== false);
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

  function soltarEnCuadrilla(event: DragEvent<HTMLElement>, tercerizadaId: string, cuadrillaId: string, items: Coordinacion[]) {
    event.preventDefault();
    event.stopPropagation();
    const origenId = event.dataTransfer.getData("text/plain");
    const coordinacion = delDia.find((item) => item.id === origenId);
    setIdArrastrado(null);
    if (!coordinacion || guardandoOrden) return;
    const tercerizadaOrigen = coordinacion.tercerizadaId ?? "sin-tercerizada";
    const cuadrillaOrigen = coordinacion.cuadrillaId ?? "sin-cuadrilla";
    const mismaCuadrilla = tercerizadaOrigen === tercerizadaId && cuadrillaOrigen === cuadrillaId;
    setGuardandoOrden(true);
    if (mismaCuadrilla) {
      const origen = items.findIndex((item) => item.id === origenId);
      const objetivoId = (event.target as HTMLElement).closest<HTMLElement>("[data-coordinacion-id]")?.dataset.coordinacionId;
      const objetivo = objetivoId ? items.findIndex((item) => item.id === objetivoId) : items.length;
      if (origen < 0 || objetivo < 0 || origen === objetivo) {
        setGuardandoOrden(false);
        return;
      }
      const ordenadas = [...items];
      const [movida] = ordenadas.splice(origen, 1);
      ordenadas.splice(objetivo, 0, movida);
      setErrorOrden("");
      setErrorCoordinacion("");
      void reordenarCoordinaciones(ordenadas.map((item) => item.id))
        .catch((cause) => setErrorOrden(cause instanceof Error ? cause.message : "No se pudo guardar el orden de los casos."))
        .finally(() => setGuardandoOrden(false));
      return;
    }

    setErrorOrden("");
    setErrorCoordinacion("");
    void moverCoordinacion(origenId, tercerizadaId === "sin-tercerizada" ? null : tercerizadaId, cuadrillaId === "sin-cuadrilla" ? null : cuadrillaId)
      .catch((cause) => setErrorCoordinacion(cause instanceof Error ? `No se pudo mover el caso: ${cause.message}` : "No se pudo mover el caso a esa cuadrilla."))
      .finally(() => setGuardandoOrden(false));
  }

  function cambiarSeleccionMasiva(id: string, seleccionado: boolean) {
    setErrorAsignacion("");
    setAvisoAsignacion("");
    const actuales = casosSeleccionados.map((caso) => caso.id);
    const siguientes = seleccionado
      ? (actuales.includes(id) ? actuales : [...actuales, id])
      : actuales.filter((actual) => actual !== id);
    setSeleccionMasiva({ fecha, ids: siguientes });
    if (siguientes.length === 0) setCuadrillaDestinoId("");
  }

  function limpiarSeleccionMasiva() {
    setSeleccionMasiva({ fecha, ids: [] });
    setCuadrillaDestinoId("");
    setErrorAsignacion("");
    setAvisoAsignacion("");
  }

  async function asignarSeleccionMasiva() {
    if (casosSeleccionados.length === 0) {
      setErrorAsignacion("Seleccioná al menos un caso sin cuadrilla.");
      return;
    }
    if (!cuadrillaDestinoId) {
      setErrorAsignacion("Elegí la cuadrilla de destino.");
      return;
    }
    const cuadrillaDestino = cuadrillasActivas.find((cuadrilla) => cuadrilla.id === cuadrillaDestinoId);
    if (!cuadrillaDestino) {
      setErrorAsignacion("La cuadrilla elegida ya no está disponible.");
      return;
    }

    setGuardandoAsignacion(true);
    setErrorAsignacion("");
    setAvisoAsignacion("");
    try {
      const cantidad = casosSeleccionados.length;
      await asignarCoordinaciones(casosSeleccionados.map((caso) => caso.id), cuadrillaDestino.id);
      limpiarSeleccionMasiva();
      setAvisoAsignacion(`${cantidad} ${cantidad === 1 ? "caso asignado" : "casos asignados"} a ${cuadrillaDestino.nombre}.`);
    } catch (cause) {
      setErrorAsignacion(cause instanceof Error ? cause.message : "No se pudieron asignar los casos.");
    } finally {
      setGuardandoAsignacion(false);
    }
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

  async function copiarTicketsSeleccionados() {
    const tickets = casosSeleccionados
      .map((coordinacion) => coordinacion.ticket.trim())
      .filter(Boolean);
    if (tickets.length === 0) return;

    try {
      await navigator.clipboard.writeText(tickets.join(","));
      setSeleccionCopiada(true);
      window.setTimeout(() => setSeleccionCopiada(false), 1400);
    } catch {
      setSeleccionCopiada(false);
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

  async function eliminarCaso(coordinacion: Coordinacion) {
    if (!window.confirm(`¿Querés eliminar la coordinación ${coordinacion.ticket}? Esta acción no se puede deshacer.`)) return;
    setErrorCoordinacion("");
    setEliminandoCoordinacion(coordinacion.id);
    try {
      await eliminarCoordinacion(coordinacion.id);
    } catch (cause) {
      setErrorCoordinacion(cause instanceof Error ? cause.message : "No se pudo eliminar la coordinación.");
    } finally {
      setEliminandoCoordinacion(null);
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
  const rangosPlanificadosDelDia = rangos.filter((rango) => rango.fecha === fecha && !rango.noTrabaja && rango.cantidadTickets !== null);
  for (const cuadrilla of catalogos.cuadrillas) {
    if (!rangosPlanificadosDelDia.some((rango) => rango.cuadrillaId === cuadrilla.id)) continue;
    const tercerizadaId = cuadrilla.tercerizadaId || "sin-tercerizada";
    if (!grupos.has(tercerizadaId)) grupos.set(tercerizadaId, new Map());
    const cuadrillasDeTercerizada = grupos.get(tercerizadaId)!;
    if (!cuadrillasDeTercerizada.has(cuadrilla.id)) cuadrillasDeTercerizada.set(cuadrilla.id, []);
  }
  const tercerizadaDelPrimerGrupoSinCuadrilla = [...grupos.entries()].find(([, cuadrillas]) => cuadrillas.has("sin-cuadrilla"))?.[0];
  const barraAsignacionMasiva = casosSeleccionados.length > 0 ? <div className="bulk-assignment-toolbar">
    <strong className="bulk-assignment-count">{casosSeleccionados.length} {casosSeleccionados.length === 1 ? "caso seleccionado" : "casos seleccionados"}</strong>
    <label className="bulk-assignment-select">Asignar a:
      <select value={cuadrillaDestinoId} onChange={(event) => { setCuadrillaDestinoId(event.target.value); setErrorAsignacion(""); }} disabled={guardandoAsignacion}>
        <option value="">Elegí una cuadrilla</option>
        {cuadrillasActivas.map((cuadrilla) => <option key={cuadrilla.id} value={cuadrilla.id}>
          {catalogos.tercerizadas.find((tercerizada) => tercerizada.id === cuadrilla.tercerizadaId)?.nombre ?? "Sin tercerizada"} · {cuadrilla.nombre}
        </option>)}
      </select>
    </label>
    <button className="button button-primary bulk-assignment-submit" type="button" disabled={guardandoAsignacion || !cuadrillaDestinoId} onClick={() => void asignarSeleccionMasiva()}>{guardandoAsignacion ? "Asignando…" : "Asignar casos"}</button>
    <button className="button bulk-assignment-clear" type="button" disabled={guardandoAsignacion} onClick={limpiarSeleccionMasiva}>Limpiar selección</button>
    <button className="button bulk-assignment-copy" type="button" disabled={guardandoAsignacion} onClick={() => void copiarTicketsSeleccionados()}>{seleccionCopiada ? "¡Copiados!" : "Copiar seleccionados"}</button>
  </div> : null;

  return (
    <section>
      <Link href="/" className="back-link">← Volver al calendario</Link>
      <PageHeading eyebrow="Coordinación diaria" title={tituloFecha} description="Coordinaciones organizadas por tercerizada y cuadrilla." />
      <div className="metric-grid">
        {metrics.map((metric) => <article key={metric.label} className="panel metric-card"><div className="metric-label">{metric.label}</div><div className="metric-value">{ready ? metric.value : "…"}</div><div className="metric-percent">{ready ? porcentaje(metric.value, delDia.length) + "% del total" : "Cargando"}</div></article>)}
      </div>
      <div className="button-row">
        <button className="button button-primary" type="button" disabled={!ready} onClick={() => setMostrarRango(true)}>Rango</button>
        <button className="button button-primary" type="button" onClick={() => setMostrarCustodias(true)}>Custodias - Policías</button>
        <button className="button button-primary button-create-coordination" type="button" onClick={() => setMostrarNuevaCoordinacion(true)}>＋ Cargar coordinación nueva</button>
      </div>
      {errorEstado && <p className="text-sm text-rose-300" role="alert">{errorEstado}</p>}
      {errorMapa && <p className="text-sm text-amber-200" role="status">{errorMapa}</p>}

      {errorCustodia && <p className="text-sm text-rose-300" role="alert">{errorCustodia}</p>}
      {errorCoordinacion && <p className="text-sm text-rose-300" role="alert">{errorCoordinacion}</p>}
      {solicitudesDelDia.length > 0 && <section className="custody-section"><div className="daily-section-heading"><h2 className="section-title">Custodias y policías</h2><span className="daily-count">{solicitudesDelDia.length} solicitudes</span></div><div className="custody-card-grid">{solicitudesDelDia.map((solicitud) => <article key={solicitud.id} className="panel custody-card">
        <button className="custody-delete-button" type="button" title="Eliminar solicitud" aria-label={`Eliminar solicitud de ${solicitud.tipo === "POLICIA" ? "policía" : "custodia"} para ${nombreCuadrilla(solicitud.cuadrillaId)}`} onClick={() => void eliminarCustodia(solicitud.id)}>
          <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M7 3.5h6M4.5 5.5h11m-9.5 0 .65 11h6.7l.65-11M8 8.5v5m4-5v5" /></svg>
        </button>
        <span className={"custody-type " + (solicitud.tipo === "POLICIA" ? "custody-police" : "")}>{solicitud.tipo === "POLICIA" ? "Policía" : "Custodia"}</span><div className="custody-card-info"><strong>{nombreCuadrilla(solicitud.cuadrillaId)}</strong>{solicitud.horarioId && <span className="custody-card-time">Retiro: {solicitud.horarioId}</span>}</div>
      </article>)}</div></section>}

      <div className="daily-section-heading"><h2 className="section-title">Coordinaciones del día</h2><span className="daily-count">{coordinacionesFiltradas.length} de {delDia.length} {delDia.length === 1 ? "coordinación" : "coordinaciones"}</span></div>
      <div className="daily-search" role="search"><input type="search" aria-label="Buscar coordinaciones por cualquiera de sus datos" value={busqueda} onChange={(event) => setBusqueda(event.target.value)} placeholder="Buscar coordinaciones..." />{busqueda && <button type="button" onClick={() => setBusqueda("")} aria-label="Limpiar búsqueda">×</button>}</div>
      {delDia.length > 0 && <p className="reorder-hint">Arrastrá un caso desde el ícono de puntos para reordenarlo o moverlo a otra cuadrilla.{termino ? " Limpiá la búsqueda para habilitar el arrastre." : guardandoOrden ? " Guardando cambio…" : ""}</p>}
      {errorOrden && <p className="text-sm text-rose-300" role="alert">{errorOrden}</p>}
      {errorAsignacion && <p className="bulk-assignment-message bulk-assignment-error" role="alert">{errorAsignacion}</p>}
      {avisoAsignacion && <p className="bulk-assignment-message bulk-assignment-success" role="status">{avisoAsignacion}</p>}
      {casosSeleccionados.length > 0 && tercerizadaDelPrimerGrupoSinCuadrilla === undefined && barraAsignacionMasiva}
      {!ready ? <EmptyState title="Cargando coordinaciones" description="Un momento, estamos preparando los datos de demostración." /> : coordinacionesFiltradas.length === 0 && delDia.length > 0 ? <EmptyState title="No encontramos coincidencias" description="Probá con otro ticket, cliente, cuadrilla u otro dato de la coordinación." /> : delDia.length === 0 && rangosPlanificadosDelDia.length === 0 ? <EmptyState title="No hay coordinaciones para este día" description="Podés cargar una coordinación nueva con el botón de arriba." icon="＋" onIconClick={() => setMostrarNuevaCoordinacion(true)} iconActionLabel="Cargar coordinación nueva" /> : (
        <div className="daily-groups">
          {[...grupos.entries()].map(([tercerizadaId, cuadrillasDeTercerizada]) => (
            <section key={tercerizadaId} className="panel company-group">
              <h3 className="company-heading">{nombreTercerizada(tercerizadaId === "sin-tercerizada" ? null : tercerizadaId)}<span>{[...cuadrillasDeTercerizada.values()].reduce((suma, items) => suma + items.length, 0)}</span></h3>
              {[...cuadrillasDeTercerizada.entries()].map(([cuadrillaId, items]) => {
                const itemsOrdenados = [...items].sort((a, b) => a.orden - b.orden);
                const cuadrillaRealId = cuadrillaId === "sin-cuadrilla" ? null : cuadrillaId;
                const casosCoordinados = delDia.filter((item) => item.cuadrillaId === cuadrillaRealId && (item.tercerizadaId ?? "sin-tercerizada") === tercerizadaId).length;
                const rango = rangos.find((item) => item.fecha === fecha && item.cuadrillaId === cuadrillaId);
                const pedidosEsperados = rango ? (rango.noTrabaja ? 0 : rango.cantidadTickets) : null;
                const revisarRango = pedidosEsperados === 0 && casosCoordinados > 0;
                const estadoAvanceRango = pedidosEsperados !== null ? claseAvanceRango(casosCoordinados, pedidosEsperados) : "";
                const coloresAvanceRango = revisarRango
                  ? { borderColor: "#ff5263", backgroundColor: "#591d27", color: "#ffd9de" }
                  : estadoAvanceRango === "state-rango-rojo"
                  ? { borderColor: "#704148", backgroundColor: "#3e272d", color: "#e9b4bb" }
                  : estadoAvanceRango === "state-rango-amarillo"
                    ? { borderColor: "#75572e", backgroundColor: "#3a2d1e", color: "#e8c98f" }
                    : { borderColor: "#246c60", backgroundColor: "#123e3a", color: "#a9ead4" };
                return <div key={cuadrillaId} className="crew-group" onDragOver={(event) => { event.preventDefault(); event.dataTransfer.dropEffect = guardandoOrden ? "none" : "move"; }} onDrop={(event) => soltarEnCuadrilla(event, tercerizadaId, cuadrillaId, itemsOrdenados)}>
                  <h4 className="crew-heading">
                    <div className="crew-name-copy">
                      <strong>{nombreCuadrilla(cuadrillaId === "sin-cuadrilla" ? null : cuadrillaId)}</strong>
                      {items.length > 0 && <>
                        <button className="copy-tickets-button" type="button" onClick={() => void copiarTickets(tercerizadaId, cuadrillaId)} aria-label={cuadrillaCopiada === cuadrillaId ? "Tickets copiados" : "Copiar tickets de esta cuadrilla"} title={cuadrillaCopiada === cuadrillaId ? "Tickets copiados" : "Copiar todos los tickets de esta cuadrilla para el día"}>
                          {cuadrillaCopiada === cuadrillaId ? <svg viewBox="0 0 20 20" aria-hidden="true"><path d="m4 10 4 4 8-8" /></svg> : <svg viewBox="0 0 20 20" aria-hidden="true"><rect x="6.5" y="6.5" width="9" height="11" rx="1.5" /><path d="M13 6V4.5A1.5 1.5 0 0 0 11.5 3h-7A1.5 1.5 0 0 0 3 4.5v9A1.5 1.5 0 0 0 4.5 15H6" /></svg>}
                        </button>
                        <button className="copy-tickets-button map-route-button" type="button" onClick={() => abrirRecorrido(itemsOrdenados)} aria-label={`Abrir recorrido en Google Maps para ${nombreCuadrilla(cuadrillaId === "sin-cuadrilla" ? null : cuadrillaId)}`} title="Abrir recorrido ordenado en Google Maps">
                          <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M16 8.2c0 4.4-6 9-6 9s-6-4.6-6-9a6 6 0 1 1 12 0Z" /><circle cx="10" cy="8" r="2" /></svg>
                        </button>
                      </>}
                      {pedidosEsperados !== null && <span className={`state-badge rango-progress-badge ${estadoAvanceRango}${revisarRango ? " state-rango-revisar" : ""}`} style={coloresAvanceRango}>{revisarRango ? "Revisar rango" : `${casosCoordinados} casos de ${pedidosEsperados} pedidos`}</span>}
                    </div>
                    <span className="crew-heading-meta">
                      {Array.from(new Set(items.flatMap((item) => item.extrasIds))).map((extraId) => <span key={extraId} className="crew-extra-indicator">{nombreDe(catalogos.extras, extraId)}</span>)}
                      {items.length > 0 && <span className="crew-count">{items.length}</span>}
                    </span>
                  </h4>
                  {casosSeleccionados.length > 0 && cuadrillaId === "sin-cuadrilla" && tercerizadaId === tercerizadaDelPrimerGrupoSinCuadrilla && barraAsignacionMasiva}
                  <div className="coordination-list">
                    {itemsOrdenados.map((coordinacion) => (
                      <article key={coordinacion.id} data-coordinacion-id={coordinacion.id} className={`coordination-item${idArrastrado === coordinacion.id ? " is-dragging" : ""}`} onDragStart={(event) => iniciarArrastre(event, coordinacion.id)} onDragOver={(event) => { event.preventDefault(); event.dataTransfer.dropEffect = guardandoOrden ? "none" : "move"; }} onDragEnd={() => setIdArrastrado(null)}>
                        <button className="custody-delete-button coordination-delete-button" type="button" disabled={eliminandoCoordinacion === coordinacion.id} title="Eliminar coordinación" aria-label={`Eliminar coordinación ${coordinacion.ticket}`} onClick={() => void eliminarCaso(coordinacion)}>
                          <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M7 3.5h6M4.5 5.5h11m-9.5 0 .65 11h6.7l.65-11M8 8.5v5m4-5v5" /></svg>
                        </button>
                        <div role={coordinacion.cuadrillaId === null ? "group" : "button"} tabIndex={0} className={`coordination-summary${coordinacion.cuadrillaId === null ? " coordination-summary-selectable" : ""}${casosSeleccionados.some((caso) => caso.id === coordinacion.id) ? " coordination-summary-selected" : ""}`} aria-label={coordinacion.cuadrillaId === null ? `Coordinación ${coordinacion.ticket}; seleccioná la casilla para asignar a una cuadrilla` : undefined} aria-expanded={coordinacion.cuadrillaId === null ? undefined : abierta === coordinacion.id} onKeyDown={(event) => {
                          if ((event.target as HTMLElement).closest("input[type='checkbox']")) return;
                          if (event.key !== "Enter" && event.key !== " ") return;
                          event.preventDefault();
                          setAbierta(abierta === coordinacion.id ? null : coordinacion.id);
                        }} onClick={(event) => {
                          const target = event.target as HTMLElement;
                          if (target.closest("input[type='checkbox']")) return;
                          if (target.closest(".coordination-ticket") && window.getSelection()?.toString()) return;
                          setAbierta(abierta === coordinacion.id ? null : coordinacion.id);
                        }} onDoubleClick={(event) => {
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
                          <span className="coordination-ticket-cell"><span className="coordination-drag-handle" draggable={!termino && !guardandoOrden} title="Arrastrá para reordenar" aria-label="Arrastrar para reordenar">⠿</span><span className="coordination-ticket" title="Seleccioná el número para copiarlo">{coordinacion.ticket}</span>{coordinacion.cuadrillaId === null && <input className="coordination-select-checkbox" type="checkbox" checked={casosSeleccionados.some((caso) => caso.id === coordinacion.id)} disabled={guardandoAsignacion} aria-label={`Seleccionar caso ${coordinacion.ticket} para asignarlo a una cuadrilla`} onClick={(event) => event.stopPropagation()} onChange={(event) => cambiarSeleccionMasiva(coordinacion.id, event.target.checked)} />}</span>
                          <span className="coordination-meta"><span>{nombreDe(catalogos.tecnologias, coordinacion.tecnologiaId)}</span><span>{coordinacion.zona ? nombreDe(catalogos.zonas, coordinacion.zona) : "Zona sin asignar"}</span></span>
                          <span className={"state-badge state-" + normalizarBusqueda(nombreDe(catalogos.estados, coordinacion.estadoId)).replace(/\s+/g, "-")} title="Doble clic para marcar como confirmado">{nombreDe(catalogos.estados, coordinacion.estadoId)}</span>
                          <span className="expand-chevron">{abierta === coordinacion.id ? "⌃" : "⌄"}</span>
                        </div>
                        {abierta === coordinacion.id && <DetalleCoordinacion coordinacion={coordinacion} onEditar={() => setCoordinacionEditandoModal(coordinacion.id)} />}
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
      {mostrarRango && <RangoDialog fecha={fecha} onClose={() => setMostrarRango(false)} />}
      {mostrarNuevaCoordinacion && <NuevaCoordinacionDialog fecha={fecha} valoresIniciales={valoresNuevaCoordinacion} onClose={() => setMostrarNuevaCoordinacion(false)} onGuardado={setValoresNuevaCoordinacion} />}
      {coordinacionEditandoModal && <NuevaCoordinacionDialog fecha={fecha} coordinacionId={coordinacionEditandoModal} onClose={() => setCoordinacionEditandoModal(null)} />}
    </section>
  );
}

