"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { useCoordinacionesDemo, type NuevaCoordinacion } from "@/components/providers/demo-data-provider";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeading } from "@/components/ui/page-heading";
import { esEnlaceCortoMaps, normalizarUbicacionMaps } from "@/lib/maps/ubicacion";

export type NuevaCoordinacionDefaults = Pick<NuevaCoordinacion, "tercerizadaId" | "cuadrillaId" | "zona" | "tecnologiaId">;
type BorradorCoordinacion = Record<string, string | string[]>;

function Opciones({ opciones, vacio = "Seleccionar…", conservarId }: { opciones: { id: string; nombre: string; activo?: boolean }[]; vacio?: string; conservarId?: string | null }) {
  const activas = opciones.filter((opcion) => opcion.activo !== false);
  const conservada = conservarId ? opciones.find((opcion) => opcion.id === conservarId && opcion.activo === false) : undefined;
  const visibles = conservada ? [...activas, conservada] : activas;
  return <><option value="">{vacio}</option>{visibles.map((opcion) => <option key={opcion.id} value={opcion.id}>{opcion.nombre}{opcion.activo === false ? " (inactivo)" : ""}</option>)}</>;
}

export function NuevaCoordinacionForm({ fecha, coordinacionId, valoresIniciales, onCancelar, onGuardado }: { fecha: string; coordinacionId?: string; valoresIniciales?: NuevaCoordinacionDefaults; onCancelar?: () => void; onGuardado?: (valores: NuevaCoordinacionDefaults) => void }) {
  const router = useRouter();
  const { coordinaciones, catalogos, ready, usuarioActual, usuarioEnContexto, crearCoordinacion, actualizarCoordinacion } = useCoordinacionesDemo();
  const inicial = coordinacionId ? coordinaciones.find((coordinacion) => coordinacion.id === coordinacionId) : undefined;
  const [tercerizadaEditada, setTercerizadaEditada] = useState<string | undefined>(undefined);
  const [cuadrillaEditada, setCuadrillaEditada] = useState<string | undefined>(undefined);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");
  const formularioRef = useRef<HTMLFormElement>(null);
  const claveBorrador = `coordi-coordinacion-borrador:${usuarioEnContexto?.id ?? usuarioActual?.id ?? "sin-usuario"}:${fecha}`;
  const tercerizadaPorDefecto = valoresIniciales?.tercerizadaId && catalogos.tercerizadas.some((item) => item.id === valoresIniciales.tercerizadaId && item.activo !== false) ? valoresIniciales.tercerizadaId : "";
  const tercerizadaSeleccionada = tercerizadaEditada ?? inicial?.tercerizadaId ?? tercerizadaPorDefecto;
  const cuadrillaPorDefecto = valoresIniciales?.cuadrillaId && catalogos.cuadrillas.some((item) => item.id === valoresIniciales.cuadrillaId && item.activo !== false) ? valoresIniciales.cuadrillaId : "";
  const cuadrillaSeleccionada = cuadrillaEditada ?? inicial?.cuadrillaId ?? cuadrillaPorDefecto;
  const cuadrillasDisponibles = catalogos.cuadrillas.filter((cuadrilla) => cuadrilla.tercerizadaId === tercerizadaSeleccionada);
  const extrasDisponibles = catalogos.extras.filter((extra) => extra.activo !== false || (inicial?.extrasIds.includes(extra.id) ?? false));

  useEffect(() => {
    const formulario = formularioRef.current;
    if (!ready || coordinacionId || !formulario) return;
    try {
      const guardado = window.sessionStorage.getItem(claveBorrador);
      if (!guardado) return;
      const borrador = JSON.parse(guardado) as BorradorCoordinacion;
      if (!borrador || typeof borrador !== "object" || Array.isArray(borrador)) return;
      for (const [nombre, valor] of Object.entries(borrador)) {
        if (nombre === "extras" || typeof valor !== "string" || nombre === "tercerizada" || nombre === "cuadrilla") continue;
        const campo = formulario.elements.namedItem(nombre);
        if (campo instanceof HTMLInputElement || campo instanceof HTMLSelectElement || campo instanceof HTMLTextAreaElement) campo.value = valor;
      }
      if (typeof borrador.tercerizada === "string") setTercerizadaEditada(borrador.tercerizada);
      if (typeof borrador.cuadrilla === "string") setCuadrillaEditada(borrador.cuadrilla);
      const extrasGuardados = Array.isArray(borrador.extras) ? borrador.extras : [];
      formulario.querySelectorAll<HTMLInputElement>('input[name="extras"]').forEach((checkbox) => {
        checkbox.checked = extrasGuardados.includes(checkbox.value);
      });
    } catch {
      try { window.sessionStorage.removeItem(claveBorrador); } catch { /* El formulario puede continuar sin storage. */ }
    }
  }, [ready, coordinacionId, claveBorrador]);

  function guardarBorrador(event: ChangeEvent<HTMLFormElement>) {
    if (coordinacionId) return;
    const datos = new FormData(event.currentTarget);
    const borrador: BorradorCoordinacion = {};
    for (const [nombre, valor] of datos.entries()) {
      if (nombre === "extras") continue;
      borrador[nombre] = String(valor);
    }
    borrador.extras = datos.getAll("extras").map(String);
    try {
      window.sessionStorage.setItem(claveBorrador, JSON.stringify(borrador));
    } catch {
      // Si el navegador bloquea el almacenamiento, el formulario sigue funcionando normalmente.
    }
  }

  if (!ready) return <EmptyState title="Cargando formulario" description="Estamos preparando las opciones de demostración." />;
  if (coordinacionId && !inicial) return <EmptyState title="No encontramos esa coordinación" description="Volvé al día seleccionado y abrí una coordinación de la lista." />;

  async function guardar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formulario = new FormData(event.currentTarget);
    setGuardando(true);
    setError("");
    try {
      const ubicacionIngresada = String(formulario.get("ubicacion") || "").trim();
      let ubicacion = "";
      if (ubicacionIngresada) {
        ubicacion = normalizarUbicacionMaps(ubicacionIngresada) ?? "";
        if (!ubicacion && esEnlaceCortoMaps(ubicacionIngresada)) {
          const response = await fetch("/api/coordinaciones/ubicacion", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ url: ubicacionIngresada }),
          });
          const resultado = await response.json() as { ubicacion?: string; error?: string };
          if (!response.ok || !resultado.ubicacion) throw new Error(resultado.error ?? "No se pudo resolver el enlace de Google Maps.");
          ubicacion = resultado.ubicacion;
        }
        if (!ubicacion) throw new Error("Pegá coordenadas válidas o un enlace de Google Maps que identifique el lugar.");
      }

      const nueva: NuevaCoordinacion = {
        fecha: String(formulario.get("fecha")),
        ticket: String(formulario.get("ticket")).trim(),
        cliente: String(formulario.get("cliente")).trim(),
        tercerizadaId: String(formulario.get("tercerizada") || "") || null,
        cuadrillaId: String(formulario.get("cuadrilla") || "") || null,
        horarioId: String(formulario.get("horario") || "") || null,
        tecnologiaId: String(formulario.get("tecnologia")),
        categoriaId: String(formulario.get("categoria")),
        observaciones: String(formulario.get("observaciones") || "").trim(),
        zona: String(formulario.get("zona") || "") || null,
        estadoId: String(formulario.get("estado")),
        ubicacion,
        extrasIds: formulario.getAll("extras").map(String),
      };
      if (inicial) await actualizarCoordinacion(inicial.id, nueva);
      else await crearCoordinacion(nueva);
      if (!inicial) {
        try { window.sessionStorage.removeItem(claveBorrador); } catch { /* La coordinación ya quedó guardada. */ }
      }
      if (onGuardado) onGuardado({ tercerizadaId: nueva.tercerizadaId, cuadrillaId: nueva.cuadrillaId, zona: nueva.zona, tecnologiaId: nueva.tecnologiaId });
      else router.push("/coordinaciones/" + nueva.fecha);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo guardar la coordinación.");
    } finally {
      setGuardando(false);
    }
  }

  return (
    <section className={onCancelar ? "nueva-coordinacion-form-modal" : undefined}>
      {!onCancelar && (<Link href={"/coordinaciones/" + fecha} className="back-link">← Volver a las coordinaciones</Link>)}
      {!onCancelar && (<PageHeading eyebrow={inicial ? "Editar coordinación" : "Nueva coordinación"} title={inicial ? "Editar " + inicial.ticket : "Cargar coordinación"} description="Completá los datos del caso. Los campos con * son obligatorios." />)}
      <form ref={formularioRef} className="panel coordination-form" onSubmit={guardar} onChange={guardarBorrador}>
        <div className="form-grid">
          <label className="form-field">Fecha *<input type="date" name="fecha" defaultValue={inicial?.fecha ?? fecha} required /></label>
          <label className="form-field">Número de ticket *<input name="ticket" required defaultValue={inicial?.ticket ?? ""} placeholder="Ej.: 1234567" /></label>
          <label className="form-field">Número o nombre de cliente *<input name="cliente" required defaultValue={inicial?.cliente ?? ""} placeholder="Identificación del cliente" /></label>
          <label className="form-field form-field-wide">Coordenadas o enlace de Google Maps<input name="ubicacion" type="text" defaultValue={inicial?.ubicacion ?? ""} placeholder="Ej.: -34.6037, -58.3816 o pegá el enlace del lugar" /></label>
          <label className="form-field">Tercerizada<select name="tercerizada" value={tercerizadaSeleccionada} onChange={(event) => { setTercerizadaEditada(event.target.value); setCuadrillaEditada(""); }}><Opciones opciones={catalogos.tercerizadas} vacio="Sin asignar" conservarId={inicial?.tercerizadaId} /></select></label>
          <label className="form-field">Cuadrilla<select name="cuadrilla" value={cuadrillaSeleccionada} onChange={(event) => setCuadrillaEditada(event.target.value)}><Opciones opciones={cuadrillasDisponibles} conservarId={inicial?.cuadrillaId} vacio={tercerizadaSeleccionada ? "Sin asignar" : "Elegí primero una tercerizada"} /></select></label>
          <label className="form-field">Horario<select name="horario" defaultValue={inicial?.horarioId ?? ""}><Opciones opciones={catalogos.horarios} vacio="Sin asignar" conservarId={inicial?.horarioId} /></select></label>
          <label className="form-field">Tecnología *<select name="tecnologia" required defaultValue={inicial?.tecnologiaId ?? valoresIniciales?.tecnologiaId ?? ""}><Opciones opciones={catalogos.tecnologias} conservarId={inicial?.tecnologiaId} /></select></label>
          <label className="form-field">Categoría *<select name="categoria" required defaultValue={inicial?.categoriaId ?? ""}><Opciones opciones={catalogos.categorias} conservarId={inicial?.categoriaId} /></select></label>
          <label className="form-field">Estado *<select name="estado" required defaultValue={inicial?.estadoId ?? ""}><Opciones opciones={catalogos.estados} conservarId={inicial?.estadoId} /></select></label>
          <label className="form-field">Zona<select name="zona" defaultValue={inicial?.zona ?? valoresIniciales?.zona ?? ""}><Opciones opciones={catalogos.zonas} vacio="Sin asignar" conservarId={inicial?.zona} /></select></label>
          <label className="form-field form-field-wide">Observaciones<textarea name="observaciones" rows={3} defaultValue={inicial?.observaciones ?? ""} placeholder="Información útil para la coordinación" /></label>
        </div>
        <fieldset className="extras-fieldset"><legend>Extras</legend><div className="extras-options">{extrasDisponibles.map((extra) => <label key={extra.id} className="extra-option"><input type="checkbox" name="extras" value={extra.id} defaultChecked={inicial?.extrasIds.includes(extra.id) ?? false} />{extra.nombre}</label>)}</div></fieldset>
        {error && <p role="alert" className="m-0 text-sm text-rose-300">{error}</p>}
        <div className="form-actions">{onCancelar ? <button className="button" type="button" onClick={onCancelar}>Cancelar</button> : <Link className="button" href={"/coordinaciones/" + fecha}>Cancelar</Link>}<button className="button button-primary" type="submit" disabled={guardando}>{guardando ? "Guardando…" : inicial ? "Guardar cambios" : "Guardar coordinación"}</button></div>
      </form>
    </section>
  );
}
