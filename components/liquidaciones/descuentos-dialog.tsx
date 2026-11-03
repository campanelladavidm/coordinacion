"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

export type DescuentoLiquidacion = {
  id: string;
  ticket: string;
  realizaId: string;
  perteneceId: string;
  motivo: string;
};

type Tercerizada = { id: string; nombre: string };
type Props = {
  open: boolean;
  mes: number;
  anio: number;
  tercerizadas: Tercerizada[];
  contextoId?: string;
  onClose: () => void;
};
type SaveStatus = "idle" | "saving" | "saved" | "error";

async function api<T>(url: string, init?: RequestInit, contextoId?: string): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: { ...(init?.body ? { "Content-Type": "application/json" } : {}), ...(contextoId ? { "x-user-context": contextoId } : {}), ...init?.headers },
  });
  const data = await response.json() as T & { error?: string };
  if (!response.ok) throw new Error(data.error ?? "No se pudo completar la operación.");
  return data;
}

const instantanea = (row: DescuentoLiquidacion) => JSON.stringify(row);
const nuevoId = () => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (char) => {
    const random = Math.floor(Math.random() * 16);
    return (char === "x" ? random : (random & 0x3) | 0x8).toString(16);
  });
};

export function DescuentosDialog({ open, mes, anio, tercerizadas, contextoId, onClose }: Props) {
  const periodo = `${anio}-${mes}`;
  const [filas, setFilas] = useState<DescuentoLiquidacion[]>([]);
  const [periodoCargado, setPeriodoCargado] = useState("");
  const [errorCarga, setErrorCarga] = useState("");
  const [errorGuardado, setErrorGuardado] = useState("");
  const [estadoGuardado, setEstadoGuardado] = useState<SaveStatus>("idle");
  const [enEdicion, setEnEdicion] = useState<string | null>(null);
  const [eliminando, setEliminando] = useState<string | null>(null);
  const [filtroTercerizada, setFiltroTercerizada] = useState("");
  const [intentoCarga, setIntentoCarga] = useState(0);
  const guardadas = useRef(new Map<string, string>());
  const guardadosEnCurso = useRef(new Map<string, Promise<void>>());
  const byId = useMemo(() => new Map(tercerizadas.map((item) => [item.id, item.nombre])), [tercerizadas]);
  const filasFiltradas = useMemo(() => filas.filter((row) => !filtroTercerizada || row.perteneceId === filtroTercerizada), [filas, filtroTercerizada]);

  useEffect(() => {
    if (!open) return;
    let activo = true;
    void api<{ descuentos: DescuentoLiquidacion[] }>(`/api/liquidaciones/descuentos?mes=${mes}&anio=${anio}`, { cache: "no-store" }, contextoId)
      .then((data) => {
        if (!activo) return;
        const result = data.descuentos ?? [];
        guardadas.current = new Map(result.map((row) => [row.id, instantanea(row)]));
        setFilas(result);
        setPeriodoCargado(periodo);
        setErrorCarga(""); setErrorGuardado(""); setEstadoGuardado("idle"); setEnEdicion(null);
      })
      .catch((cause) => {
        if (!activo) return;
        setErrorCarga(cause instanceof Error ? cause.message : "No se pudieron cargar los descuentos.");
        setPeriodoCargado(periodo);
      });
    return () => { activo = false; };
  }, [open, mes, anio, periodo, contextoId, intentoCarga]);

  const guardarFila = useCallback(async (row: DescuentoLiquidacion, targetMes = mes, targetAnio = anio) => {
    const snapshot = instantanea(row);
    if (guardadas.current.get(row.id) === snapshot) return;
    const running = guardadosEnCurso.current.get(row.id);
    if (running) {
      await running;
      if (guardadas.current.get(row.id) === snapshot) return;
    }
    const promise = api<{ descuento: DescuentoLiquidacion }>("/api/liquidaciones/descuentos", {
      method: "POST",
      body: JSON.stringify({ operacion: "guardar", mes: targetMes, anio: targetAnio, ...row }),
    }, contextoId).then((data) => { guardadas.current.set(row.id, instantanea(data.descuento)); });
    guardadosEnCurso.current.set(row.id, promise);
    try { await promise; }
    finally { if (guardadosEnCurso.current.get(row.id) === promise) guardadosEnCurso.current.delete(row.id); }
  }, [mes, anio, contextoId]);

  useEffect(() => {
    if (!open || periodoCargado !== periodo || errorCarga) return;
    const pendientes = filas.filter((row) => guardadas.current.get(row.id) !== instantanea(row));
    if (!pendientes.length) return;
    const timeout = window.setTimeout(async () => {
      setEstadoGuardado("saving"); setErrorGuardado("");
      try {
        await Promise.all(pendientes.map((row) => guardarFila(row)));
        setEstadoGuardado("saved");
      } catch (cause) {
        setEstadoGuardado("error");
        setErrorGuardado(cause instanceof Error ? cause.message : "No se pudieron guardar los cambios.");
      }
    }, 500);
    return () => window.clearTimeout(timeout);
  }, [open, periodo, periodoCargado, filas, errorCarga, guardarFila]);

  function actualizarFila(id: string, campo: "ticket" | "realizaId" | "perteneceId" | "motivo", value: string) {
    setFilas((current) => current.map((row) => row.id === id ? { ...row, [campo]: value } : row));
    setEstadoGuardado("idle"); setErrorGuardado("");
  }

  function agregarFila() {
    const row = { id: nuevoId(), ticket: "", realizaId: "", perteneceId: "", motivo: "" };
    setFilas((current) => [...current, row]);
    setEnEdicion(row.id); setFiltroTercerizada(""); setErrorCarga("");
  }

  async function eliminarFila(row: DescuentoLiquidacion) {
    setEliminando(row.id); setErrorGuardado("");
    try {
      if (guardadas.current.has(row.id) || guardadosEnCurso.current.has(row.id)) {
        await guardarFila(row);
        await api("/api/liquidaciones/descuentos", { method: "DELETE", body: JSON.stringify({ id: row.id, mes, anio }) }, contextoId);
      }
      guardadas.current.delete(row.id);
      setFilas((current) => current.filter((item) => item.id !== row.id));
      if (enEdicion === row.id) setEnEdicion(null);
      setEstadoGuardado("saved");
    } catch (cause) {
      setErrorGuardado(cause instanceof Error ? cause.message : "No se pudo eliminar el descuento.");
      setEstadoGuardado("error");
    } finally { setEliminando(null); }
  }

  const cerrar = useCallback(async () => {
    if (periodoCargado === periodo && !errorCarga) {
      const pendientes = filas.filter((row) => guardadas.current.get(row.id) !== instantanea(row));
      if (pendientes.length) {
        setEstadoGuardado("saving"); setErrorGuardado("");
        try {
          await Promise.all(pendientes.map((row) => guardarFila(row)));
          setEstadoGuardado("saved");
        } catch (cause) {
          setEstadoGuardado("error"); setErrorGuardado(cause instanceof Error ? cause.message : "No se pudieron guardar los cambios.");
          return;
        }
      }
    }
    onClose();
  }, [periodoCargado, periodo, errorCarga, filas, guardarFila, onClose]);

  useEffect(() => {
    if (!open) return;
    const cerrarConEscape = (event: KeyboardEvent) => { if (event.key === "Escape") void cerrar(); };
    window.addEventListener("keydown", cerrarConEscape);
    return () => window.removeEventListener("keydown", cerrarConEscape);
  }, [open, cerrar]);

  useEffect(() => {
    if (!open) return;
    const overflowAnterior = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = overflowAnterior; };
  }, [open]);

  if (!open || typeof document === "undefined") return null;
  const mesNombre = new Intl.DateTimeFormat("es-AR", { month: "long" }).format(new Date(anio, mes - 1, 1));
  const labelEstado = estadoGuardado === "saving" ? "Guardando cambios…" : estadoGuardado === "saved" ? "Guardado automáticamente" : estadoGuardado === "error" ? "No se pudo guardar" : "Se guarda automáticamente mientras editás.";

  return createPortal(<div className="liqui-discounts-backdrop" style={{ position: "fixed", zIndex: 2147483000, inset: 0, display: "grid", placeItems: "center", overflow: "auto", background: "rgb(2 9 17 / 72%)", padding: 20, backdropFilter: "blur(5px)", visibility: "visible", opacity: 1 }} role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) void cerrar(); }}>
    <section className="liqui-discounts-modal" style={{ display: "flex", boxSizing: "border-box", width: "min(1180px, 96vw)", height: "min(790px, 88dvh)", minHeight: "min(500px, 88dvh)", flexDirection: "column", overflow: "hidden", border: "1px solid var(--border, #243950)", borderRadius: 14, background: "var(--surface, #0e1b2c)", color: "var(--text, #eaf3fc)", boxShadow: "0 24px 80px rgb(0 0 0 / 45%)", visibility: "visible", opacity: 1 }} role="dialog" aria-modal="true" aria-labelledby="liqui-discounts-title">
      <header className="liqui-discounts-header">
        <div><span className="liqui-discounts-eyebrow">LIQUIDACIONES</span><h2 id="liqui-discounts-title">Descuentos · {mesNombre} {anio}</h2><p>Registrá descuentos asociados a tickets y tercerizadas.</p></div>
        <button type="button" className="liqui-discounts-close" onClick={() => void cerrar()} aria-label="Cerrar descuentos">×</button>
      </header>
      <div className="liqui-discounts-toolbar">
        <div className="liqui-discounts-summary"><strong>{filasFiltradas.length}</strong> {filasFiltradas.length === 1 ? "descuento" : "descuentos"}{filtroTercerizada ? ` pertenecientes a ${byId.get(filtroTercerizada) ?? "la tercerizada seleccionada"}` : " en este período"}</div>
        <label>Filtrar por “Pertenece a”<select value={filtroTercerizada} onChange={(event) => setFiltroTercerizada(event.target.value)}><option value="">Todas las tercerizadas</option>{tercerizadas.map((item) => <option value={item.id} key={item.id}>{item.nombre}</option>)}</select></label>
        <span className={`liqui-discounts-save-state is-${estadoGuardado}`}><i aria-hidden="true"/>{labelEstado}</span>
      </div>
      {errorCarga ? <div className="liqui-discounts-error" role="alert"><span>{errorCarga}</span><button type="button" className="button" onClick={() => { setErrorCarga(""); setPeriodoCargado(""); setIntentoCarga((value) => value + 1); }}>Reintentar</button></div> : periodoCargado !== periodo ? <div className="liqui-discounts-loading">Cargando descuentos…</div> : <>
        <div className="liqui-discounts-table-wrap"><table className="liqui-discounts-table"><thead><tr><th>Mes</th><th>Ticket</th><th>Realiza</th><th>Pertenece a</th><th>Motivo</th><th>Acciones</th></tr></thead><tbody>
          {filasFiltradas.map((row) => {
            const editing = enEdicion === row.id;
            return <tr key={row.id}>
              <td><span className="liqui-discounts-month">{mesNombre}</span></td>
              <td>{editing ? <input aria-label="Ticket" inputMode="numeric" maxLength={80} value={row.ticket} onChange={(event) => actualizarFila(row.id, "ticket", event.target.value)} placeholder="Número de ticket"/> : <span>{row.ticket || "—"}</span>}</td>
              <td>{editing ? <select aria-label="Realiza" value={row.realizaId} onChange={(event) => actualizarFila(row.id, "realizaId", event.target.value)}><option value="">Seleccionar</option>{tercerizadas.map((item) => <option key={item.id} value={item.id}>{item.nombre}</option>)}</select> : <span>{byId.get(row.realizaId) ?? "—"}</span>}</td>
              <td>{editing ? <select aria-label="Pertenece a" value={row.perteneceId} onChange={(event) => actualizarFila(row.id, "perteneceId", event.target.value)}><option value="">Seleccionar</option>{tercerizadas.map((item) => <option key={item.id} value={item.id}>{item.nombre}</option>)}</select> : <span>{byId.get(row.perteneceId) ?? "—"}</span>}</td>
              <td>{editing ? <input aria-label="Motivo" maxLength={1500} value={row.motivo} onChange={(event) => actualizarFila(row.id, "motivo", event.target.value)} placeholder="Motivo del descuento"/> : <span className="liqui-discounts-reason">{row.motivo || "—"}</span>}</td>
              <td><div className="liqui-discounts-actions"><button type="button" className="button" onClick={() => setEnEdicion(editing ? null : row.id)}>{editing ? "Listo" : "Editar"}</button><button type="button" className="liqui-discounts-delete" aria-label={`Eliminar descuento del ticket ${row.ticket || "sin ticket"}`} title="Eliminar fila" disabled={eliminando === row.id} onClick={() => void eliminarFila(row)}>×</button></div></td>
            </tr>;
          })}
          {!filasFiltradas.length && <tr><td className="liqui-discounts-empty" colSpan={6}>{filas.length ? "No hay descuentos que coincidan con el filtro." : "Todavía no hay descuentos cargados para este período."}</td></tr>}
        </tbody></table></div>
        <footer className="liqui-discounts-footer"><button type="button" className="button button-primary" onClick={agregarFila}>＋ Agregar descuento</button>{errorGuardado && <span className="liqui-discounts-error-message" role="alert">{errorGuardado}</span>}<button type="button" className="button" onClick={() => void cerrar()}>{estadoGuardado === "saving" ? "Esperar guardado y cerrar" : "Cerrar"}</button></footer>
      </>}
    </section>
  </div>, document.body);
}
