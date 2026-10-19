"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import { useCoordinacionesDemo } from "@/components/providers/demo-data-provider";

type Estado = "BORRADOR" | "FINALIZADA";
type FormulaVinculo = { conceptoId: string; modo: "FIJO" | "PORCENTAJE"; valor: number } | { conceptoId: string; adicional: number };
type Concepto = { id: string; nombre: string; tipo: "SUMA" | "RESTA"; cantidad: number; precio: number; nota: string; enlace: string; formula?: FormulaVinculo };
type Tercerizada = { id: string; nombre: string };
type Liquidacion = { id: string; tercerizada_id: string; mes: number; anio: number; estado: Estado; conceptos: Concepto[]; informacion_adicional: string; finalizado_at: string | null };
type Exportacion = { nombre_archivo: string; created_at: string } | null;
const nombresMeses = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
const formatoMoneda = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 2 });
const numero = (value: number) => new Intl.NumberFormat("es-AR", { maximumFractionDigits: 2 }).format(value);
const nuevoId = () => typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
const etiquetaAdicional = (formula: FormulaVinculo) => "modo" in formula
  ? formula.modo === "PORCENTAJE" ? `${numero(formula.valor)}%` : formatoMoneda.format(formula.valor)
  : formatoMoneda.format(formula.adicional);

async function api<T>(url: string, init?: RequestInit, contextoId?: string): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: { ...(init?.body instanceof FormData ? {} : { "Content-Type": "application/json" }), ...(contextoId ? { "x-user-context": contextoId } : {}), ...init?.headers },
  });
  const data = await response.json() as T & { error?: string };
  if (!response.ok) throw new Error(data.error ?? "No se pudo completar la operación.");
  return data;
}

function csvValue(value: string | number) {
  return `"${String(value).replaceAll('"', '""')}"`;
}

function crc32(bytes: Uint8Array) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function crearZip(archivos: { nombre: string; contenido: Uint8Array }[]) {
  const encoder = new TextEncoder();
  const local: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let offset = 0;
  for (const archivo of archivos) {
    const nombre = encoder.encode(archivo.nombre);
    const checksum = crc32(archivo.contenido);
    const cabecera = new Uint8Array(30 + nombre.length);
    const vista = new DataView(cabecera.buffer);
    vista.setUint32(0, 0x04034b50, true); vista.setUint16(4, 20, true); vista.setUint16(6, 0x0800, true);
    vista.setUint16(8, 0, true); vista.setUint32(14, checksum, true); vista.setUint32(18, archivo.contenido.length, true); vista.setUint32(22, archivo.contenido.length, true); vista.setUint16(26, nombre.length, true);
    cabecera.set(nombre, 30); local.push(cabecera, archivo.contenido);
    const centralHeader = new Uint8Array(46 + nombre.length);
    const centralView = new DataView(centralHeader.buffer);
    centralView.setUint32(0, 0x02014b50, true); centralView.setUint16(4, 20, true); centralView.setUint16(6, 20, true); centralView.setUint16(8, 0x0800, true); centralView.setUint16(10, 0, true);
    centralView.setUint32(16, checksum, true); centralView.setUint32(20, archivo.contenido.length, true); centralView.setUint32(24, archivo.contenido.length, true); centralView.setUint16(28, nombre.length, true); centralView.setUint32(42, offset, true);
    centralHeader.set(nombre, 46); central.push(centralHeader); offset += cabecera.length + archivo.contenido.length;
  }
  const centralSize = central.reduce((sum, part) => sum + part.length, 0);
  const end = new Uint8Array(22); const view = new DataView(end.buffer);
  view.setUint32(0, 0x06054b50, true); view.setUint16(8, archivos.length, true); view.setUint16(10, archivos.length, true); view.setUint32(12, centralSize, true); view.setUint32(16, offset, true);
  const partesBlob = [...local, ...central, end].map((parte) => Uint8Array.from(parte).buffer);
  return new Blob(partesBlob, { type: "application/zip" });
}

