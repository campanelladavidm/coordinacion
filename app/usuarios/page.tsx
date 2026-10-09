"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeading } from "@/components/ui/page-heading";

type Rol = { id: string; codigo: "COORDINADOR" | "SUPERVISOR" | "JEFE"; nombre: string };
type Usuario = {
  id: string; email: string; nombre: string; rolId: string; rol: string;
  activo: boolean; confirmado: boolean; createdAt: string; lastSignInAt: string | null;
};

async function respuestaApi<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { ...init, headers: { "Content-Type": "application/json", ...init?.headers } });
  const data = await response.json() as T & { error?: string };
  if (!response.ok) throw new Error(data.error ?? "No se pudo completar la operación.");
  return data;
}

export default function UsuariosPage() {
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [roles, setRoles] = useState<Rol[]>([]);
  const [email, setEmail] = useState("");
  const [nombre, setNombre] = useState("");
  const [rolId, setRolId] = useState("");
  const [modoAlta, setModoAlta] = useState<"INVITAR" | "DIRECTO">("INVITAR");
  const [contrasena, setContrasena] = useState("");
  const [confirmarContrasena, setConfirmarContrasena] = useState("");
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [guardandoId, setGuardandoId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [mensaje, setMensaje] = useState("");

  const cargar = useCallback(async () => {
    setCargando(true);
    setError("");
    try {
      const data = await respuestaApi<{ usuarios: Usuario[]; roles: Rol[] }>("/api/usuarios");
      setUsuarios(data.usuarios);
      setRoles(data.roles);
      setRolId((actual) => actual || data.roles.find((rol) => rol.codigo === "COORDINADOR")?.id || "");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo cargar la lista de usuarios.");
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void cargar(), 0);
    return () => window.clearTimeout(timer);
  }, [cargar]);

  async function crearUsuario(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (modoAlta === "DIRECTO" && contrasena !== confirmarContrasena) {
      setError("Las contraseñas no coinciden.");
      return;
    }
    setGuardando(true);
    setError("");
    setMensaje("");
    try {
      const data = await respuestaApi<{ mensaje: string }>("/api/usuarios", {
        method: "POST", body: JSON.stringify({ email, nombre, rolId, modo: modoAlta, contrasena: modoAlta === "DIRECTO" ? contrasena : undefined }),
      });
      setMensaje(data.mensaje);
      setEmail("");
      setNombre("");
      setContrasena("");
      setConfirmarContrasena("");
      await cargar();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo enviar la invitación.");
    } finally {
      setGuardando(false);
    }
  }

  async function actualizar(usuario: Usuario, cambios: { nombre?: string; rolId?: string; activo?: boolean }) {
    setGuardandoId(usuario.id);
    setError("");
    setMensaje("");
    try {
      await respuestaApi("/api/usuarios", { method: "PATCH", body: JSON.stringify({ id: usuario.id, ...cambios }) });
      setMensaje("Cambios guardados.");
      await cargar();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudieron guardar los cambios.");
    } finally {
      setGuardandoId(null);
    }
  }

  async function eliminar(usuario: Usuario) {
    if (!window.confirm(`¿Eliminar la cuenta de ${usuario.nombre || usuario.email}? La acción no se puede deshacer.`)) return;
    setGuardandoId(usuario.id);
    setError("");
    setMensaje("");
    try {
      await respuestaApi("/api/usuarios", { method: "DELETE", body: JSON.stringify({ id: usuario.id }) });
      setMensaje("Cuenta eliminada.");
      await cargar();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo eliminar la cuenta.");
    } finally {
      setGuardandoId(null);
    }
  }

  return (
    <section>
      <PageHeading eyebrow="Administración" title="Usuarios" description="Invitá personas y administrá sus perfiles y permisos de acceso." />
      {error && <div className="mb-4 rounded-lg border border-rose-900/70 bg-rose-950/30 px-4 py-3 text-sm text-rose-200" role="alert">{error}</div>}
      {mensaje && <div className="mb-4 rounded-lg border border-emerald-900/70 bg-emerald-950/20 px-4 py-3 text-sm text-emerald-200" role="status">{mensaje}</div>}

      {!cargando && !error && roles.length > 0 && (
        <form className="panel mb-5 grid gap-3 p-5 sm:grid-cols-2 lg:grid-cols-4 lg:items-end" onSubmit={crearUsuario}>
          <label className="form-field mt-0">Tipo de alta<select value={modoAlta} onChange={(event) => setModoAlta(event.target.value as "INVITAR" | "DIRECTO")}><option value="INVITAR">Invitar por correo</option><option value="DIRECTO">Crear cuenta directamente</option></select></label>
          <label className="form-field mt-0">Nombre completo<input value={nombre} onChange={(event) => setNombre(event.target.value)} maxLength={100} required placeholder="Nombre y apellido" /></label>
          <label className="form-field mt-0">Correo electrónico<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required placeholder="nombre@empresa.com" /></label>
          <label className="form-field mt-0">Rol inicial<select value={rolId} onChange={(event) => setRolId(event.target.value)} required>{roles.map((rol) => <option key={rol.id} value={rol.id}>{rol.nombre}</option>)}</select></label>
          {modoAlta === "DIRECTO" && <>
            <label className="form-field mt-0">Contraseña inicial<input type="password" autoComplete="new-password" minLength={12} maxLength={72} value={contrasena} onChange={(event) => setContrasena(event.target.value)} required placeholder="Mínimo 12 caracteres" /></label>
            <label className="form-field mt-0">Repetir contraseña<input type="password" autoComplete="new-password" minLength={12} maxLength={72} value={confirmarContrasena} onChange={(event) => setConfirmarContrasena(event.target.value)} required placeholder="Repetí la contraseña" /></label>
          </>}
          <button className="button button-primary" type="submit" disabled={guardando || !rolId}>{guardando ? "Creando…" : modoAlta === "INVITAR" ? "Invitar usuario" : "Crear cuenta"}</button>
          <p className="m-0 text-xs text-slate-400 sm:col-span-2 lg:col-span-full">{modoAlta === "INVITAR" ? "La persona recibirá un correo para definir su contraseña. Requiere que Supabase tenga el envío de correo configurado." : "La cuenta queda activa sin enviar correo. Compartí la contraseña inicial por un canal seguro y usá esta opción solo con correos verificados."}</p>
        </form>
      )}

      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="m-0 text-sm font-semibold text-slate-200">Cuentas registradas</h2>
        <span className="text-xs text-slate-400">{usuarios.length} usuarios</span>
      </div>
      {cargando ? <EmptyState title="Cargando usuarios" description="Consultando los perfiles de Supabase Auth." /> : error && usuarios.length === 0 ? <EmptyState title="No se pudo conectar la administración" description="Revisá el mensaje de arriba y la configuración del servidor." /> : usuarios.length === 0 ? <EmptyState title="Todavía no hay perfiles" description="Agregá al primer integrante del equipo con el formulario." /> : (
        <div className="grid gap-3">
          {usuarios.map((usuario) => (
            <article className="panel grid gap-4 p-4 md:grid-cols-[minmax(200px,1.3fr)_minmax(170px,1fr)_minmax(150px,.8fr)_auto] md:items-center" key={usuario.id}>
              <div className="min-w-0">
                <strong className="block truncate text-sm text-slate-100">{usuario.nombre || "Sin nombre"}</strong>
                <span className="mt-1 block truncate text-xs text-slate-400">{usuario.email}</span>
                <span className="mt-2 inline-flex rounded-full border border-slate-700 bg-slate-900 px-2 py-1 text-[11px] text-slate-300">{usuario.confirmado ? "Correo confirmado" : "Invitación pendiente"}</span>
              </div>
              <label className="form-field m-0">Nombre<input key={`${usuario.id}-nombre-${usuario.nombre}`} defaultValue={usuario.nombre} maxLength={100} onBlur={(event) => { const value = event.target.value.trim(); if (value && value !== usuario.nombre) void actualizar(usuario, { nombre: value }); }} /></label>
              <label className="form-field m-0">Rol<select value={usuario.rolId} disabled={guardandoId === usuario.id || !usuario.rolId} onChange={(event) => void actualizar(usuario, { rolId: event.target.value })}>{roles.map((rol) => <option key={rol.id} value={rol.id}>{rol.nombre}</option>)}</select></label>
              <div className="flex flex-wrap gap-2 md:justify-self-end">
              <button className={"button button-small " + (usuario.activo ? "border-rose-900/70 text-rose-300" : "border-emerald-800/70 text-emerald-300")} type="button" disabled={guardandoId === usuario.id} onClick={() => {
                const accion = usuario.activo ? "desactivar" : "activar";
                if (window.confirm(`¿Querés ${accion} la cuenta de ${usuario.nombre || usuario.email}?`)) void actualizar(usuario, { activo: !usuario.activo });
              }}>{guardandoId === usuario.id ? "Guardando…" : usuario.activo ? "Desactivar" : "Activar"}</button>
              <button className="button button-small border-rose-900/70 text-rose-300 disabled:opacity-40" type="button" disabled={guardandoId === usuario.id} onClick={() => void eliminar(usuario)} title="Eliminar cuenta definitivamente">Eliminar</button>
              </div>
              <span className="text-xs text-slate-500 md:col-span-full">{usuario.lastSignInAt ? `Último acceso: ${new Intl.DateTimeFormat("es-AR", { dateStyle: "short", timeStyle: "short" }).format(new Date(usuario.lastSignInAt))}` : "Sin inicios de sesión"}</span>
            </article>
          ))}
        </div>
      )}
      <p className="mt-4 text-xs text-slate-500">Desactivar una cuenta conserva sus coordinaciones y notas históricas, pero sus permisos RLS dejan de estar activos.</p>
    </section>
  );
}
