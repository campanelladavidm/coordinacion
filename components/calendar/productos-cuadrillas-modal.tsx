"use client";

import { useEffect, useMemo, useState } from "react";

const PRODUCTOS = [
  { key: "fibra", label: "Fibra" },
  { key: "wireless", label: "Wireless" },
  { key: "fibra_iptv", label: "Fibra + IPTV" },
  { key: "wireless_iptv", label: "Wireless + IPTV" },
  { key: "insitu", label: "Insitu" },
  { key: "gamer", label: "Gamer" },
  { key: "home_max", label: "Home max" },
] as const;

type ProductoKey = typeof PRODUCTOS[number]["key"];
type CuadrillaProducto = { id: string; nombre: string; orden: number } & Record<`producto_${ProductoKey}`, boolean>;

function normalizar(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLocaleLowerCase("es-AR");
}

export function ProductosCuadrillasModal({ open, onClose, contextUserId }: { open: boolean; onClose: () => void; contextUserId?: string }) {
  const [cuadrillas, setCuadrillas] = useState<CuadrillaProducto[]>([]);
  const [canEdit, setCanEdit] = useState(false);
  const [busqueda, setBusqueda] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [guardando, setGuardando] = useState<Set<string>>(new Set());
  const [guardado, setGuardado] = useState(false);

  useEffect(() => {
    if (!open) return;
    const cerrarConEscape = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", cerrarConEscape);
    return () => window.removeEventListener("keydown", cerrarConEscape);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    const cargar = async () => {
      setLoading(true); setError(""); setGuardado(false);
      try {
        const response = await fetch("/api/productos-cuadrillas", { cache: "no-store", headers: contextUserId ? { "x-user-context": contextUserId } : {} });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error ?? "No se pudieron cargar las cuadrillas.");
        setCuadrillas(data.cuadrillas ?? []); setCanEdit(Boolean(data.canEdit));
      } catch (cause) { setError(cause instanceof Error ? cause.message : "No se pudieron cargar las cuadrillas."); }
      finally { setLoading(false); }
    };
    void cargar();
  }, [open, contextUserId]);

  const productosBuscados = useMemo(() => {
    const query = normalizar(busqueda);
    return query.length >= 2 ? PRODUCTOS.filter((producto) => normalizar(producto.label).includes(query)) : [];
  }, [busqueda]);

  const resultados = useMemo(() => {
    const query = normalizar(busqueda);
    if (!query) return cuadrillas;
    if (productosBuscados.length) return cuadrillas.filter((item) => productosBuscados.some((producto) => item[`producto_${producto.key}`]));
    return cuadrillas.filter((item) => normalizar(item.nombre).includes(query));
  }, [busqueda, cuadrillas, productosBuscados]);

  async function cambiar(cuadrilla: CuadrillaProducto, producto: ProductoKey, checked: boolean) {
    if (!canEdit) return;
    const columna = `producto_${producto}` as const;
    const anterior = cuadrilla[columna];
    const llave = `${cuadrilla.id}:${producto}`;
    setError(""); setGuardado(false);
    setCuadrillas((actuales) => actuales.map((item) => item.id === cuadrilla.id ? { ...item, [columna]: checked } : item));
    setGuardando((actual) => new Set(actual).add(llave));
    try {
      const response = await fetch("/api/productos-cuadrillas", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...(contextUserId ? { "x-user-context": contextUserId } : {}) },
        body: JSON.stringify({ cuadrillaId: cuadrilla.id, producto, checked }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "No se pudo guardar el cambio.");
      setGuardado(true);
    } catch (cause) {
      setCuadrillas((actuales) => actuales.map((item) => item.id === cuadrilla.id ? { ...item, [columna]: anterior } : item));
      setError(cause instanceof Error ? cause.message : "No se pudo guardar el cambio.");
    } finally { setGuardando((actual) => { const next = new Set(actual); next.delete(llave); return next; }); }
  }

  if (!open) return null;
  return <div className="crew-products-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section className="crew-products-modal" role="dialog" aria-modal="true" aria-labelledby="crew-products-title">
      <header className="crew-products-heading"><div><p className="eyebrow">CONFIGURACIÓN DE CUADRILLAS</p><h2 id="crew-products-title">Productos y cuadrillas</h2><p>Marcá qué productos puede instalar cada cuadrilla.</p></div><button type="button" className="radar-close" aria-label="Cerrar" onClick={onClose}>×</button></header>
      <div className="crew-products-content">
        <label className="crew-products-search"><span aria-hidden="true">⌕</span><input type="search" value={busqueda} onChange={(event) => setBusqueda(event.target.value)} placeholder="Buscar producto o cuadrilla…" aria-label="Buscar producto o cuadrilla"/><span className="crew-products-search-clear">{busqueda && <button type="button" aria-label="Limpiar búsqueda" onClick={() => setBusqueda("")}>×</button>}</span></label>
        <div className="crew-products-result-line"><span>{busqueda ? productosBuscados.length ? `Cuadrillas habilitadas para ${productosBuscados.map((producto) => producto.label).join(" o ")}` : `Coincidencias para “${busqueda}”` : "Productos habilitados por cuadrilla"}</span><strong>{resultados.length} {resultados.length === 1 ? "cuadrilla" : "cuadrillas"}</strong></div>
        {error && <p className="crew-products-error" role="alert">{error}</p>}
        {loading ? <div className="crew-products-empty">Cargando cuadrillas…</div> : resultados.length === 0 ? <div className="crew-products-empty">{cuadrillas.length ? "No hay cuadrillas que coincidan con la búsqueda." : "Todavía no hay cuadrillas activas."}</div> : <div className="crew-products-table-wrap"><table className="crew-products-table"><thead><tr><th scope="col">Cuadrilla</th>{PRODUCTOS.map((producto) => <th scope="col" key={producto.key}>{producto.label}</th>)}</tr></thead><tbody>{resultados.map((cuadrilla) => <tr key={cuadrilla.id}><th scope="row">{cuadrilla.nombre}</th>{PRODUCTOS.map((producto) => {
          const columna = `producto_${producto.key}` as const;
          const llave = `${cuadrilla.id}:${producto.key}`;
          return <td key={producto.key}><input className="crew-product-checkbox" type="checkbox" checked={Boolean(cuadrilla[columna])} disabled={!canEdit || guardando.has(llave)} aria-label={`${cuadrilla.nombre}: ${producto.label}`} onChange={(event) => void cambiar(cuadrilla, producto.key, event.target.checked)}/></td>;
        })}</tr>)}</tbody></table></div>}
      </div>
      <footer className="crew-products-footer"><span className={error ? "crew-products-save-error" : "crew-products-save-state"}><i />{error ? "No se pudo guardar" : guardando.size ? "Guardando…" : guardado ? "Guardado automáticamente" : canEdit ? "Los cambios se guardan automáticamente" : "Solo Supervisor y Jefatura pueden editar"}</span><button type="button" className="button button-ghost" onClick={onClose}>Cerrar</button></footer>
    </section>
  </div>;
}