export function LiquidacionesView() {
  const { usuarioEnContexto, rolAutenticado } = useCoordinacionesDemo();
  const [mes, setMes] = useState(1);
  const [anio, setAnio] = useState(2026);
  const [periodoListo, setPeriodoListo] = useState(false);
  const [tercerizadas, setTercerizadas] = useState<Tercerizada[]>([]);
  const [liquidaciones, setLiquidaciones] = useState<Liquidacion[]>([]);
  const [exportacion, setExportacion] = useState<Exportacion>(null);
  const [tercerizadaId, setTercerizadaId] = useState("");
  const [conceptos, setConceptos] = useState<Concepto[]>([]);
  const [informacionAdicional, setInformacionAdicional] = useState("");
  const [cargando, setCargando] = useState(true);
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [base, setBase] = useState("");
  const [porcentaje, setPorcentaje] = useState("");
  const [precioCalculado, setPrecioCalculado] = useState("");
  const [precioAdicional, setPrecioAdicional] = useState("");
  const [modoVinculo, setModoVinculo] = useState<"FIJO" | "PORCENTAJE">("FIJO");
  const [tipoConceptoVinculado, setTipoConceptoVinculado] = useState<"SUMA" | "RESTA">("SUMA");
  const [conceptoReferencia, setConceptoReferencia] = useState("");
  const [nuevoNombre, setNuevoNombre] = useState("");
  const [tercerizadaImportarId, setTercerizadaImportarId] = useState("");
  const [modoImportacion, setModoImportacion] = useState<"COMPLETO" | "SOLO_CONCEPTOS">("COMPLETO");
  const [imprimiendo, setImprimiendo] = useState<string | null>(null);
  const ultimoGuardado = useRef("");
  const tercerizadaSeleccionada = useRef(tercerizadaId);
  const contextoId = usuarioEnContexto?.id;
  const puedeReabrir = rolAutenticado === "JEFE" || rolAutenticado === "SUPERVISOR";

  const cargar = useCallback(async (mantenerSeleccion = true) => {
    setCargando(true); setError("");
    try {
      const data = await api<{ tercerizadas: Tercerizada[]; liquidaciones: Liquidacion[]; rol: string; exportacion: Exportacion }>(`/api/liquidaciones?mes=${mes}&anio=${anio}`, undefined, contextoId);
      setTercerizadas(data.tercerizadas);
      setLiquidaciones(data.liquidaciones);
      setExportacion(data.exportacion);
      const seleccionActual = tercerizadaSeleccionada.current;
      const actualId = mantenerSeleccion && data.tercerizadas.some((item) => item.id === seleccionActual) ? seleccionActual : data.tercerizadas[0]?.id ?? "";
      const loadedConcepts = data.liquidaciones.find((item) => item.tercerizada_id === actualId)?.conceptos ?? [];
      const loadedInformation = data.liquidaciones.find((item) => item.tercerizada_id === actualId)?.informacion_adicional ?? "";
      tercerizadaSeleccionada.current = actualId;
      setTercerizadaId(actualId);
      setConceptos(loadedConcepts);
      setInformacionAdicional(loadedInformation);
      ultimoGuardado.current = JSON.stringify({ tercerizadaId: actualId, mes, anio, conceptos: loadedConcepts, informacionAdicional: loadedInformation });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudieron cargar las liquidaciones.");
    } finally { setCargando(false); }
  }, [mes, anio, contextoId]);

  useEffect(() => {
    const hoy = new Date();
    setMes(hoy.getMonth() + 1);
    setAnio(hoy.getFullYear());
    setPeriodoListo(true);
  }, []);
  useEffect(() => { if (periodoListo) void cargar(false); }, [cargar, periodoListo]);
  const liquidacionActual = liquidaciones.find((item) => item.tercerizada_id === tercerizadaId);
  const estadoActual: Estado = liquidacionActual?.estado ?? "BORRADOR";
  const empresaActual = tercerizadas.find((item) => item.id === tercerizadaId);
  const suma = conceptos.reduce((total, item) => total + (item.tipo === "SUMA" ? item.cantidad * item.precio : 0), 0);
  const resta = conceptos.reduce((total, item) => total + (item.tipo === "RESTA" ? item.cantidad * item.precio : 0), 0);
  const total = suma - resta;
  const mesSiguiente = mes % 12 + 1;
  const nombreMesSiguiente = nombresMeses[mesSiguiente - 1];
  const anioSiguiente = anio + (mes === 12 ? 1 : 0);
  const anios = Array.from({ length: 7 }, (_, index) => anio - 3 + index);
  const soloLectura = estadoActual === "FINALIZADA" && !puedeReabrir;

  const conceptosVinculados = conceptos.filter((item) => item.formula);

  useEffect(() => {
    if (!periodoListo || cargando || ocupado || soloLectura || !tercerizadaId) return;
    const snapshot = JSON.stringify({ tercerizadaId, mes, anio, conceptos, informacionAdicional });
    if (snapshot === ultimoGuardado.current) return;
    const timeout = window.setTimeout(async () => {
      setMensaje("Guardando automáticamente…"); setError("");
      try {
        const result = await api<{ liquidacion: { id: string; estado: Estado; finalizado_at?: string | null } }>("/api/liquidaciones", {
          method: "POST", body: JSON.stringify({ operacion: "guardar", tercerizadaId, mes, anio, conceptos, informacionAdicional }),
        }, contextoId);
        ultimoGuardado.current = snapshot;
        const saved = result.liquidacion;
        setLiquidaciones((current) => {
          const existing = current.some((item) => item.tercerizada_id === tercerizadaId);
          const row: Liquidacion = { id: saved.id, tercerizada_id: tercerizadaId, mes, anio, estado: saved.estado, conceptos, informacion_adicional: informacionAdicional, finalizado_at: saved.finalizado_at ?? null };
          return existing ? current.map((item) => item.tercerizada_id === tercerizadaId ? row : item) : [...current, row];
        });
        setMensaje("Guardado automáticamente.");
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "No se pudieron guardar los cambios automáticamente.");
        setMensaje("");
      }
    }, 700);
    return () => window.clearTimeout(timeout);
  }, [conceptos, informacionAdicional, tercerizadaId, mes, anio, contextoId, periodoListo, cargando, ocupado, soloLectura]);

  async function cambiarTercerizada(id: string) {
    if (id === tercerizadaId) return;
    if (!(await guardar(conceptos, tercerizadaId, mes, anio, informacionAdicional))) return;
    const nextLiquidacion = liquidaciones.find((item) => item.tercerizada_id === id);
    const nextConcepts = nextLiquidacion?.conceptos ?? [];
    const nextInformation = nextLiquidacion?.informacion_adicional ?? "";
    ultimoGuardado.current = JSON.stringify({ tercerizadaId: id, mes, anio, conceptos: nextConcepts, informacionAdicional: nextInformation });
    tercerizadaSeleccionada.current = id;
    setTercerizadaId(id);
    setConceptos(nextConcepts);
    setInformacionAdicional(nextInformation);
    setMensaje(""); setError("");
  }

  async function cambiarPeriodo(nuevoMes: number, nuevoAnio: number) {
    if (!(await guardar(conceptos, tercerizadaId, mes, anio, informacionAdicional))) return;
    setMes(nuevoMes);
    setAnio(nuevoAnio);
  }

  function actualizarConcepto(id: string, campo: "nombre" | "tipo" | "cantidad" | "precio" | "nota" | "enlace", valor: string) {
    setConceptos((actual) => {
      const next = actual.map((item) => {
        const copy = { ...item };
        if (item.id !== id) return copy;
        if (campo === "cantidad") copy.cantidad = Math.max(0, Number(valor) || 0);
        else if (campo === "precio") { copy.precio = Math.max(0, Number(valor) || 0); copy.formula = undefined; }
        else if (campo === "tipo") copy.tipo = valor as Concepto["tipo"];
        else copy[campo] = valor;
        return copy;
      });
      for (let pass = 0; pass < next.length; pass++) {
        for (const item of next) {
          if (!item.formula) continue;
          const reference = next.find((candidate) => candidate.id === item.formula?.conceptoId);
          if (reference) {
            const extra = "modo" in item.formula
              ? item.formula.modo === "PORCENTAJE" ? reference.precio * item.formula.valor / 100 : item.formula.valor
              : item.formula.adicional;
            item.precio = Math.max(0, reference.precio + extra);
          }
        }
      }
      return next;
    });
  }

  function quitarConcepto(id: string) {
    setConceptos((actual) => actual.filter((item) => item.id !== id).map((item) => item.formula?.conceptoId === id ? { ...item, formula: undefined } : item));
  }

  async function guardar(actualConceptos = conceptos, destinoId = tercerizadaId, destinoMes = mes, destinoAnio = anio, actualInformacion = informacionAdicional) {
    if (!destinoId) return true;
    const snapshot = JSON.stringify({ tercerizadaId: destinoId, mes: destinoMes, anio: destinoAnio, conceptos: actualConceptos, informacionAdicional: actualInformacion });
    if (snapshot === ultimoGuardado.current) return true;
    setOcupado(true); setError(""); setMensaje("Guardando automáticamente…");
    try {
      const result = await api<{ liquidacion: { id: string; estado: Estado; finalizado_at?: string | null } }>("/api/liquidaciones", { method: "POST", body: JSON.stringify({ operacion: "guardar", tercerizadaId: destinoId, mes: destinoMes, anio: destinoAnio, conceptos: actualConceptos, informacionAdicional: actualInformacion }) }, contextoId);
      ultimoGuardado.current = snapshot;
      const saved = result.liquidacion;
      setLiquidaciones((current) => {
        const existing = current.some((item) => item.tercerizada_id === destinoId);
        const row: Liquidacion = { id: saved.id, tercerizada_id: destinoId, mes: destinoMes, anio: destinoAnio, estado: saved.estado, conceptos: actualConceptos, informacion_adicional: actualInformacion, finalizado_at: saved.finalizado_at ?? null };
        return existing ? current.map((item) => item.tercerizada_id === destinoId ? row : item) : [...current, row];
      });
      setMensaje("Guardado automáticamente.");
      return true;
    } catch (cause) { setError(cause instanceof Error ? cause.message : "No se pudieron guardar los cambios automáticamente."); setMensaje(""); return false; }
    finally { setOcupado(false); }
  }

  async function cambiarEstado(event: ChangeEvent<HTMLSelectElement>) {
    const estado = event.target.value as Estado;
    setOcupado(true); setError(""); setMensaje("");
    try {
      if (!(await guardar(conceptos))) throw new Error("No se pudieron guardar los cambios antes de actualizar el estado.");
      await api("/api/liquidaciones", { method: "POST", body: JSON.stringify({ operacion: "cambiar_estado", tercerizadaId, mes, anio, estado }) }, contextoId);
      setMensaje(estado === "FINALIZADA" ? "Liquidación finalizada." : "Liquidación reabierta como borrador.");
      await cargar();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "No se pudo cambiar el estado."); }
    finally { setOcupado(false); }
  }

  function agregarConcepto() {
    setConceptos((actual) => [...actual, { id: nuevoId(), nombre: "", tipo: "SUMA", cantidad: 0, precio: 0, nota: "", enlace: "" }]);
  }

  function aplicarAumento() {
    const nuevoPrecio = (Number(base) || 0) * (1 + (Number(porcentaje) || 0) / 100);
    setPrecioCalculado(String(Number(nuevoPrecio.toFixed(2))));
  }

  function agregarDerivado() {
    const referencia = conceptos.find((item) => item.id === conceptoReferencia);
    if (!referencia || !nuevoNombre.trim()) { setError("Elegí un concepto base y escribí el nombre del nuevo concepto."); return; }
    const valor = Number(precioAdicional) || 0;
    const adicional = modoVinculo === "PORCENTAJE" ? Number(referencia.precio) * valor / 100 : valor;
    setConceptos((actual) => [...actual, { id: nuevoId(), nombre: nuevoNombre.trim(), tipo: tipoConceptoVinculado, cantidad: 0, precio: Number(referencia.precio) + adicional, nota: `Precio basado en ${referencia.nombre}`, enlace: "", formula: { conceptoId: referencia.id, modo: modoVinculo, valor } }]);
    setMensaje(`Precio vinculado calculado: ${referencia.nombre} + ${modoVinculo === "PORCENTAJE" ? `${numero(valor)}%` : formatoMoneda.format(valor)}.`);
    setNuevoNombre(""); setError("");
  }

  function importarConceptos() {
    const origen = liquidaciones.find((item) => item.tercerizada_id === tercerizadaImportarId);
    if (!origen?.conceptos.length) { setError("La tercerizada seleccionada todavía no tiene conceptos guardados en este período."); return; }
    if (conceptos.length && !window.confirm("Se reemplazarán los conceptos actuales de esta liquidación. ¿Querés continuar?")) return;
    const ids = new Map<string, string>(origen.conceptos.map((item) => [item.id, nuevoId()] as const));
    const imported = origen.conceptos.map((item) => ({
      ...item,
      id: ids.get(item.id) ?? nuevoId(),
      cantidad: 0,
      precio: modoImportacion === "COMPLETO" ? Number(item.precio) : 0,
      nota: "",
      enlace: modoImportacion === "COMPLETO" ? item.enlace : "",
      ...(modoImportacion === "COMPLETO" && item.formula ? { formula: { ...item.formula, conceptoId: ids.get(item.formula.conceptoId) ?? item.formula.conceptoId } } : { formula: undefined }),
    }));
    setConceptos(imported);
    setMensaje(`Se importaron ${imported.length} conceptos de ${tercerizadas.find((item) => item.id === tercerizadaImportarId)?.nombre}.`);
    setError("");
  }

  async function crearProxima() {
    if (!tercerizadaId) return;
    setOcupado(true); setError(""); setMensaje("");
    try {
      if (!(await guardar(conceptos))) throw new Error("No se pudieron guardar los cambios antes de crear la próxima liquidación.");
      await api("/api/liquidaciones", { method: "POST", body: JSON.stringify({ operacion: "crear_proxima", tercerizadaId, mes, anio }) }, contextoId);
      setMes(mesSiguiente); setAnio(anioSiguiente);
      setMensaje(`Se creó ${nombreMesSiguiente} ${anioSiguiente} con los conceptos y precios actuales. El período actual sigue como borrador.`);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "No se pudo crear la próxima liquidación."); }
    finally { setOcupado(false); }
  }

  async function finalizarPeriodo() {
    if (!window.confirm(`¿Finalizar todas las liquidaciones de ${nombresMeses[mes - 1]} ${anio}? Quedarán bloqueadas para Coordinadores.`)) return;
    setOcupado(true); setError(""); setMensaje("");
    try {
      if (tercerizadaId && !soloLectura && !(await guardar(conceptos))) throw new Error("No se pudieron guardar los cambios antes de finalizar el período.");
      await api("/api/liquidaciones", { method: "POST", body: JSON.stringify({ operacion: "finalizar_periodo", mes, anio }) }, contextoId);
      setMensaje(`Se finalizaron las liquidaciones y se prepararon los borradores de ${nombreMesSiguiente} ${anioSiguiente} con los conceptos y precios copiados.`); await cargar();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "No se pudo finalizar el período."); }
    finally { setOcupado(false); }
  }

  const csvArchivos = useMemo(() => tercerizadas.map((empresa) => {
    const liquidacion = liquidaciones.find((item) => item.tercerizada_id === empresa.id);
    const conceptosEmpresa = empresa.id === tercerizadaId ? conceptos : liquidacion?.conceptos ?? [];
    const estadoEmpresa = empresa.id === tercerizadaId ? estadoActual : liquidacion?.estado ?? "BORRADOR";
    const rows = [["Tercerizada", "Mes", "Año", "Estado", "Concepto", "Tipo", "Cantidad", "Precio unitario", "Subtotal", "Nota rápida", "Enlace"]];
    for (const item of conceptosEmpresa) rows.push([empresa.nombre, nombresMeses[mes - 1], String(anio), estadoEmpresa, item.nombre, item.tipo, String(item.cantidad), String(item.precio), String(item.cantidad * item.precio * (item.tipo === "RESTA" ? -1 : 1)), item.nota, item.enlace]);
    if (!conceptosEmpresa.length) rows.push([empresa.nombre, nombresMeses[mes - 1], String(anio), estadoEmpresa, "", "", "0", "0", "0", "", ""]);
    const csv = "\uFEFF" + rows.map((row) => row.map(csvValue).join(";")).join("\r\n");
    return { nombre: `${empresa.nombre.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9_-]+/g, "_")}_${anio}_${String(mes).padStart(2, "0")}.csv`, contenido: new TextEncoder().encode(csv) };
  }), [tercerizadas, liquidaciones, mes, anio, conceptos, tercerizadaId, estadoActual]);

  async function exportarZip() {
    setOcupado(true); setError(""); setMensaje("");
    try {
      if (!soloLectura && conceptos.length) {
        if (!(await guardar(conceptos))) throw new Error("No se pudieron guardar los cambios antes de exportar.");
      }
      const archivos = csvArchivos.map((file) => ({ nombre: file.nombre, contenido: file.contenido }));
      const zip = crearZip(archivos);
      const zipName = `liquidaciones_${nombresMeses[mes - 1].toLocaleLowerCase("es-AR")}_${anio}.zip`;
      const form = new FormData(); form.append("mes", String(mes)); form.append("anio", String(anio)); form.append("archivo", zip, zipName);
      await api("/api/liquidaciones/exportar", { method: "POST", body: form }, contextoId);
      const download = await fetch(`/api/liquidaciones/exportar?mes=${mes}&anio=${anio}`, { headers: contextoId ? { "x-user-context": contextoId } : {} });
      if (!download.ok) throw new Error("El ZIP se guardó, pero no se pudo descargar.");
      const blob = await download.blob(); const href = URL.createObjectURL(blob); const anchor = document.createElement("a");
      anchor.href = href; anchor.download = zipName; anchor.click(); URL.revokeObjectURL(href);
      setMensaje(`ZIP de ${nombresMeses[mes - 1]} ${anio} guardado en Supabase y descargado.`); await cargar();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "No se pudo generar el ZIP."); }
    finally { setOcupado(false); }
  }

  async function descargarZipArchivado() {
    setOcupado(true); setError("");
    try {
      const response = await fetch(`/api/liquidaciones/exportar?mes=${mes}&anio=${anio}`, { headers: contextoId ? { "x-user-context": contextoId } : {} });
      if (!response.ok) { const data = await response.json() as { error?: string }; throw new Error(data.error ?? "No se pudo descargar el archivo archivado."); }
      const blob = await response.blob(); const href = URL.createObjectURL(blob); const anchor = document.createElement("a");
      anchor.href = href; anchor.download = exportacion?.nombre_archivo ?? `liquidaciones_${nombresMeses[mes - 1].toLocaleLowerCase("es-AR")}_${anio}.zip`; anchor.click(); URL.revokeObjectURL(href);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "No se pudo descargar el ZIP archivado."); }
    finally { setOcupado(false); }
  }

  function descargarPdf(id: string) {
    setImprimiendo(id);
    window.setTimeout(() => { window.print(); setImprimiendo(null); }, 80);
  }

  const liquidacionPdf = imprimiendo ? liquidaciones.find((item) => item.tercerizada_id === imprimiendo) : undefined;
  const empresaPdf = imprimiendo ? tercerizadas.find((item) => item.id === imprimiendo) : undefined;
  const conceptosPdf = imprimiendo === tercerizadaId ? conceptos : liquidacionPdf?.conceptos ?? [];
  const informacionPdf = imprimiendo === tercerizadaId ? informacionAdicional : liquidacionPdf?.informacion_adicional ?? "";
  const totalPdf = conceptosPdf.reduce((acc, item) => acc + (item.tipo === "RESTA" ? -1 : 1) * item.cantidad * item.precio, 0);

  return (
    <section className="liqui-page">
      <header className="liqui-page-heading"><div><p className="eyebrow">ADMINISTRACIÓN</p><h1 className="page-title">Liqui</h1><p className="page-description">Liquidaciones mensuales por tercerizada.</p></div></header>
      <section className="liqui-period panel">
        <label>Mes<select value={mes} onChange={(event) => void cambiarPeriodo(Number(event.target.value), anio)}>{nombresMeses.map((nombre, index) => <option key={nombre} value={index + 1}>{nombre}</option>)}</select></label>
        <label>Año<select value={anio} onChange={(event) => void cambiarPeriodo(mes, Number(event.target.value))}>{anios.map((year) => <option key={year}>{year}</option>)}</select></label>
        <div className="liqui-period-copy">Elegí el período y la tercerizada para consultar o editar su liquidación.</div>
      </section>

      <div className="liqui-layout">
        <main className="liqui-main">
          <section className="liqui-company-list panel" aria-label="Liquidaciones por tercerizada">
            <div className="liqui-company-list-heading"><h2>Tercerizadas</h2><span>{nombresMeses[mes - 1]} {anio}</span></div>
            {cargando ? <p className="liqui-muted">Cargando…</p> : tercerizadas.length ? <div className="liqui-company-chips">{tercerizadas.map((empresa) => {
              const estado = liquidaciones.find((item) => item.tercerizada_id === empresa.id)?.estado ?? "BORRADOR";
              return <button key={empresa.id} type="button" className={`liqui-company-chip${tercerizadaId === empresa.id ? " is-selected" : ""}`} onClick={() => cambiarTercerizada(empresa.id)}><span className={`liqui-state-dot ${estado === "FINALIZADA" ? "is-final" : ""}`} />{empresa.nombre}<span className={`liqui-status ${estado === "FINALIZADA" ? "is-final" : ""}`}>{estado === "FINALIZADA" ? "Finalizada" : "Borrador"}</span></button>;
            })}</div> : <p className="liqui-muted">No hay tercerizadas activas para mostrar.</p>}
          </section>

          {tercerizadaId && <>
            <section className="liqui-editor-head panel">
              <div className="liqui-editor-title"><h2>{empresaActual?.nombre} · {nombresMeses[mes - 1]} {anio}</h2><p>{estadoActual === "FINALIZADA" ? "Esta liquidación está cerrada." : "Cargá cantidades, precios y notas de cada concepto."}</p></div>
              <label className="liqui-status-control">Estado<select value={estadoActual} onChange={(event) => void cambiarEstado(event)} disabled={ocupado || (estadoActual === "FINALIZADA" && !puedeReabrir)}><option value="BORRADOR">Borrador</option><option value="FINALIZADA">Finalizada</option></select></label>
            </section>
            {soloLectura && <p className="liqui-lock-note">Liquidación bloqueada. Solo Jefe o Supervisor puede reabrirla.</p>}
            <section className="liqui-concepts panel">
              <div className="liqui-section-head"><div><h3>Conceptos</h3><span>{conceptos.length} conceptos</span>{mensaje && <small className="liqui-autosave-note">{mensaje}</small>}</div><button className="button" type="button" onClick={agregarConcepto} disabled={soloLectura}>+ Agregar concepto</button></div>
              {!conceptos.length && <div className="liqui-empty">Todavía no hay conceptos. Agregá uno para empezar la liquidación.</div>}
              {conceptos.map((item) => <article className="liqui-concept-row" key={item.id}>
                <div className="liqui-concept-main"><input className="liqui-concept-name" aria-label="Nombre del concepto" placeholder="Nombre del concepto" value={item.nombre} onChange={(event) => actualizarConcepto(item.id, "nombre", event.target.value)} disabled={soloLectura} />
                  <div className="liqui-concept-meta"><select aria-label="El concepto suma o resta" value={item.tipo} onChange={(event) => actualizarConcepto(item.id, "tipo", event.target.value)} disabled={soloLectura}><option value="SUMA">Suma</option><option value="RESTA">Resta</option></select><textarea aria-label="Nota rápida" title={item.nota || undefined} placeholder="Nota rápida (opcional)" value={item.nota} onChange={(event) => actualizarConcepto(item.id, "nota", event.target.value)} disabled={soloLectura} rows={1} /></div>
                </div>
                <label className="liqui-concept-field liqui-quantity"><span>Cantidad</span><input type="number" min="0" step="any" value={item.cantidad || ""} onChange={(event) => actualizarConcepto(item.id, "cantidad", event.target.value)} disabled={soloLectura} /></label>
                <label className="liqui-concept-field liqui-price"><span>Precio unitario</span><input type="number" min="0" step="any" value={item.precio || ""} onChange={(event) => actualizarConcepto(item.id, "precio", event.target.value)} disabled={soloLectura} /></label>
                <label className="liqui-concept-field liqui-link"><span>Enlace</span><input type="url" placeholder="https://…" value={item.enlace} onChange={(event) => actualizarConcepto(item.id, "enlace", event.target.value)} disabled={soloLectura} /></label>
                <div className={`liqui-line-total ${item.tipo === "RESTA" ? "is-deduction" : ""}`}>{item.tipo === "RESTA" ? "− " : ""}{formatoMoneda.format(item.cantidad * item.precio)}</div>
                <button className="liqui-delete" type="button" aria-label={`Eliminar ${item.nombre || "concepto"}`} onClick={() => quitarConcepto(item.id)} disabled={soloLectura}>×</button>
              </article>)}
              <div className="liqui-totals"><span>Sumas <strong>{formatoMoneda.format(suma)}</strong></span><span>Restas <strong className="is-deduction">− {formatoMoneda.format(resta)}</strong></span><span className="liqui-grand-total">Total <strong>{formatoMoneda.format(total)}</strong></span></div>
            </section>
            <section className="panel liqui-additional-info" style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: 9, width: "100%", padding: 14 }}>
              <label htmlFor="liqui-informacion-adicional" style={{ color: "var(--text)", fontSize: 12, fontWeight: 600 }}>Información adicional</label>
              <textarea id="liqui-informacion-adicional" value={informacionAdicional} maxLength={20000} rows={6} onChange={(event) => setInformacionAdicional(event.target.value)} placeholder="Agregá acá información adicional necesaria para esta liquidación…" disabled={soloLectura} style={{ display: "block", boxSizing: "border-box", width: "100%", minHeight: 150, resize: "vertical", border: "1px solid var(--border)", borderRadius: 7, outline: 0, background: "var(--background)", padding: "10px 11px", color: "var(--text)", font: "inherit", fontSize: 13, lineHeight: 1.5 }} />
              <small style={{ color: "var(--muted)", fontSize: 11 }}>{soloLectura ? "Liquidación finalizada." : "Se guarda automáticamente mientras escribís."}</small>
            </section>
          </>}
          <div className="liqui-feedback" aria-live="polite">{error && <p className="liqui-error">{error}</p>}{mensaje && !mensaje.startsWith("Guardado automáticamente") && !mensaje.startsWith("Guardando automáticamente") && <p className="liqui-success">{mensaje}</p>}</div>
          <div className="liqui-main-actions">
            <section className="panel liqui-tool-card"><h3>Próxima liquidación</h3><p>Copia los conceptos y precios a {nombreMesSiguiente}. El borrador actual sigue abierto.</p><button className="button liqui-action" type="button" onClick={() => void crearProxima()} disabled={ocupado || !tercerizadaId || estadoActual !== "BORRADOR"}>Crear próxima liquidación · {nombreMesSiguiente}</button></section>
            <section className="panel liqui-tool-card liqui-close-card"><h3>Finalizar período</h3><p>Finaliza y bloquea las liquidaciones de todas las tercerizadas del mes.</p><button className="button button-primary liqui-action" type="button" onClick={() => void finalizarPeriodo()} disabled={ocupado || !tercerizadas.length}>Finalizar liquidación completa</button></section>
          </div>
        </main>

        <aside className="liqui-tools">
          <section className="panel liqui-tool-card"><h3>Calculadora de aumento</h3><p>Calculá un precio con aumento porcentual.</p><div className="liqui-calc-inputs"><label>Valor base<input type="number" min="0" value={base} onChange={(event) => setBase(event.target.value)} placeholder="0" /></label><label>Aumento %<input type="number" min="0" value={porcentaje} onChange={(event) => setPorcentaje(event.target.value)} placeholder="0" /></label></div><div className="liqui-calc-result"><span>Precio actualizado</span><strong>{formatoMoneda.format(Number(precioCalculado) || 0)}</strong></div><button className="button" type="button" onClick={aplicarAumento}>Calcular</button></section>
          <section className="panel liqui-tool-card liqui-linked-tool"><h3>Precio vinculado</h3><p>Sumá un monto fijo o un porcentaje al precio de otro concepto.</p><label>Concepto base<select value={conceptoReferencia} onChange={(event) => setConceptoReferencia(event.target.value)}><option value="">Seleccionar concepto</option>{conceptos.map((item) => <option key={item.id} value={item.id}>{item.nombre || "Concepto sin nombre"}</option>)}</select></label><label>Nuevo concepto<input value={nuevoNombre} onChange={(event) => setNuevoNombre(event.target.value)} placeholder="Ej.: Instalación adicional" /></label><label>Tipo de concepto<select value={tipoConceptoVinculado} onChange={(event) => setTipoConceptoVinculado(event.target.value as "SUMA" | "RESTA")}><option value="SUMA">Suma</option><option value="RESTA">Resta</option></select></label><label>Tipo de adicional<select value={modoVinculo} onChange={(event) => setModoVinculo(event.target.value as "FIJO" | "PORCENTAJE")}><option value="FIJO">Monto fijo</option><option value="PORCENTAJE">Porcentaje del precio base</option></select></label><label>{modoVinculo === "PORCENTAJE" ? "Porcentaje (%)" : "Importe fijo"}<input type="number" min="0" value={precioAdicional} onChange={(event) => setPrecioAdicional(event.target.value)} placeholder={modoVinculo === "PORCENTAJE" ? "35" : "7500"} /></label><button className="button" type="button" onClick={agregarDerivado} disabled={soloLectura}>Agregar concepto vinculado</button>{conceptosVinculados.length > 0 && <div className="liqui-linked-history"><strong>Precios vinculados</strong>{conceptosVinculados.map((item) => { const formula = item.formula!; const baseConcepto = conceptos.find((candidate) => candidate.id === formula.conceptoId); return <div className="liqui-linked-history-row" key={item.id}><span>{item.nombre}<small>{item.tipo === "RESTA" ? "Resta" : "Suma"} · {baseConcepto?.nombre ?? "Concepto base"} + {etiquetaAdicional(formula)}</small></span><b>{formatoMoneda.format(item.precio)}</b></div>; })}</div>}</section>
          <section className="panel liqui-tool-card liqui-import-card"><h3>Importar conceptos</h3><p>Copiá conceptos de otra tercerizada de este período.</p><label>Liquidación de origen<select value={tercerizadaImportarId} onChange={(event) => setTercerizadaImportarId(event.target.value)}><option value="">Elegir tercerizada</option>{tercerizadas.filter((item) => item.id !== tercerizadaId && (liquidaciones.find((liq) => liq.tercerizada_id === item.id)?.conceptos.length ?? 0) > 0).map((empresa) => { const origen = liquidaciones.find((liq) => liq.tercerizada_id === empresa.id); return <option key={empresa.id} value={empresa.id}>{empresa.nombre} · {origen?.estado === "FINALIZADA" ? "Finalizada" : "Borrador"}</option>; })}</select></label><label>Qué copiar<select value={modoImportacion} onChange={(event) => setModoImportacion(event.target.value as "COMPLETO" | "SOLO_CONCEPTOS")}><option value="COMPLETO">Conceptos y precios</option><option value="SOLO_CONCEPTOS">Solo conceptos</option></select></label><small>Las cantidades se reinician en cero. Importar reemplaza la lista actual.</small><button className="button liqui-action" type="button" onClick={importarConceptos} disabled={soloLectura || !tercerizadaImportarId}>Importar conceptos</button></section>
          <section className="panel liqui-tool-card liqui-documents"><div><h3>Documentos del período</h3><p>{nombresMeses[mes - 1]} {anio} · PDFs por tercerizada</p></div>{tercerizadas.map((empresa) => <div className="liqui-document-row" key={empresa.id}><span>{empresa.nombre}<small className={`liqui-status-text ${liquidaciones.find((item) => item.tercerizada_id === empresa.id)?.estado === "FINALIZADA" ? "is-final" : ""}`}>{liquidaciones.find((item) => item.tercerizada_id === empresa.id)?.estado === "FINALIZADA" ? "Finalizada" : "Borrador"}</small></span><button className="button" type="button" onClick={() => descargarPdf(empresa.id)}>Descargar PDF</button></div>)}{exportacion && <button className="button liqui-action" type="button" onClick={() => void descargarZipArchivado()} disabled={ocupado}>Descargar ZIP archivado</button>}<button className="button liqui-action" type="button" onClick={() => void exportarZip()} disabled={ocupado}>{ocupado ? "Preparando ZIP…" : exportacion ? "Actualizar ZIP archivado" : "Generar y guardar ZIP de CSV"}</button><small className="liqui-muted">Un CSV por tercerizada. Archivo: liquidaciones_{nombresMeses[mes - 1].toLocaleLowerCase("es-AR")}_{anio}.zip</small></section>
        </aside>
      </div>
      {imprimiendo && <article className="liqui-print-document">
        <header className="liqui-print-heading">
          <p>LIQUIDACIÓN MENSUAL</p>
          <h1>{empresaPdf?.nombre}</h1>
          <span>{nombresMeses[mes - 1]} {anio}</span>
        </header>
        <div className="liqui-print-table-wrap"><table>
          <thead><tr><th>Concepto</th><th>Cantidad</th><th>Precio unitario</th><th>Subtotal</th></tr></thead>
          <tbody>{conceptosPdf.map((item) => <tr key={item.id}>
            <td>{item.nombre || "Concepto sin nombre"}</td>
            <td>{numero(item.cantidad)}</td>
            <td>{formatoMoneda.format(item.precio)}</td>
            <td className={item.tipo === "RESTA" ? "liqui-print-deduction" : undefined}>{item.tipo === "RESTA" ? "− " : ""}{formatoMoneda.format(item.cantidad * item.precio)}</td>
          </tr>)}</tbody>
        </table></div>
        {informacionPdf && <section className="liqui-print-extra"><h2>Información adicional</h2><p>{informacionPdf}</p></section>}
        <footer className="liqui-print-total"><span>Total</span><strong>{formatoMoneda.format(totalPdf)}</strong></footer>
      </article>}
    </section>
  );
}
