"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import interactionPlugin from "@fullcalendar/interaction";
import esLocale from "@fullcalendar/core/locales/es";
import type { DayCellContentArg, DayCellMountArg } from "@fullcalendar/core";
import { useCoordinacionesDemo } from "@/components/providers/demo-data-provider";

function fechaDeCelda(fecha: Date) {
  return String(fecha.getFullYear()) + "-" + String(fecha.getMonth() + 1).padStart(2, "0") + "-" + String(fecha.getDate()).padStart(2, "0");
}

export function CalendarView() {
  const router = useRouter();
  const { coordinaciones, feriados, notasEquipo: notas, agregarNotaEquipo, ready, error } = useCoordinacionesDemo();
  const [comentario, setComentario] = useState("");
  const [errorNota, setErrorNota] = useState("");
  const [guardandoNota, setGuardandoNota] = useState(false);

  async function agregarNota(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const texto = comentario.trim();
    if (!texto) return;
    setGuardandoNota(true);
    setErrorNota("");
    try {
      await agregarNotaEquipo(texto);
      setComentario("");
    } catch (cause) {
      setErrorNota(cause instanceof Error ? cause.message : "No se pudo guardar la nota.");
    } finally {
      setGuardandoNota(false);
    }
  }

  function renderDayCell(info: DayCellContentArg) {
    return info.dayNumberText;
  }

  function classesForDay(info: DayCellContentArg) {
    const fecha = fechaDeCelda(info.date);
    const classes: string[] = [];
    if (coordinaciones.some((coordinacion) => coordinacion.fecha === fecha)) classes.push("has-coordinaciones");
    if (feriados.some((feriado) => feriado.fecha === fecha && feriado.esFeriado)) classes.push("is-holiday");
    return classes;
  }

  function contenidoAdicionalDeDia(info: DayCellMountArg) {
    const fecha = fechaDeCelda(info.date);
    const feriado = feriados.find((item) => item.fecha === fecha);
    const frame = info.el.querySelector<HTMLElement>(".fc-daygrid-day-frame");
    const nombres = feriado?.personalInterno ?? [];
    if (frame && nombres.length > 0) {
      const personal = document.createElement("div");
      personal.className = "calendar-day-staff";
      nombres.forEach((nombre) => {
        const etiqueta = document.createElement("span");
        etiqueta.textContent = nombre;
        personal.appendChild(etiqueta);
      });
      frame.appendChild(personal);
    }
  }

  return (
    <div className="panel calendar-panel">
      <div className="calendar-wrap">
        <FullCalendar plugins={[dayGridPlugin, interactionPlugin]} initialView="dayGridMonth" locale={esLocale} firstDay={1} height="auto" headerToolbar={{ left: "prev,next today", center: "title", right: "" }} buttonText={{ today: "Hoy" }} dayCellContent={renderDayCell} dayCellClassNames={classesForDay} dayCellDidMount={contenidoAdicionalDeDia} dateClick={(info) => router.push("/coordinaciones/" + info.dateStr)} fixedWeekCount={false} />
        <section className="calendar-notes" aria-labelledby="calendar-notes-title">
          <div className="calendar-notes-heading"><h2 id="calendar-notes-title">Notas del equipo</h2><span>{notas.length}</span></div>
          <div className="calendar-note-list" aria-live="polite">
            {notas.map((nota) => <article key={nota.id} className="calendar-note-item"><p>{nota.comentario}</p><div><strong>{nota.usuario}</strong><time dateTime={nota.fechaHora}>{new Intl.DateTimeFormat("es-AR", { dateStyle: "short", timeStyle: "short" }).format(new Date(nota.fechaHora))}</time></div></article>)}
            {notas.length === 0 && <p className="calendar-notes-empty">Todav&iacute;a no hay notas. Agreg&aacute; la primera para el equipo.</p>}
          </div>
          <form className="calendar-note-form" style={{ display: "flex", alignItems: "stretch", gap: 7 }} onSubmit={agregarNota}>
            <input style={{ flex: "1 1 auto", width: "100%", minWidth: 0 }} aria-label="Comentario" value={comentario} onChange={(event) => setComentario(event.target.value)} placeholder="Escrib&iacute; una nota para el equipo..." required maxLength={5000} />
            <button className="button button-primary" style={{ flex: "0 0 auto", width: "auto", minWidth: 78, alignSelf: "stretch" }} type="submit" disabled={!comentario.trim() || guardandoNota}>{guardandoNota ? "Guardando…" : "Agregar"}</button>
          </form>
          {errorNota && <p role="alert" className="m-0 px-4 pb-3 text-xs text-rose-300">{errorNota}</p>}
        </section>
      </div>
      <div className="calendar-note">{error ? `Error de conexión: ${error}` : ready ? "Datos guardados en Supabase." : "Cargando calendario…"}</div>
    </div>
  );
}
