"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useCoordinacionesDemo } from "@/components/providers/demo-data-provider";
import { createClient } from "@/lib/supabase/client";

export function SessionControls() {
  const router = useRouter();
  const { usuarioActual, error } = useCoordinacionesDemo();
  const [cerrando, setCerrando] = useState(false);

  async function cerrarSesion() {
    setCerrando(true);
    const { error } = await createClient().auth.signOut();
    if (!error) router.replace("/login");
    setCerrando(false);
  }

  return usuarioActual ? (
    <div className="session-controls">
      <span className="topbar-status" title={error ? "Error de conexión con Supabase" : "Sesión activa"}>
        <span className={"status-dot " + (error ? "session-error-dot" : "status-dot-demo")} />
        <span className="session-name">{usuarioActual.nombre}</span>
      </span>
      <button className="button button-small session-signout" type="button" onClick={cerrarSesion} disabled={cerrando}>
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10 4H5v16h5M14 8l4 4-4 4M8 12h10" /></svg>
        <span>{cerrando ? "Saliendo…" : "Cerrar sesión"}</span>
      </button>
    </div>
  ) : <span className="topbar-status">Conectando sesión…</span>;
}
