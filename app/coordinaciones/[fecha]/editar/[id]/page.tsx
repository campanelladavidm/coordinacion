import { Suspense } from "react";
import { NuevaCoordinacionForm } from "@/components/coordinaciones/nueva-coordinacion-form";

export const instant = false;

type PageParams = { fecha: string; id: string };

export default function EditarCoordinacionPage({ params }: { params: Promise<PageParams> }) {
  return <Suspense fallback={null}><EditarCoordinacionContenido params={params} /></Suspense>;
}

async function EditarCoordinacionContenido({ params }: { params: Promise<PageParams> }) {
  const { fecha, id } = await params;
  return <NuevaCoordinacionForm fecha={fecha} coordinacionId={id} />;
}
