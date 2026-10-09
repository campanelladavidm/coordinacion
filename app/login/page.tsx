"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { createClient } from "@/lib/supabase/client";
import { PageHeading } from "@/components/ui/page-heading";

export default function LoginPage() {
  const router = useRouter();
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState("");

  async function iniciarSesion(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCargando(true);
    setError("");
    const formulario = new FormData(event.currentTarget);
    const supabase = createClient();
    const { error: authError } = await supabase.auth.signInWithPassword({
      email: String(formulario.get("email")).trim(),
      password: String(formulario.get("password")),
    });
    setCargando(false);
    if (authError) {
      setError("No pudimos iniciar sesión. Revisá el correo y la contraseña.");
      return;
    }
    router.replace("/");
    router.refresh();
  }

  return (
    <section>
      <Link href="/login" className="back-link">Acceso interno</Link>
      <div className="panel auth-card">
        <PageHeading eyebrow="Acceso interno" title="Iniciar sesión" description="Ingresá con tu cuenta de Coordinaciones WN." />
        <form onSubmit={iniciarSesion}>
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
