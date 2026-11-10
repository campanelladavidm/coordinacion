"use client";

import { useEffect, useState, type FormEvent } from "react";
import { createClient } from "@/lib/supabase/client";

type ModeloEquipo = { id: string; modelo: string; precio_unitario: number; orden: number };
const moneda = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 2 });

function normalizar(texto: string) {
  return texto.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLocaleLowerCase("es");
}

export function ModelosEquipoManager() {
  const [modelos, setModelos] = useState<ModeloEquipo[]>([]);
  const [modelo, setModelo] = useState("");
  const [precio, setPrecio] = useState("");
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState("");

  async function cargar() {
    setCargando(true);
    const { data, error } = await createClient().from("modelos_equipo").select("id,modelo,precio_unitario,orden").eq("activo", true).order("orden").order("modelo");
    if (error) setMensaje("No se pudo cargar la lista. Verificá que la migración de modelos de equipo esté aplicada en Supabase.");
    else {
      setModelos(data ?? []);
      setMensaje("");
    }
    setCargando(false);
  }

  useEffect(() => { void cargar(); }, []);

  function editar(item: ModeloEquipo) {
    setEditandoId(item.id);
    setModelo(item.modelo);
    setPrecio(String(item.precio_unitario));
    setMensaje("");
  }

  function cancelar() {
    setEditandoId(null);
    setModelo("");
    setPrecio("");
    setMensaje("");
  }

  async function guardar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nombre = modelo.trim();
    const importe = Number(precio.trim().replace(",", "."));
    if (!nombre || nombre.length > 120) {
      setMensaje("Ingresá un modelo de hasta 120 caracteres.");
      return;
    }
    if (!Number.isFinite(importe) || importe < 0) {
      setMensaje("Ingresá un precio unitario válido, igual o mayor a cero.");
      return;
    }
    if (modelos.some((item) => item.id !== editandoId && normalizar(item.modelo) === normalizar(nombre))) {
      setMensaje("Ya existe un modelo con ese nombre.");
      return;
    }

    setGuardando(true);
    setMensaje("");
    const anterior = modelos.find((item) => item.id === editandoId);
    const { error } = await createClient().from("modelos_equipo").upsert({
      ...(editandoId ? { id: editandoId } : {}),
      modelo: nombre,
      precio_unitario: importe,
      activo: true,
      orden: anterior?.orden ?? (modelos.length + 1) * 10,
    }, { onConflict: "id" });
    if (error) setMensaje(error.code === "23505" ? "Ya existe un modelo con ese nombre." : "No se pudo guardar. Verificá la conexión e intentá de nuevo.");
    else {
      cancelar();
      await cargar();
    }
    setGuardando(false);
  }

  async function desactivar(item: ModeloEquipo) {
    setGuardando(true);
    const { error } = await createClient().from("modelos_equipo").update({ activo: false }).eq("id", item.id);
    if (error) setMensaje("No se pudo quitar el modelo. Intentá de nuevo.");
    else {
      if (editandoId === item.id) cancelar();
      await cargar();
    }
    setGuardando(false);
  }

  return (
    <div className="catalog-manager grid gap-4">
      <form className="modelos-equipo-form panel grid gap-3 p-5 sm:grid-cols-[minmax(0,1fr)_220px_auto] sm:items-end" onSubmit={(event) => void guardar(event)}>
        <label className="form-field mt-0">{editandoId ? "Modelo de equipo" : "Nuevo modelo de equipo"}
          <input value={modelo} onChange={(event) => setModelo(event.target.value)} maxLength={120} required placeholder="Ej.: Router WiFi 6" />
        </label>
        <label className="form-field mt-0">Precio unitario
          <input type="text" inputMode="decimal" value={precio} onChange={(event) => setPrecio(event.target.value)} required placeholder="0,00" aria-label="Precio unitario" />
        </label>
        <div className="flex gap-2">
          <button className="button button-primary" type="submit" disabled={guardando}>{guardando ? "Guardando…" : editandoId ? "Guardar cambios" : "Agregar modelo"}</button>
          {editandoId && <button className="button" type="button" onClick={cancelar} disabled={guardando}>Cancelar</button>}
        </div>
        {mensaje && <p className="modelos-equipo-message m-0 text-xs sm:col-span-full" role="status">{mensaje}</p>}
      </form>

      <section className="panel overflow-hidden">
        <header className="modelos-equipo-header">
          <h2>Modelos disponibles</h2>
          <span>{modelos.length}</span>
        </header>
        {cargando ? <p className="modelos-equipo-state">Cargando modelos…</p>
          : modelos.length ? <ul className="modelos-equipo-list">
            {modelos.map((item) => <li className="modelos-equipo-row" key={item.id}>
              <div className="min-w-0"><strong>{item.modelo}</strong><span>{moneda.format(item.precio_unitario)} por unidad</span></div>
              <div className="flex shrink-0 gap-2">
                <button className="button button-small" type="button" disabled={guardando} onClick={() => editar(item)}>Editar</button>
                <button className="button button-small border-rose-900/70 text-rose-300 disabled:cursor-not-allowed disabled:opacity-40" type="button" disabled={guardando} onClick={() => void desactivar(item)}>Quitar</button>
              </div>
            </li>)}
          </ul> : <p className="modelos-equipo-empty">Todavía no hay modelos cargados.</p>}
      </section>
    </div>
  );
}
