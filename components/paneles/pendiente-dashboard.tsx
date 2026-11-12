"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { PENDIENTE_CATEGORIAS, type PendienteCategoria, type PendienteRegistro } from "@/lib/pendientes-catalogo";
import { PageHeading } from "@/components/ui/page-heading";

const DAY_MS = 86_400_000;
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

function formatNumber(value: number) {
  return new Intl.NumberFormat("es-AR", { maximumFractionDigits: 0 }).format(value);
}

type ApiResponse = { registros?: PendienteRegistro[]; error?: string };

function chartPath(points: { x: number; y: number }[]) {
  return points.map((point, index) => `${index === 0 ? "M" : "L"}${point.x.toFixed(1)},${point.y.toFixed(1)}`).join(" ");
}

export function PendienteDashboard() {
  const [fecha, setFecha] = useState("");
  const [registros, setRegistros] = useState<PendienteRegistro[]>([]);
  const [cantidades, setCantidades] = useState<Record<PendienteCategoria, string>>(() => Object.fromEntries(PENDIENTE_CATEGORIAS.map(({ id }) => [id, "0"])) as Record<PendienteCategoria, string>);
  const [visibles, setVisibles] = useState<Set<PendienteCategoria>>(() => new Set(PENDIENTE_CATEGORIAS.map(({ id }) => id)));
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState("");
  const [error, setError] = useState("");

  const cargar = useCallback(async (dia: string) => {
    setCargando(true);
    setError("");
    try {
      const response = await fetch(`/api/pendientes?fecha=${encodeURIComponent(dia)}`, { cache: "no-store" });
      const body = await response.json() as ApiResponse;
      if (!response.ok) throw new Error(body.error ?? "No se pudo cargar el historial.");
      const nextRows = body.registros ?? [];
      setRegistros(nextRows);
      const paraElDia = Object.fromEntries(PENDIENTE_CATEGORIAS.map(({ id }) => [id, String(nextRows.find((row) => row.fecha === dia && row.categoria === id)?.cantidad ?? 0)])) as Record<PendienteCategoria, string>;
      setCantidades(paraElDia);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo cargar el historial.");
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => { setFecha(todayArgentina()); }, []);
  useEffect(() => { if (fecha) void cargar(fecha); }, [cargar, fecha]);

  const diario = useMemo(() => {
    const byDate = new Map<string, Partial<Record<PendienteCategoria, number>>>();
    for (const row of registros) {
      const day = byDate.get(row.fecha) ?? {};
      day[row.categoria] = row.cantidad;
      byDate.set(row.fecha, day);
    }
    return [...byDate.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([dia, values]) => ({ dia, values, total: PENDIENTE_CATEGORIAS.reduce((sum, category) => sum + (values[category.id] ?? 0), 0) }));
  }, [registros]);

  const chart = useMemo(() => {
    const chartEnd = fecha || "2000-01-01";
    const start = moveDay(chartEnd, -29);
    const days = Array.from({ length: 30 }, (_, index) => moveDay(start, index));
    const valuesByDay = new Map(diario.map((entry) => [entry.dia, entry.values]));
    const values = diario.flatMap((entry) => PENDIENTE_CATEGORIAS.map(({ id }) => entry.values[id] ?? 0));
    const max = Math.max(10, ...values);
    const step = Math.max(1, Math.ceil(max / 4 / 10) * 10);
    const yMax = step * 4;
    const plotWidth = CHART_WIDTH - CHART_MARGIN.left - CHART_MARGIN.right;
    const plotHeight = CHART_HEIGHT - CHART_MARGIN.top - CHART_MARGIN.bottom;
    const yTicks = Array.from({ length: 5 }, (_, index) => index * step);
    const series = PENDIENTE_CATEGORIAS.filter(({ id }) => visibles.has(id)).map((category) => {
      const points = days.flatMap((day, index) => {
        const value = valuesByDay.get(day)?.[category.id];
        if (typeof value !== "number") return [];
        return [{ dia: day, value, x: CHART_MARGIN.left + (index / (days.length - 1)) * plotWidth, y: CHART_MARGIN.top + plotHeight - (value / yMax) * plotHeight }];
      });
      return { ...category, points, path: chartPath(points) };
    });
    const xTicks = days.filter((_, index) => index % 5 === 0 || index === days.length - 1).map((day) => ({ dia: day, x: CHART_MARGIN.left + (days.indexOf(day) / (days.length - 1)) * plotWidth }));
    return { yTicks, yMax, plotHeight, plotWidth, series, xTicks };
  }, [diario, fecha, visibles]);

  const latest = diario.at(-1);
  const previous = diario.at(-2);
  const delta = latest && previous ? latest.total - previous.total : 0;
  const deltaPercent = latest && previous && previous.total > 0 ? (delta / previous.total) * 100 : 0;
  const categoryLeader = latest ? PENDIENTE_CATEGORIAS.reduce((best, item) => (latest.values[item.id] ?? 0) > (latest.values[best.id] ?? 0) ? item : best, PENDIENTE_CATEGORIAS[0]) : null;
  const historial = [...diario].reverse().slice(0, 6);

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
      await cargar(fecha);
      setMensaje("Registro guardado.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo guardar el registro.");
    } finally {
      setGuardando(false);
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
              <input type="number" min="0" step="1" inputMode="numeric" value={cantidades[category.id]} onChange={(event) => setCantidades((current) => ({ ...current, [category.id]: event.target.value }))} aria-label={category.label} />
            </label>
          ))}
          <button className="button button-primary pending-save-button" type="submit" disabled={guardando || cargando}>{guardando ? "Guardando…" : "Guardar registro"}</button>
        </div>
        <div className="pending-feedback" aria-live="polite">{error ? <span className="pending-error">{error}</span> : mensaje || "Al guardar, el registro de ese día se actualiza para todas las categorías."}</div>
      </form>

      <div className="pending-summary-grid">
        <article className="pending-summary-card panel"><span>Pendiente actual</span><strong>{latest ? formatNumber(latest.total) : "—"}</strong><small>{latest ? fullDate(latest.dia) : "Todavía no hay registros"}</small></article>
        <article className={`pending-summary-card panel${delta > 0 ? " is-up" : delta < 0 ? " is-down" : ""}`}><span>Cambio vs. día anterior</span><strong>{latest && previous ? `${delta > 0 ? "+" : ""}${formatNumber(delta)}` : "—"}</strong><small>{latest && previous ? `${delta > 0 ? "↑" : delta < 0 ? "↓" : "→"} ${Math.abs(deltaPercent).toLocaleString("es-AR", { maximumFractionDigits: 1 })}% respecto del registro anterior` : "Se calcula con dos registros"}</small></article>
        <article className="pending-summary-card panel"><span>Último registro</span><strong>{latest ? fullDate(latest.dia) : "—"}</strong><small>{diario.length} días cargados en el período</small></article>
        <article className="pending-summary-card panel"><span>Mayor pendiente</span><strong>{categoryLeader ? formatNumber(latest?.values[categoryLeader.id] ?? 0) : "—"}</strong><small>{categoryLeader?.label ?? "Sin categoría líder"}</small></article>
      </div>

      <section className="pending-chart-card panel" aria-labelledby="pending-chart-title">
        <header className="pending-chart-heading">
          <div><span className="pending-chart-icon" aria-hidden="true">⌁</span><div><h2 id="pending-chart-title">Evolución del pendiente</h2><p>Últimos 30 días{fecha ? ` hasta ${fullDate(fecha)}` : ""}</p></div></div>
          <span className="pending-chart-total">{latest ? `${formatNumber(latest.total)} pendientes` : "Sin datos todavía"}</span>
        </header>
        <div className="pending-legend" aria-label="Mostrar u ocultar categorías">
          {PENDIENTE_CATEGORIAS.map((category) => <button type="button" key={category.id} className={`pending-legend-item${visibles.has(category.id) ? " is-visible" : ""}`} aria-pressed={visibles.has(category.id)} onClick={() => alternarCategoria(category.id)}><i style={{ "--series-color": category.color } as React.CSSProperties} /><span>{category.label}</span></button>)}
        </div>
        {cargando ? <div className="pending-chart-state">Cargando historial…</div> : diario.length === 0 ? <div className="pending-chart-state">Guardá el primer registro para empezar a ver la evolución diaria.</div> : (
          <div className="pending-chart-scroll">
            <svg className="pending-chart" viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`} role="img" aria-label="Gráfico de líneas con la evolución diaria de pendientes por categoría durante los últimos 30 días">
              {chart.yTicks.map((tick) => {
                const y = CHART_MARGIN.top + chart.plotHeight - (tick / chart.yMax) * chart.plotHeight;
                return <g key={tick}><line className="pending-chart-grid" x1={CHART_MARGIN.left} x2={CHART_WIDTH - CHART_MARGIN.right} y1={y} y2={y} /><text className="pending-chart-label" x={CHART_MARGIN.left - 10} y={y + 4} textAnchor="end">{formatNumber(tick)}</text></g>;
              })}
              {chart.xTicks.map((tick) => <g key={tick.dia}><line className="pending-chart-grid pending-chart-grid-vertical" x1={tick.x} x2={tick.x} y1={CHART_MARGIN.top} y2={CHART_HEIGHT - CHART_MARGIN.bottom} /><text className="pending-chart-label" x={tick.x} y={CHART_HEIGHT - 15} textAnchor="middle">{shortDate(tick.dia)}</text></g>)}
              {chart.series.map((series) => <g key={series.id}>
                {series.points.length > 1 ? <path className="pending-chart-line" d={series.path} style={{ "--series-color": series.color } as React.CSSProperties} /> : null}
                {series.points.map((point) => <circle key={point.dia} className="pending-chart-point" cx={point.x} cy={point.y} r="3.2" style={{ "--series-color": series.color } as React.CSSProperties}><title>{`${series.label} · ${fullDate(point.dia)}: ${formatNumber(point.value)}`}</title></circle>)}
              </g>)}
            </svg>
          </div>
        )}
      </section>

      <section className="pending-history panel" aria-labelledby="pending-history-title">
        <header><div><h2 id="pending-history-title">Historial por día</h2><p>Se conserva la carga de cada fecha; si la volvés a guardar, se reemplaza ese registro.</p></div><span>{historial.length} registros</span></header>
        <div className="pending-table-wrap">
          <table><thead><tr><th scope="col">Día</th>{PENDIENTE_CATEGORIAS.map(({ id, label }) => <th scope="col" key={id}>{label}</th>)}<th scope="col">Total</th><th scope="col">Variación</th></tr></thead>
            <tbody>{historial.length ? historial.map((entry) => {
              const index = diario.findIndex((item) => item.dia === entry.dia);
              const anterior = index > 0 ? diario[index - 1] : null;
              const variacion = anterior ? entry.total - anterior.total : null;
              const porcentaje = anterior && anterior.total > 0 && variacion !== null ? (variacion / anterior.total) * 100 : null;
              return <tr key={entry.dia}><th scope="row">{fullDate(entry.dia)}</th>{PENDIENTE_CATEGORIAS.map(({ id }) => <td key={id}>{formatNumber(entry.values[id] ?? 0)}</td>)}<td className="pending-table-total">{formatNumber(entry.total)}</td><td><span className={`pending-variation${variacion === null ? "" : variacion < 0 ? " is-down" : variacion > 0 ? " is-up" : " is-flat"}`}>{variacion === null ? "—" : <>{variacion < 0 ? "↓" : variacion > 0 ? "↑" : "→"} {variacion > 0 ? "+" : ""}{formatNumber(variacion)}{porcentaje === null ? "" : ` (${porcentaje > 0 ? "+" : ""}${porcentaje.toLocaleString("es-AR", { maximumFractionDigits: 1 })}%)`}</>}</span></td></tr>;
            }) : <tr><td colSpan={PENDIENTE_CATEGORIAS.length + 3} className="pending-table-empty">Todavía no hay registros cargados.</td></tr>}</tbody>
          </table>
        </div>
      </section>
    </section>
  );
}
