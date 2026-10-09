"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { useCoordinacionesDemo, type NuevaCoordinacion } from "@/components/providers/demo-data-provider";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeading } from "@/components/ui/page-heading";
import { esEnlaceCortoMaps, normalizarUbicacionMaps } from "@/lib/maps/ubicacion";

function Opciones({ opciones, vacio = "Seleccionar…" }: { opciones: { id: string; nombre: string }[]; vacio?: string }) {
  return <><option value="">{vacio}</option>{opciones.map((opcion) => <option key={opcion.id} value={opcion.id}>{opcion.nombre}</option>)}</>;
}

export function NuevaCoordinacionForm({ fecha, coordinacionId }: { fecha: string; coordinacionId?: string }) {
  const router = useRouter();
  const { coordinaciones, catalogos, ready, crearCoordinacion, actualizarCoordinacion } = useCoordinacionesDemo();
  const inicial = coordinacionId ? coordinaciones.find((coordinacion) => coordinacion.id === coordinacionId) : undefined;
  const [tercerizadaEditada, setTercerizadaEditada] = useState<string | undefined>(undefined);
  const [cuadrillaEditada, setCuadrillaEditada] = useState<string | undefined>(undefined);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");
  const tercerizadaSeleccionada = tercerizadaEditada ?? inicial?.tercerizadaId ?? "";
  const cuadrillaSeleccionada = cuadrillaEditada ?? inicial?.cuadrillaId ?? "";
  const cuadrillasDisponibles = catalogos.cuadrillas.filter((cuadrilla) => cuadrilla.tercerizadaId === tercerizadaSeleccionada);

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
      router.push("/coordinaciones/" + nueva.fecha);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo guardar la coordinación.");
    } finally {
      setGuardando(false);
    }
  }

  return (
    <section>
      <Link href={"/coordinaciones/" + fecha} className="back-link">← Volver a las coordinaciones</Link>
      <PageHeading eyebrow={inicial ? "Editar coordinación" : "Nueva coordinación"} title={inicial ? "Editar " + inicial.ticket : "Cargar coordinación"} description="Completá los datos del caso. Los campos con * son obligatorios." />
      <form className="panel coordination-form" onSubmit={guardar}>
        <div className="form-grid">
          <label className="form-field">Fecha *<input type="date" name="fecha" defaultValue={inicial?.fecha ?? fecha} required /></label>
          <label className="form-field">Número de ticket *<input name="ticket" required defaultValue={inicial?.ticket ?? ""} placeholder="Ej.: 1234567" /></label>
          <label className="form-field">Número o nombre de cliente *<input name="cliente" required defaultValue={inicial?.cliente ?? ""} placeholder="Identificación del cliente" /></label>
          <label className="form-field form-field-wide">Coordenadas o enlace de Google Maps<input name="ubicacion" type="text" defaultValue={inicial?.ubicacion ?? ""} placeholder="Ej.: -34.6037, -58.3816 o pegá el enlace del lugar" /></label>
          <label className="form-field">Tercerizada<select name="tercerizada" value={tercerizadaSeleccionada} onChange={(event) => { setTercerizadaEditada(event.target.value); setCuadrillaEditada(""); }}><Opciones opciones={catalogos.tercerizadas} vacio="Sin asignar" /></select></label>
          <label className="form-field">Cuadrilla<select name="cuadrilla" value={cuadrillaSeleccionada} onChange={(event) => setCuadrillaEditada(event.target.value)}><Opciones opciones={cuadrillasDisponibles} vacio={tercerizadaSeleccionada ? "Sin asignar" : "Elegí primero una tercerizada"} /></select></label>
          <label className="form-field">Horario<select name="horario" defaultValue={inicial?.horarioId ?? ""}><Opciones opciones={catalogos.horarios} vacio="Sin asignar" /></select></label>
          <label className="form-field">Tecnología *<select name="tecnologia" required defaultValue={inicial?.tecnologiaId ?? ""}><Opciones opciones={catalogos.tecnologias} /></select></label>
          <label className="form-field">Categoría *<select name="categoria" required defaultValue={inicial?.categoriaId ?? ""}><Opciones opciones={catalogos.categorias} /></select></label>
          <label className="form-field">Estado *<select name="estado" required defaultValue={inicial?.estadoId ?? ""}><Opciones opciones={catalogos.estados} /></select></label>
          <label className="form-field">Zona<select name="zona" defaultValue={inicial?.zona ?? ""}><Opciones opciones={catalogos.zonas} vacio="Sin asignar" /></select></label>
          <label className="form-field form-field-wide">Observaciones<textarea name="observaciones" rows={3} defaultValue={inicial?.observaciones ?? ""} placeholder="Información útil para la coordinación" /></label>
        </div>
        <fieldset className="extras-fieldset"><legend>Extras</legend><div className="extras-options">{catalogos.extras.map((extra) => <label key={extra.id} className="extra-option"><input type="checkbox" name="extras" value={extra.id} defaultChecked={inicial?.extrasIds.includes(extra.id) ?? false} />{extra.nombre}</label>)}</div></fieldset>
        {error && <p role="alert" className="m-0 text-sm text-rose-300">{error}</p>}
        <div className="form-actions"><Link className="button" href={"/coordinaciones/" + fecha}>Cancelar</Link><button className="button button-primary" type="submit" disabled={guardando}>{guardando ? "Guardando…" : inicial ? "Guardar cambios" : "Guardar coordinación"}</button></div>
      </form>
    </section>
  );
}
