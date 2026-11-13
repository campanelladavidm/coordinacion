"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { PENDIENTE_CATEGORIAS, type PendienteCategoria, type PendienteRegistro } from "@/lib/pendientes-catalogo";
import { PageHeading } from "@/components/ui/page-heading";

const DAY_MS = 86_400_000;
const FIRST_PENDING_CHART_DAY = "2026-11-13";
const CHART_WIDTH = 1000;
const CHART_HEIGHT = 330;
const CHART_MARGIN = { top: 18, right: 18, bottom: 46, left: 52 };

function todayArgentina() {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Argentina/Buenos_Aires", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  const get = (key: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === key)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

function moveDay(isoDate: string, offset: number) {
  const date = new Date(`${isoDate}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + offset);
  return date.toISOString().slice(0, 10);
}

function shortDate(isoDate: string) {
  const [, month, day] = isoDate.split("-");
  return `${day}/${month}`;
}

function fullDate(isoDate: string) {
  return new Intl.DateTimeFormat("es-AR", { dateStyle: "medium", timeZone: "UTC" }).format(new Date(`${isoDate}T00:00:00.000Z`));
}

function tooltipDate(isoDate: string) {
  const value = new Intl.DateTimeFormat("es-AR", { weekday: "long", day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC" }).format(new Date(`${isoDate}T00:00:00.000Z`));
  return `${value.charAt(0).toLocaleUpperCase("es-AR")}${value.slice(1).replace(", ", " ")}`;
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("es-AR", { maximumFractionDigits: 0 }).format(value);
}

function variacionPorcentual(actual: number, anterior: number | undefined) {
  if (anterior === undefined) return null;
  if (anterior === 0) return actual === 0 ? { texto: "→ 0%", clase: "is-flat" } : { texto: "↑ Nuevo", clase: "is-up" };
  const cambio = actual - anterior;
  const porcentaje = Math.abs(cambio / anterior * 100).toLocaleString("es-AR", { maximumFractionDigits: 1 });
  return {
    texto: `${cambio > 0 ? "↑" : cambio < 0 ? "↓" : "→"} ${porcentaje}%`,
    clase: cambio > 0 ? "is-up" : cambio < 0 ? "is-down" : "is-flat",
  };
}

type ApiResponse = { registros?: PendienteRegistro[]; ultimaFechaConRegistro?: string | null; error?: string };
type ChartTooltipState = { dia: string; x: number; y: number; ancho: number; alto: number };

function chartPath(points: { x: number; y: number }[]) {
  return points.map((point, index) => `${index === 0 ? "M" : "L"}${point.x.toFixed(1)},${point.y.toFixed(1)}`).join(" ");
}

export function PendienteDashboard() {
  const [fecha, setFecha] = useState("");
  const [hoy, setHoy] = useState("");
  const [ultimaFechaConRegistro, setUltimaFechaConRegistro] = useState("");
  const [registros, setRegistros] = useState<PendienteRegistro[]>([]);
  const [cantidades, setCantidades] = useState<Record<PendienteCategoria, string>>(() => Object.fromEntries(PENDIENTE_CATEGORIAS.map(({ id }) => [id, ""])) as Record<PendienteCategoria, string>);
  const [visibles, setVisibles] = useState<Set<PendienteCategoria>>(() => new Set(PENDIENTE_CATEGORIAS.map(({ id }) => id)));
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [eliminandoFecha, setEliminandoFecha] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [error, setError] = useState("");
  const [tooltip, setTooltip] = useState<ChartTooltipState | null>(null);
  const chartFrameRef = useRef<HTMLDivElement>(null);

  const cargar = useCallback(async (dia: string, desde: string, hasta: string) => {
    setCargando(true);
    setError("");
    try {
      const params = new URLSearchParams({ fecha: dia, desde, hasta });
      const response = await fetch(`/api/pendientes?${params}`, { cache: "no-store" });
      const body = await response.json() as ApiResponse;
      if (!response.ok) throw new Error(body.error ?? "No se pudo cargar el historial.");
      const nextRows = body.registros ?? [];
      setRegistros(nextRows);
      setUltimaFechaConRegistro(body.ultimaFechaConRegistro ?? "");
      const paraElDia = Object.fromEntries(PENDIENTE_CATEGORIAS.map(({ id }) => {
        const registro = nextRows.find((row) => row.fecha === dia && row.categoria === id);
        return [id, registro ? String(registro.cantidad) : ""];
      })) as Record<PendienteCategoria, string>;
      setCantidades(paraElDia);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo cargar el historial.");
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    const actualizarHoy = () => setHoy(todayArgentina());
    actualizarHoy();
    const timer = window.setInterval(actualizarHoy, 60_000);
    return () => window.clearInterval(timer);
  }, []);
  useEffect(() => { if (hoy) setFecha((actual) => actual || hoy); }, [hoy]);
  const chartEnd = [hoy, ultimaFechaConRegistro, FIRST_PENDING_CHART_DAY].filter(Boolean).sort().at(-1) ?? FIRST_PENDING_CHART_DAY;
  const candidateChartStart = moveDay(chartEnd, -29);
  const chartStart = candidateChartStart < FIRST_PENDING_CHART_DAY ? FIRST_PENDING_CHART_DAY : candidateChartStart;
  const chartDayCount = Math.floor((new Date(`${chartEnd}T00:00:00.000Z`).getTime() - new Date(`${chartStart}T00:00:00.000Z`).getTime()) / DAY_MS) + 1;
  const dataStart = chartStart;
  useEffect(() => { if (fecha && hoy) void cargar(fecha, dataStart, chartEnd); }, [cargar, fecha, hoy, dataStart, chartEnd]);

  const diario = useMemo(() => {
    const byDate = new Map<string, Partial<Record<PendienteCategoria, number>>>();
    for (const row of registros) {
      const day = byDate.get(row.fecha) ?? {};
      day[row.categoria] = row.cantidad;
      byDate.set(row.fecha, day);
    }
    return [...byDate.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([dia, values]) => ({ dia, values, total: PENDIENTE_CATEGORIAS.reduce((sum, category) => sum + (values[category.id] ?? 0), 0) }));
  }, [registros]);

  const diarioPeriodo = diario.filter((entry) => entry.dia >= dataStart && entry.dia <= chartEnd);

  const chart = useMemo(() => {
    const days = Array.from({ length: chartDayCount }, (_, index) => moveDay(chartStart, index));
    const valuesByDay = new Map(diario.map((entry) => [entry.dia, entry.values]));
    const values = days.flatMap((day) => PENDIENTE_CATEGORIAS.map(({ id }) => valuesByDay.get(day)?.[id] ?? 0));
    const max = Math.max(10, ...values);
    const step = Math.max(1, Math.ceil(max / 4 / 10) * 10);
    const yMax = step * 4;
    const plotWidth = CHART_WIDTH - CHART_MARGIN.left - CHART_MARGIN.right;
    const plotHeight = CHART_HEIGHT - CHART_MARGIN.top - CHART_MARGIN.bottom;
    const xPosition = (index: number) => CHART_MARGIN.left + (days.length === 1 ? 0.5 : index / (days.length - 1)) * plotWidth;
    const yTicks = Array.from({ length: 5 }, (_, index) => index * step);
    const series = PENDIENTE_CATEGORIAS.filter(({ id }) => visibles.has(id)).map((category) => {
      const points = days.flatMap((day, index) => {
        const value = valuesByDay.get(day)?.[category.id];
        if (typeof value !== "number") return [];
        return [{ dia: day, value, x: xPosition(index), y: CHART_MARGIN.top + plotHeight - (value / yMax) * plotHeight }];
      });
      return { ...category, points, path: chartPath(points) };
    });
    const xTicks = days.map((day, index) => ({ dia: day, x: xPosition(index), showGrid: index % 5 === 0 }));
    return { yTicks, yMax, plotHeight, plotWidth, series, xTicks };
  }, [diario, chartStart, chartDayCount, visibles]);

  const latest = diarioPeriodo.at(-1);
  const previous = diarioPeriodo.at(-2);
  const delta = latest && previous ? latest.total - previous.total : 0;
  const deltaPercent = latest && previous && previous.total > 0 ? (delta / previous.total) * 100 : 0;
  const categoryLeader = latest ? PENDIENTE_CATEGORIAS.reduce((best, item) => (latest.values[item.id] ?? 0) > (latest.values[best.id] ?? 0) ? item : best, PENDIENTE_CATEGORIAS[0]) : null;
  const historial = [...diarioPeriodo].reverse();

  function mostrarTooltip(event: React.PointerEvent<SVGSVGElement>) {
    const svg = event.currentTarget;
    const svgBounds = svg.getBoundingClientRect();
    const frameBounds = chartFrameRef.current?.getBoundingClientRect();
    if (!frameBounds || !svgBounds.width || !svgBounds.height) return;
    const graphX = ((event.clientX - svgBounds.left) / svgBounds.width) * CHART_WIDTH;
    const graphY = ((event.clientY - svgBounds.top) / svgBounds.height) * CHART_HEIGHT;
    const plotRight = CHART_WIDTH - CHART_MARGIN.right;
    const plotBottom = CHART_HEIGHT - CHART_MARGIN.bottom;
    if (graphX < CHART_MARGIN.left || graphX > plotRight || graphY < CHART_MARGIN.top || graphY > plotBottom) {
      setTooltip(null);
      return;
    }
    const position = (graphX - CHART_MARGIN.left) / Math.max(1, chart.plotWidth);
    const index = chartDayCount === 1 ? 0 : Math.max(0, Math.min(chartDayCount - 1, Math.round(position * (chartDayCount - 1))));
    const dia = moveDay(chartStart, index);
    if (!registros.some((row) => row.fecha === dia)) {
      setTooltip(null);
      return;
    }
    setTooltip((current) => current?.dia === dia ? current : {
      dia,
      x: event.clientX - frameBounds.left,
      y: event.clientY - frameBounds.top,
      ancho: frameBounds.width,
      alto: frameBounds.height,
    });
  }

  const registroTooltip = tooltip ? diario.find((entry) => entry.dia === tooltip.dia) : undefined;
  const valoresTooltip = registroTooltip ? PENDIENTE_CATEGORIAS
    .filter((category) => visibles.has(category.id))
    .map((category) => ({ ...category, cantidad: registroTooltip.values[category.id] ?? 0 }))
    .sort((a, b) => b.cantidad - a.cantidad) : [];
  const totalTooltip = valoresTooltip.reduce((sum, category) => sum + category.cantidad, 0);
  const tooltipWidth = tooltip ? Math.min(340, tooltip.ancho - 16) : 0;
  const tooltipLeft = tooltip ? Math.max(8, Math.min(tooltip.x + 16, tooltip.ancho - tooltipWidth - 8)) : 0;
  const tooltipTop = tooltip ? Math.max(8, Math.min(tooltip.y - 150, tooltip.alto - 330)) : 0;

  async function guardar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setGuardando(true);
    setError("");
    setMensaje("");
    const parsed = Object.fromEntries(PENDIENTE_CATEGORIAS.map(({ id }) => [id, Number(cantidades[id])])) as Record<PendienteCategoria, number>;
    if (Object.values(parsed).some((value) => !Number.isSafeInteger(value) || value < 0)) {
      setGuardando(false);
      setError("Ingresá cantidades enteras iguales o mayores a cero.");
      return;
    }
    try {
      const response = await fetch("/api/pendientes", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ fecha, cantidades: parsed }) });
      const body = await response.json() as { error?: string };
      if (!response.ok) throw new Error(body.error ?? "No se pudo guardar el registro.");
      await cargar(fecha, dataStart, chartEnd);
      setMensaje("Registro guardado.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo guardar el registro.");
    } finally {
      setGuardando(false);
    }
  }

  async function eliminarRegistro(dia: string) {
    if (!window.confirm(`¿Eliminar el registro del ${fullDate(dia)}? Se borrarán todas las categorías cargadas para ese día.`)) return;
    setEliminandoFecha(dia);
    setError("");
    setMensaje("");
    try {
      const response = await fetch("/api/pendientes", { method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify({ fecha: dia }) });
      const body = await response.json() as { error?: string };
      if (!response.ok) throw new Error(body.error ?? "No se pudo eliminar el registro.");
      await cargar(fecha, dataStart, chartEnd);
      setMensaje(`Se eliminó el registro del ${fullDate(dia)}.`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo eliminar el registro.");
    } finally {
      setEliminandoFecha("");
    }
  }

  function alternarCategoria(id: PendienteCategoria) {
    setVisibles((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  return (
    <section className="pending-page">
      <PageHeading eyebrow="INDICADORES · DASH" title="Pendiente" description="Seguimiento diario de trabajos pendientes por categoría." />

      <form className="pending-entry panel" onSubmit={(event) => void guardar(event)}>
        <div className="pending-entry-heading">
          <div><span className="pending-entry-icon" aria-hidden="true">＋</span><h2>Cargar pendiente</h2></div>
          <label className="pending-date-field">Día<input type="date" value={fecha} onChange={(event) => { if (event.target.value) setFecha(event.target.value); }} required /></label>
        </div>
        <div className="pending-category-fields">
          {PENDIENTE_CATEGORIAS.map((category) => (
            <label className="pending-value-field" key={category.id}>
              <span title={category.label}>{category.label}</span>
              <input type="text" inputMode="numeric" pattern="[0-9]*" value={cantidades[category.id]} onChange={(event) => setCantidades((current) => ({ ...current, [category.id]: event.target.value }))} aria-label={category.label} />
            </label>
          ))}
          <button className="button button-primary pending-save-button" type="submit" disabled={guardando || cargando}>{guardando ? "Guardando…" : "Guardar registro"}</button>
        </div>
        <div className="pending-feedback" aria-live="polite">{error ? <span className="pending-error">{error}</span> : mensaje || "Al guardar, el registro de ese día se actualiza para todas las categorías."}</div>
      </form>

      <div className="pending-summary-grid">
        <article className="pending-summary-card panel"><span>Pendiente actual</span><strong>{latest ? formatNumber(latest.total) : "—"}</strong><small>{latest ? fullDate(latest.dia) : "Todavía no hay registros"}</small></article>
        <article className={`pending-summary-card panel${delta > 0 ? " is-up" : delta < 0 ? " is-down" : ""}`}><span>Cambio vs. día anterior</span><strong>{latest && previous ? `${delta > 0 ? "+" : ""}${formatNumber(delta)}` : "—"}</strong><small>{latest && previous ? `${delta > 0 ? "↑" : delta < 0 ? "↓" : "→"} ${Math.abs(deltaPercent).toLocaleString("es-AR", { maximumFractionDigits: 1 })}% respecto del registro anterior` : "Se calcula con dos registros"}</small></article>
        <article className="pending-summary-card panel"><span>Último registro</span><strong>{latest ? fullDate(latest.dia) : "—"}</strong><small>{diarioPeriodo.length} días cargados en el período</small></article>
        <article className="pending-summary-card panel"><span>Mayor pendiente</span><strong>{categoryLeader ? formatNumber(latest?.values[categoryLeader.id] ?? 0) : "—"}</strong><small>{categoryLeader?.label ?? "Sin categoría líder"}</small></article>
      </div>

      <section className="pending-chart-card panel" aria-labelledby="pending-chart-title">
        <header className="pending-chart-heading">
          <div><span className="pending-chart-icon" aria-hidden="true">⌁</span><div><h2 id="pending-chart-title">Evolución del pendiente</h2><p>{chartDayCount < 30 ? `${chartDayCount} de 30 días · desde ${fullDate(chartStart)}` : `Últimos 30 días · ${fullDate(chartStart)} al ${fullDate(chartEnd)}`}</p></div></div>
          <span className="pending-chart-total">{latest ? `${formatNumber(latest.total)} pendientes` : "Sin datos todavía"}</span>
        </header>
        <div className="pending-legend" aria-label="Mostrar u ocultar categorías">
          {PENDIENTE_CATEGORIAS.map((category) => <button type="button" key={category.id} className={`pending-legend-item${visibles.has(category.id) ? " is-visible" : ""}`} aria-pressed={visibles.has(category.id)} onClick={() => alternarCategoria(category.id)}><i style={{ "--series-color": category.color } as React.CSSProperties} /><span>{category.label}</span></button>)}
        </div>
        {cargando ? <div className="pending-chart-state">Cargando historial…</div> : (
          <div className="pending-chart-frame" ref={chartFrameRef} onPointerLeave={() => setTooltip(null)}>
            <div className="pending-chart-scroll">
            <svg className="pending-chart" viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`} role="img" aria-label="Gráfico de líneas de pendientes por categoría; pasá el cursor sobre un día para ver el detalle" onPointerMove={mostrarTooltip}>
              {chart.yTicks.map((tick) => {
                const y = CHART_MARGIN.top + chart.plotHeight - (tick / chart.yMax) * chart.plotHeight;
                return <g key={tick}><line className="pending-chart-grid" x1={CHART_MARGIN.left} x2={CHART_WIDTH - CHART_MARGIN.right} y1={y} y2={y} /><text className="pending-chart-label" x={CHART_MARGIN.left - 10} y={y + 4} textAnchor="end">{formatNumber(tick)}</text></g>;
              })}
              {chart.xTicks.map((tick) => <g key={tick.dia}>{tick.showGrid && <line className="pending-chart-grid pending-chart-grid-vertical" x1={tick.x} x2={tick.x} y1={CHART_MARGIN.top} y2={CHART_HEIGHT - CHART_MARGIN.bottom} />}<text className="pending-chart-label" x={tick.x} y={CHART_HEIGHT - 15} textAnchor="middle">{shortDate(tick.dia)}</text></g>)}
              {chart.series.map((series) => <g key={series.id}>
                {series.points.length > 1 ? <path className="pending-chart-line" d={series.path} style={{ "--series-color": series.color } as React.CSSProperties} /> : null}
                {series.points.map((point) => <circle key={point.dia} className="pending-chart-point" cx={point.x} cy={point.y} r="3.2" style={{ "--series-color": series.color } as React.CSSProperties} />)}
              </g>)}
              {!chart.series.some((series) => series.points.length) && <text className="pending-chart-label" x={CHART_MARGIN.left + chart.plotWidth / 2} y={CHART_MARGIN.top + chart.plotHeight / 2} textAnchor="middle">Todavía no hay registros en este período.</text>}
            </svg>
            </div>
            {tooltip && registroTooltip && <div className="pending-chart-tooltip" role="tooltip" style={{ left: tooltipLeft, top: tooltipTop, width: tooltipWidth }}>
              <h3>{tooltipDate(tooltip.dia)}</h3>
              <div className="pending-chart-tooltip-rows">{valoresTooltip.map((category) => <div className="pending-chart-tooltip-row" key={category.id}>
                <span><i style={{ "--series-color": category.color } as React.CSSProperties} />{category.label}</span>
                <strong><span>{formatNumber(category.cantidad)}</span><small>({(totalTooltip > 0 ? category.cantidad / totalTooltip * 100 : 0).toLocaleString("es-AR", { maximumFractionDigits: 1 })}%)</small></strong>
              </div>)}</div>
              <footer><span>Total visible</span><strong>{formatNumber(totalTooltip)}</strong></footer>
            </div>}
          </div>
        )}
      </section>

      <section className="pending-history panel" aria-labelledby="pending-history-title">
        <header><div><h2 id="pending-history-title">Historial por día</h2><p>Se conserva la carga de cada fecha; si la volvés a guardar, se reemplaza ese registro.</p></div><span>{historial.length} registros</span></header>
        <div className="pending-table-wrap">
          <table><thead><tr><th scope="col">Día</th>{PENDIENTE_CATEGORIAS.map(({ id, label }) => <th scope="col" key={id}>{label}</th>)}<th scope="col">Total</th><th scope="col">Variación</th><th scope="col">Acciones</th></tr></thead>
            <tbody>{historial.length ? historial.map((entry) => {
              const index = diarioPeriodo.findIndex((item) => item.dia === entry.dia);
              const anterior = index > 0 ? diarioPeriodo[index - 1] : null;
              const variacion = anterior ? entry.total - anterior.total : null;
              const porcentaje = anterior && anterior.total > 0 && variacion !== null ? (variacion / anterior.total) * 100 : null;
              return <tr key={entry.dia}><th scope="row">{fullDate(entry.dia)}</th>{PENDIENTE_CATEGORIAS.map(({ id }) => {
                const cantidad = entry.values[id] ?? 0;
                const cambioCategoria = variacionPorcentual(cantidad, anterior ? anterior.values[id] ?? 0 : undefined);
                const colorCambio = cambioCategoria?.clase === "is-down" ? "#18845b" : cambioCategoria?.clase === "is-up" ? "#c7434b" : undefined;
                return <td className="pending-category-value-cell" key={id}><span>{formatNumber(cantidad)}</span><small className={`pending-category-change ${cambioCategoria?.clase ?? "is-flat"}`} style={colorCambio ? { color: colorCambio } : undefined}>{cambioCategoria ? `(${cambioCategoria.texto})` : "—"}</small></td>;
              })}<td className="pending-table-total">{formatNumber(entry.total)}</td><td><span className={`pending-variation${variacion === null ? "" : variacion < 0 ? " is-down" : variacion > 0 ? " is-up" : " is-flat"}`}>{variacion === null ? "—" : <>{variacion < 0 ? "↓" : variacion > 0 ? "↑" : "→"} {variacion > 0 ? "+" : ""}{formatNumber(variacion)}{porcentaje === null ? "" : ` (${porcentaje > 0 ? "+" : ""}${porcentaje.toLocaleString("es-AR", { maximumFractionDigits: 1 })}%)`}</>}</span></td><td><button className="pending-delete-button" type="button" aria-label={`Eliminar registro del ${fullDate(entry.dia)}`} title="Eliminar registro del día" disabled={eliminandoFecha === entry.dia} onClick={() => void eliminarRegistro(entry.dia)}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M9 7V4h6v3m3 0-.8 13H6.8L6 7m4 4v6m4-6v6" /></svg></button></td></tr>;
            }) : <tr><td colSpan={PENDIENTE_CATEGORIAS.length + 4} className="pending-table-empty">Todavía no hay registros cargados.</td></tr>}</tbody>
          </table>
        </div>
      </section>
    </section>
  );
}
