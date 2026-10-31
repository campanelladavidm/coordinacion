"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useCoordinacionesDemo } from "@/components/providers/demo-data-provider";

type Notificacion = {
  id: string;
  tarea_id: string;
  tipo: "ASIGNACION" | "ESTADO" | "COMENTARIO";
  titulo: string;
  mensaje: string;
  created_at: string;
  leida_at: string | null;
};

function headersNotificaciones() {
  const headers = new Headers({ "Content-Type": "application/json" });
  try {
    const contexto = window.sessionStorage.getItem("coordi-usuario-contexto");
    if (contexto) headers.set("x-user-context", contexto);
  } catch { /* El navegador puede restringir sessionStorage. */ }
  return headers;
}

function tiempoRelativo(fecha: string) {
  const minutos = Math.max(0, Math.floor((Date.now() - new Date(fecha).getTime()) / 60_000));
  if (minutos < 1) return "Ahora";
  if (minutos < 60) return `Hace ${minutos} min`;
  const horas = Math.floor(minutos / 60);
  if (horas < 24) return `Hace ${horas} h`;
  const dias = Math.floor(horas / 24);
  if (dias < 7) return dias === 1 ? "Ayer" : `Hace ${dias} días`;
  return new Intl.DateTimeFormat("es-AR", { day: "numeric", month: "short" }).format(new Date(fecha));
}

export function TaskNotifications() {
  const pathname = usePathname();
  const router = useRouter();
  const { usuarioActual, usuarioEnContexto } = useCoordinacionesDemo();
  const usuarioActivoId = usuarioActual?.id;
  const panelRef = useRef<HTMLDivElement>(null);
  const [abierto, setAbierto] = useState(false);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");
  const [notificaciones, setNotificaciones] = useState<Notificacion[]>([]);
  const [sinLeer, setSinLeer] = useState(0);

  const cargar = useCallback(async (silencioso = false) => {
    try {
      const response = await fetch("/api/notificaciones", { headers: headersNotificaciones(), cache: "no-store" });
      const data = await response.json() as { notificaciones?: Notificacion[]; sinLeer?: number; error?: string };
      if (!response.ok) throw new Error(data.error || "No se pudieron cargar las notificaciones.");
      setNotificaciones(data.notificaciones ?? []);
      setSinLeer(data.sinLeer ?? 0);
      setError("");
    } catch (cause) {
      if (!silencioso) setError(cause instanceof Error ? cause.message : "No se pudieron cargar las notificaciones.");
    } finally {
      setCargando(false);
    }
  }, [usuarioEnContexto?.id]);

  useEffect(() => {
    if (pathname === "/login" || !usuarioActivoId) {
      setCargando(false);
      return;
    }
    const inicio = window.setTimeout(() => { void cargar(true); }, 0);
    const intervalo = window.setInterval(() => { void cargar(true); }, 30_000);
    return () => { window.clearTimeout(inicio); window.clearInterval(intervalo); };
  }, [cargar, pathname, usuarioActivoId]);

  useEffect(() => {
    if (!abierto) return;
    const cerrarFuera = (event: PointerEvent) => {
      if (event.target instanceof Node && !panelRef.current?.contains(event.target)) setAbierto(false);
    };
    const cerrarConEscape = (event: KeyboardEvent) => { if (event.key === "Escape") setAbierto(false); };
    document.addEventListener("pointerdown", cerrarFuera);
    window.addEventListener("keydown", cerrarConEscape);
    return () => {
      document.removeEventListener("pointerdown", cerrarFuera);
      window.removeEventListener("keydown", cerrarConEscape);
    };
  }, [abierto]);

  if (pathname === "/login" || !usuarioActual) return null;

  async function marcarTodasComoLeidas() {
    if (!sinLeer) return;
    setGuardando(true);
    setError("");
    try {
      const response = await fetch("/api/notificaciones", {
        method: "PATCH", headers: headersNotificaciones(), body: JSON.stringify({ todas: true }),
      });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error || "No se pudieron actualizar las notificaciones.");
      await cargar(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudieron actualizar las notificaciones.");
    } finally {
      setGuardando(false);
    }
  }

  async function abrirNotificacion(notificacion: Notificacion) {
    setGuardando(true);
    setError("");
    try {
      const response = await fetch("/api/notificaciones", {
        method: "PATCH", headers: headersNotificaciones(), body: JSON.stringify({ id: notificacion.id }),
      });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error || "No se pudo abrir la notificación.");
      setAbierto(false);
      await cargar(true);
      router.push(`/tareas?abrir=${encodeURIComponent(notificacion.tarea_id)}`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo abrir la notificación.");
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="task-notifications" ref={panelRef}>
      <button
        type="button"
        className="task-notifications-trigger"
        aria-label={sinLeer ? `Notificaciones de tareas, ${sinLeer} sin leer` : "Notificaciones de tareas"}
        aria-haspopup="dialog"
        aria-expanded={abierto}
        title="Notificaciones de tareas"
        onClick={() => { setAbierto((value) => !value); if (!abierto) { setError(""); void cargar(); } }}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18 9a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" /></svg>
        {sinLeer > 0 && <span className="task-notifications-count">{sinLeer > 99 ? "99+" : sinLeer}</span>}
      </button>

      {abierto && <section className="task-notifications-popover" role="dialog" aria-label="Notificaciones de tareas">
        <header className="task-notifications-heading">
          <div><h2>Notificaciones</h2><span>Tareas{sinLeer > 0 ? ` · ${sinLeer} sin leer` : ""}</span></div>
          <button type="button" className="task-notifications-read-all" onClick={() => void marcarTodasComoLeidas()} disabled={!sinLeer || guardando}>Marcar todas como leídas</button>
        </header>
        {error && <p className="task-notifications-error" role="alert">{error}</p>}
        <div className="task-notifications-list">
          {cargando && !notificaciones.length ? <p className="task-notifications-empty">Cargando notificaciones…</p>
            : notificaciones.length ? notificaciones.map((notificacion) => <button
              type="button"
              key={notificacion.id}
              className={`task-notification-item${notificacion.leida_at ? " is-read" : " is-unread"}`}
              onClick={() => void abrirNotificacion(notificacion)}
              disabled={guardando}
            >
              <span className="task-notification-dot" aria-hidden="true" />
              <span className="task-notification-copy"><strong>{notificacion.titulo}</strong><span>{notificacion.mensaje}</span></span>
              <time dateTime={notificacion.created_at}>{tiempoRelativo(notificacion.created_at)}</time>
            </button>) : <p className="task-notifications-empty">No tenés notificaciones de tareas.</p>}
        </div>
        <footer className="task-notifications-footer">Las no leídas permanecen hasta abrirse. Las leídas se eliminan después de 2 días.</footer>
      </section>}
    </div>
  );
}
