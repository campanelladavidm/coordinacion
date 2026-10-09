import { Suspense } from "react";
import { CoordinacionesDelDia } from "@/components/coordinaciones/coordinaciones-del-dia";

export const instant = false;

type PageParams = { fecha: string };

export default function CoordinacionesDiariasPage({ params }: { params: Promise<PageParams> }) {
  return <Suspense fallback={null}><CoordinacionesDiariasContenido params={params} /></Suspense>;
}

async function CoordinacionesDiariasContenido({ params }: { params: Promise<PageParams> }) {
  const { fecha } = await params;
  const date = new Date(fecha + "T12:00:00Z");
  const fechaValida = !Number.isNaN(date.getTime()) && /^\d{4}-\d{2}-\d{2}$/.test(fecha);
  const tituloFecha = fechaValida
    ? new Intl.DateTimeFormat("es-AR", { dateStyle: "full", timeZone: "UTC" }).format(date)
    : "Fecha seleccionada";

  return <CoordinacionesDelDia fecha={fecha} tituloFecha={tituloFecha} />;
}
