"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { useCoordinacionesDemo } from "@/components/providers/demo-data-provider";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeading } from "@/components/ui/page-heading";

function tituloFecha(fecha: string) {
  if (!fecha) return "";
  return new Intl.DateTimeFormat("es-AR", { dateStyle: "full", timeZone: "UTC" }).format(new Date(fecha + "T12:00:00Z"));
}

function fechaLocalHoy() {
  const hoy = new Date();
  return `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, "0")}-${String(hoy.getDate()).padStart(2, "0")}`;
}

export default function FeriadosPage() {
  const { feriados, rolDemo, guardarFeriado, quitarFeriado } = useCoordinacionesDemo();
  const [fecha, setFecha] = useState(fechaLocalHoy);
  const [esFeriado, setEsFeriado] = useState(false);
  const [personal, setPersonal] = useState("");
  const [guardado, setGuardado] = useState(false);
  const [error, setError] = useState("");
  const [guardando, setGuardando] = useState(false);
  const puedeGestionar = rolDemo === "JEFE" || rolDemo === "SUPERVISOR";

  function seleccionarFecha(nuevaFecha: string) {
    setFecha(nuevaFecha);
    const existente = feriados.find((feriado) => feriado.fecha === nuevaFecha);
    setEsFeriado(existente?.esFeriado ?? false);
    setPersonal(existente?.personalInterno.join(", ") ?? "");
    setGuardado(false);
    setError("");
  }

  async function guardar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!fecha) return;
    setGuardando(true);
    setError("");
    try {
      await guardarFeriado({
        fecha,
        esFeriado,
        personalInterno: [...new Set(personal.split(",").map((nombre) => nombre.trim()).filter(Boolean))],
      });
      setGuardado(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo guardar el día.");
    } finally {
      setGuardando(false);
    }
  }

  async function eliminarConfiguracion(fechaAEliminar: string) {
    setError("");
    try {
      await quitarFeriado(fechaAEliminar);
      if (fecha === fechaAEliminar) {
        setEsFeriado(false);
        setPersonal("");
        setGuardado(false);
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo eliminar el día.");
    }
  }

  return (
    <section>
      <Link href="/configuraciones" className="back-link">&larr; Volver a configuraciones</Link>
      <PageHeading eyebrow="Configuración" title="Feriados y personal interno" description="Marcá los feriados y asigná el personal interno que trabajará cada día." />
      {!puedeGestionar ? <EmptyState title="Acceso restringido" description="Solo los roles Supervisor y Jefe pueden administrar feriados y asignaciones." /> : (
        <div className="holiday-settings-layout">
          <form className="panel holiday-form" onSubmit={guardar}>
            <h2 className="holiday-form-title">Configurar día</h2>
            <label className="form-field">Fecha *<input type="date" value={fecha} onChange={(event) => seleccionarFecha(event.target.value)} required /></label>
            <label className="holiday-checkbox"><input type="checkbox" checked={esFeriado} onChange={(event) => { setEsFeriado(event.target.checked); setGuardado(false); }} />Marcar como feriado</label>
            <label className="form-field">Personal interno<input value={personal} onChange={(event) => { setPersonal(event.target.value); setGuardado(false); }} placeholder="Ej.: Julieta, Nicolás" /><span className="field-help">Separá los nombres con comas. Se mostrarán en el calendario.</span></label>
            <div className="holiday-form-footer"><span className="muted">Los feriados se identifican en naranja.</span><button className="button button-primary" type="submit" disabled={guardando}>{guardando ? "Guardando…" : guardado ? "Guardado" : "Guardar día"}</button></div>
            {error && <p role="alert" className="m-0 text-xs text-rose-300">{error}</p>}
          </form>

          <div className="holiday-records">
            <div className="daily-section-heading"><h2 className="section-title">Días configurados</h2><span className="daily-count">{feriados.length}</span></div>
            {feriados.length === 0 ? <EmptyState title="Todavía no hay días configurados" description="Seleccioná una fecha para marcar un feriado o asignar personal interno." /> : feriados.map((item) => (
              <article className="panel holiday-record" key={item.fecha}>
                <button className="holiday-record-select" type="button" onClick={() => seleccionarFecha(item.fecha)}>
                  <span><strong>{tituloFecha(item.fecha)}</strong><span>{item.personalInterno.join(", ") || "Sin personal asignado"}</span></span>
                  <span className={"holiday-record-badge" + (item.esFeriado ? " is-holiday" : "")}>{item.esFeriado ? "Feriado" : "Personal asignado"}</span>
                </button>
                <button className="holiday-remove-button" type="button" onClick={() => void eliminarConfiguracion(item.fecha)}>{item.esFeriado ? "Eliminar feriado" : "Eliminar día"}</button>
              </article>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
