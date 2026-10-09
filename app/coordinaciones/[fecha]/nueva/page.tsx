import { NuevaCoordinacionForm } from "@/components/coordinaciones/nueva-coordinacion-form";

export const instant = false;

export default async function NuevaCoordinacionPage({ params }: { params: Promise<{ fecha: string }> }) {
  const { fecha } = await params;
  return <NuevaCoordinacionForm fecha={fecha} />;
}
