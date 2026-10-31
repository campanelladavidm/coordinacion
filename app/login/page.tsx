"use client";

import { useState, type FormEvent } from "react";
import { PageHeading } from "@/components/ui/page-heading";

export default function LoginPage() {
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState("");

  async function iniciarSesion(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCargando(true);
    setError("");
    const formulario = new FormData(event.currentTarget);
    try {
      const respuesta = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: String(formulario.get("email")).trim(),
          password: String(formulario.get("password")),
        }),
      });
      const resultado = await respuesta.json() as { error?: string };
      if (!respuesta.ok) {
        const mensaje = resultado.error ?? "No se pudo iniciar sesión.";
        const detalle = mensaje.toLowerCase();
        if (detalle.includes("invalid login credentials")) {
          setError("El correo o la contraseña no coinciden. Revisalos e intentá nuevamente.");
        } else if (detalle.includes("email not confirmed")) {
          setError("La cuenta todavía no confirmó su correo electrónico.");
        } else {
          setError(`No se pudo iniciar sesión: ${mensaje}`);
        }
        return;
      }
      window.location.assign("/");
    } catch {
      setError("No se pudo conectar con el servicio de acceso. Revisá tu conexión e intentá nuevamente.");
    } finally {
      setCargando(false);
    }
  }

  return (
    <section>
      <div className="panel auth-card">
        <PageHeading eyebrow="Acceso interno" title="Iniciar sesión" description="Ingresá con tu cuenta de Coordinaciones WN." />
        <form method="post" onSubmit={iniciarSesion}>
          <label className="form-field">Correo electrónico<input type="email" name="email" autoComplete="username" placeholder="nombre@empresa.com" required /></label>
          <label className="form-field">Contraseña<input type="password" name="password" autoComplete="current-password" placeholder="Tu contraseña" required /></label>
          {error && <p className="mt-4 text-sm text-rose-300" role="alert">{error}</p>}
          <button className="button button-primary" type="submit" disabled={cargando}>{cargando ? "Ingresando…" : "Iniciar sesión"}</button>
        </form>
        <p className="muted mt-4 text-xs">El administrador de la aplicación debe crear tu cuenta en Supabase.</p>
      </div>
    </section>
  );
}
