"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { PageHeading } from "@/components/ui/page-heading";

export default function EstablecerContrasenaPage() {
  const router = useRouter();
  const [comprobando, setComprobando] = useState(true);
  const [sesionValida, setSesionValida] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");
  const [mensaje, setMensaje] = useState("");

  useEffect(() => {
    let activa = true;
    void createClient().auth.getUser().then(({ data, error: authError }) => {
      if (!activa) return;
      setSesionValida(Boolean(data.user) && !authError);
      if (!data.user || authError) setError("El enlace no es válido o ya venció. Pedile al Jefe que te envíe una nueva invitación.");
      setComprobando(false);
    });
    return () => { activa = false; };
  }, []);

  async function guardarContrasena(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formulario = new FormData(event.currentTarget);
    const contrasena = String(formulario.get("contrasena") ?? "");
    const repetida = String(formulario.get("repetir") ?? "");
    if (contrasena !== repetida) {
      setError("Las contraseñas no coinciden.");
      return;
    }
    setGuardando(true);
    setError("");
    const { error: updateError } = await createClient().auth.updateUser({ password: contrasena });
    setGuardando(false);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    setMensaje("Contraseña guardada. Ya podés usar Coordinaciones WN.");
    window.setTimeout(() => router.replace("/"), 900);
  }

  return (
    <section>
      <div className="panel auth-card">
        <PageHeading eyebrow="Acceso interno" title="Elegí tu contraseña" description="Usá una contraseña segura para terminar de activar tu cuenta." />
        {comprobando ? <p className="muted">Comprobando invitación…</p> : sesionValida ? (
          <form className="grid gap-3" onSubmit={guardarContrasena}>
            <label className="form-field">Contraseña nueva<input name="contrasena" type="password" autoComplete="new-password" minLength={8} required /></label>
            <label className="form-field">Repetir contraseña<input name="repetir" type="password" autoComplete="new-password" minLength={8} required /></label>
            {error && <p className="m-0 text-sm text-rose-300" role="alert">{error}</p>}
            {mensaje && <p className="m-0 text-sm text-emerald-300" role="status">{mensaje}</p>}
            <button className="button button-primary justify-self-end" type="submit" disabled={guardando}>{guardando ? "Guardando…" : "Guardar contraseña"}</button>
          </form>
        ) : <p className="m-0 text-sm text-rose-300" role="alert">{error}</p>}
      </div>
    </section>
  );
}
