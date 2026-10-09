"use client";

import { useState, type FormEvent } from "react";
import {
  useCoordinacionesDemo,
  type CatalogoKey,
  type CatalogosDemo,
  type CuadrillaCatalogo,
} from "@/components/providers/demo-data-provider";
import type { CatalogOption } from "@/lib/demo-data/catalogs";

const titulos: Record<CatalogoKey, string> = {
  tercerizadas: "Tercerizadas",
  cuadrillas: "Cuadrillas",
  tecnologias: "Tecnologías",
  categorias: "Categorías",
  horarios: "Horarios",
  zonas: "Zonas",
  estados: "Estados",
  extras: "Extras",
};

function compararTexto(valor: string) {
  return valor.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLocaleLowerCase("es");
}

function crearId() {
  return crypto.randomUUID();
}

export function CatalogManager({ tipo }: { tipo: CatalogoKey }) {
  const { catalogos, coordinaciones, custodias, guardarCatalogo, rolDemo } = useCoordinacionesDemo();
  const [nombre, setNombre] = useState("");
  const [tercerizadaId, setTercerizadaId] = useState("");
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [mensaje, setMensaje] = useState("");
  const [guardando, setGuardando] = useState(false);
  const opciones = catalogos[tipo] as CatalogOption[];
  const puedeGestionar = rolDemo === "SUPERVISOR" || rolDemo === "JEFE";
  const esCuadrilla = tipo === "cuadrillas";
  const esTercerizada = tipo === "tercerizadas";

  function referencias(id: string) {
    if (tipo === "tercerizadas") {
      return coordinaciones.filter((item) => item.tercerizadaId === id).length
        + catalogos.cuadrillas.filter((item) => item.tercerizadaId === id).length;
    }
    if (tipo === "cuadrillas") {
      return coordinaciones.filter((item) => item.cuadrillaId === id).length
        + custodias.filter((item) => item.cuadrillaId === id).length;
    }
    if (tipo === "tecnologias") return coordinaciones.filter((item) => item.tecnologiaId === id).length;
    if (tipo === "categorias") return coordinaciones.filter((item) => item.categoriaId === id).length;
    if (tipo === "horarios") return coordinaciones.filter((item) => item.horarioId === id).length;
    if (tipo === "zonas") return coordinaciones.filter((item) => item.zona === id).length;
    if (tipo === "estados") return coordinaciones.filter((item) => item.estadoId === id).length;
    return coordinaciones.filter((item) => item.extrasIds.includes(id)).length;
  }

  async function guardarOpciones(siguiente: CatalogOption[]) {
    await guardarCatalogo(tipo, siguiente as CatalogosDemo[CatalogoKey]);
  }

  async function guardar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nombreLimpio = nombre.trim();
    if (!nombreLimpio) return;
    const duplicado = opciones.some((opcion) => opcion.id !== editandoId && compararTexto(opcion.nombre) === compararTexto(nombreLimpio));
    if (duplicado) {
      setMensaje("Ya existe un elemento con ese nombre.");
      return;
    }
    if (esCuadrilla && !tercerizadaId) {
      setMensaje("Elegí la tercerizada a la que pertenece la cuadrilla.");
      return;
    }

    let siguientes: CatalogOption[];
    if (editandoId) {
      siguientes = opciones.map((opcion) => {
        if (opcion.id !== editandoId) return opcion;
        return esCuadrilla
          ? { ...opcion, nombre: nombreLimpio, tercerizadaId } as CuadrillaCatalogo
          : { ...opcion, nombre: nombreLimpio };
      });
    } else {
      const nueva = { id: crearId(), nombre: nombreLimpio };
      siguientes = esCuadrilla ? [...opciones, { ...nueva, tercerizadaId } as CuadrillaCatalogo] : [...opciones, nueva];
    }
    setGuardando(true);
    try {
      await guardarOpciones(siguientes);
      setNombre("");
      setTercerizadaId("");
      setEditandoId(null);
      setMensaje(editandoId ? "Cambios guardados." : "Elemento agregado.");
    } catch (cause) {
      setMensaje(cause instanceof Error ? cause.message : "No se pudo guardar el catálogo.");
    } finally {
      setGuardando(false);
    }
  }

  function editar(opcion: CatalogOption) {
    setEditandoId(opcion.id);
    setNombre(opcion.nombre);
    setTercerizadaId(esCuadrilla ? (opcion as CuadrillaCatalogo).tercerizadaId : "");
    setMensaje("");
  }

  function cancelarEdicion() {
    setEditandoId(null);
    setNombre("");
    setTercerizadaId("");
    setMensaje("");
  }

  async function eliminar(opcion: CatalogOption) {
    const uso = referencias(opcion.id);
    if (uso > 0) {
      setMensaje(`No se puede eliminar “${opcion.nombre}”: tiene ${uso} referencia${uso === 1 ? "" : "s"} en uso.`);
      return;
    }
    if (esTercerizada && catalogos.cuadrillas.some((cuadrilla) => cuadrilla.tercerizadaId === opcion.id)) {
      setMensaje("Primero reasigná o eliminá las cuadrillas de esta tercerizada.");
      return;
    }
    setGuardando(true);
    try {
      await guardarOpciones(opciones.filter((actual) => actual.id !== opcion.id));
      if (editandoId === opcion.id) cancelarEdicion();
      setMensaje("Elemento eliminado.");
    } catch (cause) {
      setMensaje(cause instanceof Error ? cause.message : "No se pudo eliminar el elemento.");
    } finally {
      setGuardando(false);
    }
  }

  function fila(opcion: CatalogOption) {
    const uso = referencias(opcion.id);
    const empresa = esCuadrilla
      ? catalogos.tercerizadas.find((item) => item.id === (opcion as CuadrillaCatalogo).tercerizadaId)?.nombre
      : undefined;
    const bloquearEliminacion = uso > 0 || (esTercerizada && catalogos.cuadrillas.some((item) => item.tercerizadaId === opcion.id));
    return (
      <li className="flex min-w-0 items-center justify-between gap-3 rounded-lg border border-slate-700/80 bg-slate-950/30 px-4 py-3" key={opcion.id}>
        <div className="min-w-0">
          <strong className={`block truncate text-sm font-medium text-slate-200 ${esCuadrilla || esTercerizada ? "uppercase tracking-wide" : ""}`}>{opcion.nombre}</strong>
          {empresa && <span className="mt-1 block text-xs text-slate-400">{empresa}</span>}
          {esTercerizada && <span className="mt-1 block text-xs text-slate-400">{catalogos.cuadrillas.filter((item) => item.tercerizadaId === opcion.id).length} cuadrillas</span>}
          {uso > 0 && <span className="mt-1 block text-xs text-slate-500">En uso: {uso}</span>}
        </div>
        {puedeGestionar && (
          <div className="flex shrink-0 gap-2">
            <button className="button button-small" type="button" disabled={guardando} onClick={() => editar(opcion)}>Editar</button>
            <button className="button button-small border-rose-900/70 text-rose-300 disabled:cursor-not-allowed disabled:opacity-40" type="button" disabled={bloquearEliminacion || guardando} title={bloquearEliminacion ? "No se puede eliminar mientras tenga referencias" : "Eliminar elemento"} onClick={() => void eliminar(opcion)}>Eliminar</button>
          </div>
        )}
      </li>
    );
  }

  const cuadrillas = catalogos.cuadrillas;
  return (
    <div className="grid max-w-5xl gap-4">
      {puedeGestionar ? (
        <form className="panel grid gap-3 p-5 sm:grid-cols-[minmax(0,1fr)_minmax(180px,0.7fr)_auto] sm:items-end" onSubmit={guardar}>
          <label className="form-field mt-0">{editandoId ? "Editar nombre" : "Nuevo elemento"}
            <input value={nombre} onChange={(event) => setNombre(event.target.value)} maxLength={100} required placeholder={`Nombre de ${titulos[tipo].toLocaleLowerCase("es")}`} />
          </label>
          {esCuadrilla ? (
            <label className="form-field mt-0">Tercerizada *
              <select value={tercerizadaId} onChange={(event) => setTercerizadaId(event.target.value)} required>
                <option value="">Seleccionar tercerizada</option>
                {catalogos.tercerizadas.map((empresa) => <option key={empresa.id} value={empresa.id}>{empresa.nombre}</option>)}
              </select>
            </label>
          ) : <span className="hidden sm:block" />}
          <div className="flex gap-2">
            <button className="button button-primary" type="submit" disabled={guardando}>{guardando ? "Guardando…" : editandoId ? "Guardar" : "Agregar"}</button>
            {editandoId && <button className="button" type="button" onClick={cancelarEdicion}>Cancelar</button>}
          </div>
          {mensaje && <p className="m-0 text-xs text-sky-200 sm:col-span-full" role="status">{mensaje}</p>}
        </form>
      ) : (
        <p className="m-0 rounded-lg border border-slate-700/70 bg-slate-900/50 px-4 py-3 text-xs text-slate-400">La edición de catálogos está disponible para Supervisor y Jefe.</p>
      )}

      {esCuadrilla ? catalogos.tercerizadas.map((empresa) => {
        const deEmpresa = cuadrillas.filter((item) => item.tercerizadaId === empresa.id);
        return (
          <section className="panel overflow-hidden" key={empresa.id}>
            <header className="flex items-center justify-between border-b border-slate-700/70 bg-slate-800/70 px-5 py-4">
              <h2 className="m-0 text-base font-semibold uppercase tracking-wide text-slate-100">{empresa.nombre}</h2>
              <span className="rounded-full border border-slate-600 px-2.5 py-1 text-xs text-slate-300">{deEmpresa.length}</span>
            </header>
            <ul className="grid list-none gap-2 p-4 sm:grid-cols-2">{deEmpresa.map(fila)}</ul>
          </section>
        );
      }) : (
        <section className="panel overflow-hidden">
          <header className="flex items-center justify-between border-b border-slate-700/70 bg-slate-800/70 px-5 py-4">
            <h2 className="m-0 text-base font-semibold text-slate-100">{titulos[tipo]} disponibles</h2>
            <span className="rounded-full border border-slate-600 px-2.5 py-1 text-xs text-slate-300">{opciones.length}</span>
          </header>
          {esTercerizada ? (
            <ul className="grid list-none gap-2 p-4 sm:grid-cols-2">{opciones.map(fila)}</ul>
          ) : (
            <ul className="grid list-none gap-2 p-4 sm:grid-cols-2 lg:grid-cols-3">{opciones.map(fila)}</ul>
          )}
        </section>
      )}
    </div>
  );
}
