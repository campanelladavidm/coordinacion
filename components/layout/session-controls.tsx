"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useCoordinacionesDemo } from "@/components/providers/demo-data-provider";
import { createClient } from "@/lib/supabase/client";

const etiquetas = { COORDINADOR: "Coordinador", SUPERVISOR: "Supervisor", JEFE: "Jefe" };

export function SessionControls() {
  const router = useRouter();
  const { usuarioActual, rolDemo, error } = useCoordinacionesDemo();
  const [cerrando, setCerrando] = useState(false);

  async function cerrarSesion() {
    setCerrando(true);
    const { error } = await createClient().auth.signOut();
    if (!error) router.replace("/login");
    setCerrando(false);
  }

  return usuarioActual ? (
    <div className="flex items-center gap-3 text-xs text-slate-400">
      <span className="topbar-status"><span className={"status-dot " + (error ? "bg-rose-400" : "status-dot-demo")} />{error ? "Error de conexión con Supabase" : `${usuarioActual.nombre} · ${etiquetas[rolDemo]}`}</span>
      <button className="button button-small" type="button" onClick={cerrarSesion} disabled={cerrando}>{cerrando ? "Saliendo…" : "Cerrar sesión"}</button>
    </div>
  ) : <span className="topbar-status">Conectando sesión…</span>;
}
