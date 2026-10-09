import { Suspense } from "react";
import { NuevaCoordinacionForm } from "@/components/coordinaciones/nueva-coordinacion-form";

export const instant = false;

type PageParams = { fecha: string };

export default function NuevaCoordinacionPage({ params }: { params: Promise<PageParams> }) {
  return <Suspense fallback={null}><NuevaCoordinacionContenido params={params} /></Suspense>;
}

async function NuevaCoordinacionContenido({ params }: { params: Promise<PageParams> }) {
  const { fecha } = await params;
  return <NuevaCoordinacionForm fecha={fecha} />;
}
