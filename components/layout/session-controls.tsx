"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useCoordinacionesDemo, type ContextoUsuario } from "@/components/providers/demo-data-provider";
import { createClient } from "@/lib/supabase/client";

export function SessionControls() {
  const router = useRouter();
  const { usuarioActual, error, rolAutenticado, usuarioEnContexto, seleccionarUsuarioContexto } = useCoordinacionesDemo();
  const [cerrando, setCerrando] = useState(false);
  const [usuarios, setUsuarios] = useState<ContextoUsuario[]>([]);

  useEffect(() => {
    if (rolAutenticado !== "JEFE") return;
    let vigente = true;
    void fetch("/api/usuarios").then(async (response) => {
      if (!response.ok) return null;
      return await response.json() as { usuarios?: { id: string; nombre: string; rolId: string; rol: string; activo: boolean }[]; roles?: { id: string; codigo: string }[] };
    }).then((data) => {
      if (!vigente || !data) return;
      const roles = new Map((data.roles ?? []).map((role) => [role.id, role.codigo]));
      setUsuarios((data.usuarios ?? []).filter((user) => user.activo).map((user) => ({
        id: user.id, nombre: user.nombre || "Usuario",
        rol: roles.get(user.rolId) === "JEFE" || roles.get(user.rolId) === "SUPERVISOR" ? roles.get(user.rolId) as "JEFE" | "SUPERVISOR" : "COORDINADOR",
      })));
    }).catch(() => undefined);
    return () => { vigente = false; };
  }, [rolAutenticado]);

  async function cerrarSesion() {
    setCerrando(true);
    const { error } = await createClient().auth.signOut();
    if (!error) router.replace("/login");
    setCerrando(false);
  }

  function cambiarContexto(id: string) {
    seleccionarUsuarioContexto(usuarios.find((user) => user.id === id) ?? null);
    router.refresh();
  }

  return usuarioActual ? (
    <div className="session-controls">
      <span className="topbar-status" title={error ? "Error de conexión con Supabase" : "Sesión activa"}>
        <span className={"status-dot " + (error ? "session-error-dot" : "status-dot-demo")} />
        <span className="session-name">{usuarioActual.nombre}</span>
      </span>
      {rolAutenticado === "JEFE" && <label className="user-context-select"><span>Operar como</span><select aria-label="Seleccionar usuario para operar en su contexto" value={usuarioEnContexto?.id ?? ""} onChange={(event) => cambiarContexto(event.target.value)}><option value="">{usuarioActual.nombre} (Jefe)</option>{usuarios.filter((user) => user.id !== usuarioActual.id).map((user) => <option key={user.id} value={user.id}>{user.nombre}</option>)}</select></label>}
      <button className="button button-small session-signout" type="button" onClick={cerrarSesion} disabled={cerrando}>
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10 4H5v16h5M14 8l4 4-4 4M8 12h10" /></svg>
        <span>{cerrando ? "Saliendo…" : "Cerrar sesión"}</span>
      </button>
    </div>
  ) : <span className="topbar-status">Conectando sesión…</span>;
}
